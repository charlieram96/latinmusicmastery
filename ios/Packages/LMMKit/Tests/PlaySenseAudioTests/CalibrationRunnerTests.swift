import Foundation
import XCTest

import LMMTestSupport
@testable import PlaySenseAudio
@testable import PlaySenseCore

/// `CalibrationRunner`'s engine-glue layer around the pure `CalibrationSession` interruption matrix
/// already covered directly (deterministically, no live audio) by `CalibrationSessionTests`. This file
/// covers what's specific to the RUNNER: (a) cheap, no-live-audio coverage of `interrupt(reason:)`'s
/// nil-session guard; (b) a live-engine smoke test (gated behind `RUN_AUDIO_SMOKE=1`, same convention as
/// `GameAudioEngineSmokeTests`) proving `interrupt(reason:)` actually stops the poll timer/onset source
/// and republishes the `.interrupted` phase through `onPhaseChange` end-to-end.
@MainActor
final class CalibrationRunnerTests: XCTestCase {

    /// Trivial `OnsetEventSource` conformer — these tests never need it to actually emit onsets, just to
    /// observe whether `start()`/`stop()` were called.
    private final class FakeOnsetEventSource: OnsetEventSource {
        var onOnset: ((OnsetEvent) -> Void)?
        private(set) var startCallCount = 0
        private(set) var stopCallCount = 0
        func start() { startCallCount += 1 }
        func stop() { stopCallCount += 1 }
    }

    func testInterruptWithNoActiveSessionIsNoOp() {
        let runner = CalibrationRunner(
            engine: GameAudioEngine(), onsetSource: FakeOnsetEventSource(), routeKey: "route", sourceType: .mic
        )
        var phaseChanges: [CalibrationPhase] = []
        runner.onPhaseChange = { phaseChanges.append($0) }

        // `start()` was never called, so there is no `session` yet — interrupting must be a safe no-op,
        // not a crash, and must not fabricate a phase-change notification out of nothing.
        runner.interrupt(reason: .audioInterruption)

        XCTAssertNil(runner.session)
        XCTAssertTrue(phaseChanges.isEmpty)
    }

    func testLiveInterruptStopsPollingAndPublishesInterruptedPhase() throws {
        guard TestGates.isEnabled("RUN_AUDIO_SMOKE") else {
            throw XCTSkip(
                "Set RUN_AUDIO_SMOKE=1 (or SIMCTL_CHILD_RUN_AUDIO_SMOKE=1) to run the live-engine smoke test."
            )
        }

        let engine = GameAudioEngine()
        let onsetSource = FakeOnsetEventSource()
        let runner = CalibrationRunner(
            engine: engine, onsetSource: onsetSource, routeKey: "route", sourceType: .mic
        )
        defer { engine.teardown() }

        var phaseChanges: [CalibrationPhase] = []
        runner.onPhaseChange = { phaseChanges.append($0) }

        try runner.start()
        XCTAssertNotNil(runner.session)
        XCTAssertEqual(onsetSource.startCallCount, 1)

        runner.interrupt(reason: .routeChanged)

        guard case .interrupted(.routeChanged) = runner.session?.phase else {
            return XCTFail("expected the session to have moved to .interrupted(.routeChanged)")
        }
        XCTAssertEqual(phaseChanges.last, .interrupted(.routeChanged))
        XCTAssertEqual(onsetSource.stopCallCount, 1, "interrupt() must stop the onset source, like stop() does")
    }
}
