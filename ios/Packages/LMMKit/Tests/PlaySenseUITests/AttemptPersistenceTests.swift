import PlaySenseCore
import XCTest

@testable import PlaySenseUI

/// D26 session-integration coverage: `SessionCoordinator.persistAttemptIfNeeded` (the internal hook
/// `finishTake()` calls at the end of every take) driven directly with a fake `PlaySenseAttemptSink`
/// — no real audio engine, same rationale `SessionCoordinatorBLERetryTests`'s module doc gives for
/// driving active-take setup through the pure `SessionPhaseMachine` instead of a live take.
@MainActor
final class AttemptPersistenceTests: XCTestCase {

    private func makeStats() -> AttemptStats {
        AttemptStats(
            score: 82, accuracy: 88, perfectCount: 6, goodCount: 3, okCount: 1, missCount: 1,
            extraHits: 0, maxCombo: 5, maxStreak: 4, avgOffsetMs: 9, tempoDriftMs: 2,
            durationSeconds: 4.2, pitchAccuracy: nil
        )
    }

    private func makeEvents() -> [EventResult] {
        [EventResult(eventIndex: 0, grade: .perfect, offsetMs: 5, timing: .onTime, onsetEnergy: 1)]
    }

    /// Arms a coordinator to `.ready` (mic mode, no Bluetooth block) so `machine.isPracticeMode` is
    /// `false` by default — the "ranked take" starting point every test but the practice-mode one
    /// needs.
    private func makeReadyCoordinator(sink: FakeAttemptSink?) -> SessionCoordinator {
        let coordinator = SessionCoordinator()
        coordinator.attemptSink = sink
        coordinator.present(exercise: StagePlayerView.sampleExercise)
        coordinator.selectMode(.headphones)
        coordinator.calibrationResolved()
        return coordinator
    }

    /// Spins the task scheduler briefly so `persistAttemptIfNeeded`'s fire-and-forget `Task` gets a
    /// chance to run and publish its result.
    private func waitUntilSettled(_ coordinator: SessionCoordinator) async {
        for _ in 0..<200 {
            if coordinator.attemptPersistState != .saving { return }
            await Task.yield()
        }
    }

    // MARK: - Persists and reaches saved/queued

    func testPersistAttemptIfNeededSavesAndReachesSaved() async {
        let sink = FakeAttemptSink(outcome: .saved)
        let coordinator = makeReadyCoordinator(sink: sink)

        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-1", stats: makeStats(), events: makeEvents())
        XCTAssertEqual(coordinator.attemptPersistState, .saving, "must flip to .saving synchronously")

        await waitUntilSettled(coordinator)

        XCTAssertEqual(coordinator.attemptPersistState, .saved)
        let callCount = await sink.recordCallCount
        XCTAssertEqual(callCount, 1)
        let lastExerciseId = await sink.lastExerciseId
        XCTAssertEqual(lastExerciseId, "exercise-1")
    }

    func testPersistAttemptIfNeededReachesQueuedWhenSinkReportsQueued() async {
        let sink = FakeAttemptSink(outcome: .queued)
        let coordinator = makeReadyCoordinator(sink: sink)

        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-2", stats: makeStats(), events: makeEvents())
        await waitUntilSettled(coordinator)

        XCTAssertEqual(coordinator.attemptPersistState, .queued)
    }

    // MARK: - Practice mode is never persisted (parity: the web has no unranked concept)

    func testPracticeModeAttemptIsNeverPersisted() async {
        let sink = FakeAttemptSink(outcome: .saved)
        let coordinator = SessionCoordinator()
        coordinator.attemptSink = sink
        coordinator.present(exercise: StagePlayerView.sampleExercise)
        coordinator.selectMode(.headphones)
        coordinator.calibrationResolved()
        coordinator.machine.requestStart(isBluetoothOutput: true) // → .bluetoothBlocked
        coordinator.machine.acceptPracticeMode() // → isPracticeMode = true

        coordinator.persistAttemptIfNeeded(exerciseId: "practice-exercise", stats: makeStats(), events: makeEvents())
        await Task.yield()
        await Task.yield()

        XCTAssertEqual(coordinator.attemptPersistState, .idle, "practice-mode takes stay idle — never sent")
        let callCount = await sink.recordCallCount
        XCTAssertEqual(callCount, 0, "the sink must never be called for a practice-mode take")
    }

    // MARK: - No sink injected → stays idle (every DEBUG harness/preview default)

    func testNoAttemptSinkInjectedLeavesStateIdle() async {
        let coordinator = makeReadyCoordinator(sink: nil)

        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-3", stats: makeStats(), events: makeEvents())
        await Task.yield()

        XCTAssertEqual(coordinator.attemptPersistState, .idle)
    }

    // MARK: - No dupes on double-fire

    func testCallingPersistAttemptIfNeededTwiceForOneTakeOnlyInvokesTheSinkOnce() async {
        let sink = FakeAttemptSink(outcome: .saved)
        let coordinator = makeReadyCoordinator(sink: sink)

        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-4", stats: makeStats(), events: makeEvents())
        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-4", stats: makeStats(), events: makeEvents())
        await waitUntilSettled(coordinator)
        await Task.yield()

        let callCount = await sink.recordCallCount
        XCTAssertEqual(callCount, 1, "hasPersistedCurrentAttempt must gate every call after the first per take")
    }

    // MARK: - Completion parity: persistence never touches class-item completion

    /// `SessionCoordinator` (module `PlaySenseUI`) has no dependency on `LMMData`/`ProgressRepository`
    /// at all (see `Package.swift`: `PlaySenseUI`'s target dependencies are `PlaySenseCore`,
    /// `PlaySenseAudio`, `PlaySenseBLE`, `PlaySenseHighway`, `ScoreModel`, `LMMDesignSystem` — never
    /// `LMMData`), so it is architecturally impossible for a finished take to call
    /// `markClassItemComplete` from here. This test pins the OBSERABLE half of that guarantee: the
    /// only published state `persistAttemptIfNeeded` changes is `attemptPersistState` — `phase` and
    /// `isPracticeMode` are untouched by persistence succeeding or failing.
    func testPersistingAnAttemptTouchesOnlyPersistStateNotSessionPhase() async {
        let sink = FakeAttemptSink(outcome: .queued)
        let coordinator = makeReadyCoordinator(sink: sink)
        coordinator.machine.requestStart(isBluetoothOutput: false)
        coordinator.machine.beginPlaying()
        let stats = makeStats()
        coordinator.machine.finish(stats: stats)
        let phaseBefore = coordinator.phase
        let practiceBefore = coordinator.isPracticeMode

        coordinator.persistAttemptIfNeeded(exerciseId: "exercise-5", stats: stats, events: makeEvents())
        await waitUntilSettled(coordinator)

        XCTAssertEqual(coordinator.phase, phaseBefore, "persistence must never itself drive a phase transition")
        XCTAssertEqual(coordinator.isPracticeMode, practiceBefore)
        XCTAssertEqual(coordinator.attemptPersistState, .queued)
    }
}

// MARK: - Fakes

private actor FakeAttemptSink: PlaySenseAttemptSink {
    private let outcome: AttemptPersistOutcome
    private(set) var recordCallCount = 0
    private(set) var lastExerciseId: String?
    private(set) var drainCallCount = 0

    init(outcome: AttemptPersistOutcome) {
        self.outcome = outcome
    }

    func record(exerciseId: String, stats: AttemptStats, events: [EventResult]) async -> AttemptPersistOutcome {
        recordCallCount += 1
        lastExerciseId = exerciseId
        return outcome
    }

    func drainPending() async {
        drainCallCount += 1
    }
}
