import Foundation

/// D26: a sink for a completed take's graded results, injected into `SessionCoordinator`
/// (`PlaySenseUI`) so PlaySenseCore/PlaySenseUI never depend on Supabase/networking directly —
/// mirrors how `ExerciseDefinition` is the shared currency that keeps `ScoreRepository` (LMMData)
/// decoupled from the highway/scoring engine. The concrete implementation (`OfflineAttemptQueue`,
/// LMMData) wraps an `AttemptRepository` with an on-disk retry queue; LMMFeatures wires it into
/// `StagePlayerView` at construction.
public protocol PlaySenseAttemptSink: Sendable {
    /// Persist (or, on failure, queue for later retry) one completed take. Never throws — the
    /// returned outcome tells the caller which happened, so `SessionCoordinator`/`StageResultsView`
    /// can show "saved" vs "will sync" without knowing anything about the retry mechanism.
    /// `exerciseId` is `ExerciseDefinition.id` verbatim (a UUID string in every real caller —
    /// a class item id or a standalone song id); the sink is responsible for parsing it.
    func record(exerciseId: String, stats: AttemptStats, events: [EventResult]) async -> AttemptPersistOutcome

    /// Best-effort flush of anything still stuck on disk from a previous failure. Called on app
    /// foreground (`SessionCoordinator.handleForegrounding()`) and opportunistically at the top of
    /// every `record(...)` call (satisfies the "retry at next session completion" requirement for
    /// free — no separate scheduling needed).
    func drainPending() async
}

/// What happened when a completed take was handed to a ``PlaySenseAttemptSink``.
public enum AttemptPersistOutcome: Equatable, Sendable {
    /// Landed in the live database.
    case saved
    /// The live save failed (offline, or a transient server error); the attempt was serialized to
    /// disk and will be retried on the next foreground or session completion.
    case queued
}

/// The results panel's persistence affordance (``PlaySenseUI/StageResultsView``). Distinct from
/// ``AttemptPersistOutcome`` because the UI also needs the two states that only make sense before
/// an outcome exists: `idle` (nothing to persist — practice mode, or no sink injected) and
/// `saving` (the call is in flight).
public enum AttemptPersistState: Equatable, Sendable {
    case idle
    case saving
    case saved
    case queued
}

/// Default, no-op sink for previews/tests that don't exercise persistence — always reports
/// `.saved` without doing anything. Mirrors `PassthroughMediaURLResolver`'s role for
/// `AppServices.mediaResolver`.
public struct NoOpAttemptSink: PlaySenseAttemptSink {
    public init() {}

    public func record(
        exerciseId: String,
        stats: AttemptStats,
        events: [EventResult]
    ) async -> AttemptPersistOutcome {
        .saved
    }

    public func drainPending() async {}
}
