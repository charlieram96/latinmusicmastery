import Foundation
import os
import PlaySenseCore

/// Actor wrapping a live ``AttemptRepository`` with an on-disk retry queue for failed saves — the
/// ``PlaySenseAttemptSink`` `SessionCoordinator` calls at the end of every ranked take (D26).
///
/// Semantics:
///  - `record(...)` first makes a best-effort attempt to drain whatever is already sitting in the
///    queue from a previous failure (satisfies "retry ... at next session completion" from the
///    brief, for free, on every subsequent take — no separate scheduling needed), THEN tries the
///    live save for the current attempt. On failure the attempt is appended to disk and `.queued`
///    is returned.
///  - `drainPending()` is also called directly on app foreground — fix round 1 correction (finding
///    2): the ORIGINAL D26 report's phrasing here ("also called directly on app foreground
///    (`SessionCoordinator.handleForegrounding()`)") overstated it. That hook only fires while a
///    `StagePlayerView` happens to be the mounted screen when the app returns to foreground — every
///    other screen (Home, Courses, My Courses, Profile) silently skipped the drain. The actual
///    app-wide trigger is now `RootView.handleScenePhaseChange(_:attemptSink:)` (`LMMFeatures`,
///    mounted for the app's entire lifetime); `SessionCoordinator.handleForegrounding()` still exists
///    as a harmless, zero-latency belt-and-suspenders call for the specific case where a stage
///    session is the thing being foregrounded.
///  - Cap: ``maxQueueSize`` (~50) queued attempts. Over the cap, the OLDEST entries are dropped (a
///    burst of offline practice matters less than the most recent takes) and the drop is logged.
///  - No idempotency key is sent to the server: `play_sense_attempts.id` is server-generated
///    (`gen_random_uuid()`) and neither the schema nor the web's `saveAttempt` action supports a
///    client-supplied key. The web itself does not dedupe either — `ScoreExerciseGame`'s
///    `useEffect` fires the insert exactly once per `results` entry with no idempotency guard at
///    all (verified by reading `app/actions/play-sense.ts` and its one call site). This queue
///    matches that same "trust the single call site" model: `SessionCoordinator` guarantees
///    `record(...)` is invoked AT MOST ONCE per take (`hasPersistedCurrentAttempt`).
///
///  - **Crash-window note (updated fix round 1, finding 1).** The pre-fix-round version of this
///    actor called a single combined `AttemptRepository.saveAttempt(...)`; if the attempt row
///    insert succeeded but the events batch then failed, `attemptLiveSave` reported total failure
///    and the whole payload was re-queued with no memory of the id that had already landed. The
///    NEXT drain re-ran `saveAttempt` from scratch, inserting a SECOND attempt row while the FIRST
///    sat on the server forever with zero events — an orphan+duplicate pair, not just a duplicate,
///    since nothing (no schema constraint, verified live) stops either half. Fixed by splitting the
///    repository contract into `insertAttempt(...)` / `insertEvents(attemptId:events:)` and
///    threading a `QueuedAttempt.persistedAttemptId` through `attemptLiveSave`: once the attempt
///    row exists, every subsequent retry — however many drains it takes — calls ONLY
///    `insertEvents` against that SAME id, and the id is written to disk (`store.save`) the moment
///    it's known, not just on full success. The remaining crash window is narrower and different
///    in kind: if the process is killed in the instant between a successful network response
///    (`insertAttempt` or `insertEvents`) and the disk write that records the outcome, that one
///    write is lost. For `insertAttempt` succeeding then a crash: the id is never persisted, so the
///    take is retried from scratch next launch (one avoidable but harmless extra attempt row — not
///    a duplicate producing double-counted stats, since the orphan has no events and nothing reads
///    an events-less attempt as a completed take). For `insertEvents` succeeding then a crash: the
///    take is fully saved server-side; the only loss is this device's local queue entry not being
///    cleared, which — same as before this fix — self-resolves on the next foreground/take, since
///    `insertEvents` on an attempt that already has its events is the sole remaining (now genuinely
///    narrow, timing-only) risk of a duplicate events batch. No server-side idempotency key exists
///    to close this fully; it is a strictly smaller risk than the orphan+duplicate this fix round
///    closes, not a claim of zero risk.
public actor OfflineAttemptQueue: PlaySenseAttemptSink {
    public static let maxQueueSize = 50

    private let repository: AttemptRepository
    private let store: AttemptQueueStore
    private let logger = Logger(subsystem: "com.latinmusicmastery.app", category: "PlaySenseAttemptQueue")

    public init(repository: AttemptRepository, store: AttemptQueueStore) {
        self.repository = repository
        self.store = store
    }

    public func record(
        exerciseId: String,
        stats: AttemptStats,
        events: [EventResult]
    ) async -> AttemptPersistOutcome {
        await drainPending()
        switch await attemptLiveSave(exerciseId: exerciseId, stats: stats, events: events, persistedAttemptId: nil) {
        case .saved, .droppedMalformed:
            return .saved
        case let .eventsFailed(attemptId):
            // The attempt row landed; only its events batch needs a retry — persist the id so the
            // NEXT drain resumes from `insertEvents`, never re-running `insertAttempt` (finding 1).
            enqueue(
                QueuedAttempt(
                    exerciseId: exerciseId, stats: stats, events: events, queuedAt: Date(),
                    persistedAttemptId: attemptId
                )
            )
            return .queued
        case .failed:
            enqueue(QueuedAttempt(exerciseId: exerciseId, stats: stats, events: events, queuedAt: Date()))
            return .queued
        }
    }

    public func drainPending() async {
        let pending = store.load()
        guard !pending.isEmpty else { return }

        var remaining: [QueuedAttempt] = []
        for item in pending {
            let outcome = await attemptLiveSave(
                exerciseId: item.exerciseId, stats: item.stats, events: item.events,
                persistedAttemptId: item.persistedAttemptId
            )
            switch outcome {
            case .saved, .droppedMalformed:
                break // fully handled — drop from the queue
            case let .eventsFailed(attemptId):
                remaining.append(
                    QueuedAttempt(
                        localId: item.localId, exerciseId: item.exerciseId, stats: item.stats,
                        events: item.events, queuedAt: item.queuedAt, persistedAttemptId: attemptId
                    )
                )
            case .failed:
                remaining.append(item)
            }
        }
        // Content, not just count, can change here: an item that was fully-failed before (no
        // `persistedAttemptId`) can come back from this loop still queued (events still failing)
        // but now CARRYING the newly-inserted attempt id — that must reach disk even though
        // `remaining.count == pending.count`, or a crash/relaunch before the NEXT successful drain
        // would forget the id and re-insert a duplicate attempt row (the exact bug this fixes).
        if remaining != pending {
            store.save(remaining)
        }
    }

    // MARK: - Private

    /// One attempt's live-save outcome for one `attemptLiveSave` call.
    private enum LiveSaveOutcome: Equatable {
        /// Both the attempt row and its events landed.
        case saved
        /// Not a UUID — dropped rather than queued forever (nothing retriable).
        case droppedMalformed
        /// The attempt row (already `attemptId`, whether just-inserted or resumed from
        /// `persistedAttemptId`) exists, but `insertEvents` failed. The caller must persist
        /// `attemptId` to disk so the retry skips `insertAttempt` entirely.
        case eventsFailed(attemptId: UUID)
        /// Nothing landed (only reachable when `persistedAttemptId` was `nil` and `insertAttempt`
        /// itself failed) — the caller retries both steps from scratch.
        case failed
    }

    /// `persistedAttemptId`, when non-`nil`, means a PREVIOUS call already got the attempt row
    /// inserted (its id) and only `insertEvents` needs retrying — `insertAttempt` is skipped
    /// entirely so a resumed retry can never produce a second attempt row for the same take.
    /// D27 ledger: no circuit breaker exists for a STALE `persistedAttemptId` (e.g. if that row were
    /// ever deleted server-side between insert and retry) — `insertEvents` would fail against it
    /// forever, retried on every future drain with no cap beyond `maxQueueSize`'s unrelated
    /// drop-oldest policy. Unreachable today: nothing in this app or schema ever deletes a
    /// `play_sense_attempts` row post-insert (verified against the migrations).
    private func attemptLiveSave(
        exerciseId: String,
        stats: AttemptStats,
        events: [EventResult],
        persistedAttemptId: UUID?
    ) async -> LiveSaveOutcome {
        guard let uuid = UUID(uuidString: exerciseId) else {
            logger.fault("Dropping a queued attempt with a malformed exerciseId (not a UUID) — never expected")
            return .droppedMalformed
        }

        let attemptId: UUID
        if let persistedAttemptId {
            attemptId = persistedAttemptId
        } else {
            do {
                attemptId = try await repository.insertAttempt(exerciseId: uuid, stats: stats)
            } catch {
                logLiveSaveFailure(stage: "insertAttempt", error: error)
                return .failed
            }
        }

        do {
            try await repository.insertEvents(attemptId: attemptId, events: events)
            return .saved
        } catch {
            logLiveSaveFailure(stage: "insertEvents", error: error)
            return .eventsFailed(attemptId: attemptId)
        }
    }

    /// Generic live-save failure logging (fix round 1, finding 3) — an `.error` with the
    /// underlying error's description and the CURRENT on-disk backlog depth, so a device's logs
    /// show not just "a save failed" but how deep the retry backlog already is at that moment
    /// (a lone failure vs. a device that's been offline for a while and is approaching
    /// ``maxQueueSize``).
    private func logLiveSaveFailure(stage: String, error: Error) {
        let depth = store.load().count
        logger.error(
            """
            \(stage, privacy: .public) failed: \(String(describing: error), privacy: .private) — \
            queue depth \(depth, privacy: .public)
            """
        )
    }

    private func enqueue(_ item: QueuedAttempt) {
        var pending = store.load()
        pending.append(item)
        if pending.count > Self.maxQueueSize {
            let overflow = pending.count - Self.maxQueueSize
            pending.removeFirst(overflow)
            logger.warning("Attempt queue over cap — dropped \(overflow, privacy: .public) oldest entries")
        }
        store.save(pending)
    }
}
