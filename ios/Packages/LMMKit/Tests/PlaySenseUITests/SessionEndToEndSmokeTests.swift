import AVFoundation
import PlaySenseCore
import XCTest

@testable import PlaySenseUI

/// Deterministic end-to-end simulator run of the D23 playable core: a REAL ``SessionCoordinator`` drives the
/// live `AVAudioEngine` (session config → `t0` resolution → count-in → CADisplayLink playhead → finish),
/// while the debug synthetic-onset seam injects perfect-timed onsets for every expected event so the whole
/// session grades to a known result with no mic. Live audio + record-permission are environment-sensitive,
/// so it is gated behind `RUN_SESSION_SMOKE=1` (same convention as `RUN_AUDIO_SMOKE`) and only proceeds when
/// mic permission is already granted (never triggers a prompt in a headless run).
final class SessionEndToEndSmokeTests: XCTestCase {

    @MainActor
    func testFullSessionReachesResultsWithPerfectRun() throws {
        guard ProcessInfo.processInfo.environment["RUN_SESSION_SMOKE"] == "1" else {
            throw XCTSkip("Set RUN_SESSION_SMOKE=1 to run the live end-to-end session smoke test.")
        }
        guard AVAudioApplication.shared.recordPermission == .granted else {
            throw XCTSkip("Mic permission not pre-granted; skipping to avoid a headless prompt.")
        }

        let coordinator = SessionCoordinator()
        coordinator.present(exercise: DebugStageView.sampleExercise)
        coordinator.selectMode(.headphones)
        coordinator.calibrationResolved()
        coordinator.debugAutoPlayOffsetMs = 0 // perfect-timed synthetic onsets

        Task { await coordinator.startSession() }

        // Spin the main run loop (CADisplayLink + async permission/start) until the session finishes.
        let done = expectation(description: "session reaches results")
        let poll = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            MainActor.assumeIsolated {
                if case .results = coordinator.phase {
                    timer.invalidate()
                    done.fulfill()
                }
            }
        }
        wait(for: [done], timeout: 20)
        poll.invalidate()

        guard case let .results(stats) = coordinator.phase else {
            return XCTFail("session did not reach results: \(coordinator.phase)")
        }
        NSLog("[SessionSmoke] score=\(stats.score) accuracy=\(stats.accuracy) " +
              "perfect=\(stats.perfectCount) miss=\(stats.missCount) events=\(coordinator.finalResults.count)")
        XCTAssertEqual(coordinator.finalResults.count, DebugStageView.sampleExercise.events.count)
        XCTAssertEqual(stats.missCount, 0, "a perfect-timed synthetic run should miss nothing")
        XCTAssertGreaterThan(stats.score, 95, "perfect run should score near 100")
    }
}
