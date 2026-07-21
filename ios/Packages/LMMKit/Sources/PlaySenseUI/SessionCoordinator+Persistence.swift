import PlaySenseCore

/// D26 attempt-persistence glue, split out of `SessionCoordinator.swift` (fix round 1, finding 6 —
/// that file had grown to 840 lines). Unlike the BLE mode-select methods that stay in the primary
/// file, `persistAttemptIfNeeded`/`handleForegrounding` only touch `attemptSink` (`public`),
/// `attemptPersistState` (`internal(set)`), and `hasPersistedCurrentAttempt` (`internal`) — none of
/// the `machine`/`engine`/`scorer` audio-session state the primary file's own doc comment cites as
/// the reason IT can't be split. Swift extensions can't declare stored properties, so those three
/// stay on the primary declaration; only the two methods that operate on them move here.
extension SessionCoordinator {
    /// D26: hand the just-finished take to the injected ``PlaySenseAttemptSink`` — unless this take
    /// ran in practice mode (the Bluetooth-blocked escape hatch), which the web has no equivalent of
    /// and is therefore never persisted (parity-safe: not writing beats writing an attempt shape the
    /// web could never have produced). `internal` (not `private`) for the same testability reason as
    /// `machine`/`bleManager`: `AttemptPersistenceTests` drives this directly instead of a real take
    /// (mic permission + a real `GameAudioEngine` make that environment-sensitive — see
    /// `SessionEndToEndSmokeTests`'s module doc). Called from `finishTake()` in `SessionCoordinator.swift`.
    func persistAttemptIfNeeded(exerciseId: String, stats: AttemptStats, events: [EventResult]) {
        guard !machine.isPracticeMode else { return } // attemptPersistState stays .idle
        guard let attemptSink else { return } // no sink injected (DEBUG harnesses/previews) → .idle
        guard !hasPersistedCurrentAttempt else { return } // one persist call per take, no matter what
        hasPersistedCurrentAttempt = true
        attemptPersistState = .saving
        Task { @MainActor [weak self] in
            let outcome = await attemptSink.record(exerciseId: exerciseId, stats: stats, events: events)
            self?.attemptPersistState = outcome == .saved ? .saved : .queued
        }
    }

    /// SwiftUI `scenePhase` → `.active` bridge (D26): opportunistically flushes any attempts still
    /// stuck in the offline queue from a previous failed save. Fire-and-forget; never blocks the UI,
    /// and a no-op whenever no sink is injected.
    ///
    /// Fix round 1 (finding 2): this used to be the ONLY foreground-drain trigger in the app, and it
    /// only fires while a `StagePlayerView` — the one caller of this method, via its own `scenePhase`
    /// hook — is on screen. `RootView.handleScenePhaseChange(_:attemptSink:)` (`LMMFeatures`) is now
    /// the app-wide trigger that covers every other screen; this method is left in place (harmless,
    /// idempotent — `drainPending()` no-ops on an empty queue) for the zero-latency case where a
    /// stage session happens to be the one being foregrounded.
    ///
    /// Single source of truth (D27 ledger): `RootView` is the PRIMARY drain trigger — it alone is
    /// guaranteed to fire regardless of which screen is on-screen. This method is in-session
    /// belt-and-suspenders only, not a second authority; if the two ever disagree on behavior, trust
    /// `RootView`.
    public func handleForegrounding() {
        guard let attemptSink else { return }
        Task { @MainActor in await attemptSink.drainPending() }
    }
}
