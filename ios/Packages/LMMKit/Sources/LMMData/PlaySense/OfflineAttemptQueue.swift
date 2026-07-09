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
///  - `drainPending()` is also called directly on app foreground
///    (`SessionCoordinator.handleForegrounding()`).
///  - Cap: ``maxQueueSize`` (~50) queued attempts. Over the cap, the OLDEST entries are dropped (a
///    burst of offline practice matters less than the most recent takes) and the drop is logged.
///  - No idempotency key is sent to the server: `play_sense_attempts.id` is server-generated
///    (`gen_random_uuid()`) and neither the schema nor the web's `saveAttempt` action supports a
///    client-supplied key. The web itself does not dedupe either — `ScoreExerciseGame`'s
///    `useEffect` fires the insert exactly once per `results` entry with no idempotency guard at
///    all (verified by reading `app/actions/play-sense.ts` and its one call site). This queue
///    matches that same "trust the single call site" model: `SessionCoordinator` guarantees
///    `record(...)` is invoked AT MOST ONCE per take (`hasPersistedCurrentAttempt`), so the only
///    place a duplicate could come from here is a crash between a drain's successful insert and
///    the disk write that removes it — a narrow, accepted window, the same order of risk as the
///    web's own lack of any guarantee.
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
        if await attemptLiveSave(exerciseId: exerciseId, stats: stats, events: events) {
            return .saved
        }
        enqueue(QueuedAttempt(exerciseId: exerciseId, stats: stats, events: events, queuedAt: Date()))
        return .queued
    }

    public func drainPending() async {
        let pending = store.load()
        guard !pending.isEmpty else { return }

        var remaining: [QueuedAttempt] = []
        for item in pending {
            let saved = await attemptLiveSave(exerciseId: item.exerciseId, stats: item.stats, events: item.events)
            if !saved { remaining.append(item) }
        }
        if remaining.count != pending.count {
            store.save(remaining)
        }
    }

    // MARK: - Private

    /// `true` on success (including the defensive malformed-id branch, which drops the attempt
    /// rather than queuing something that can never succeed). `false` means "still not saved" —
    /// the caller enqueues (or keeps queued) on that outcome.
    private func attemptLiveSave(exerciseId: String, stats: AttemptStats, events: [EventResult]) async -> Bool {
        guard let uuid = UUID(uuidString: exerciseId) else {
            logger.fault("Dropping a queued attempt with a malformed exerciseId (not a UUID) — never expected")
            return true
        }
        do {
            _ = try await repository.saveAttempt(exerciseId: uuid, stats: stats, events: events)
            return true
        } catch {
            return false
        }
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
