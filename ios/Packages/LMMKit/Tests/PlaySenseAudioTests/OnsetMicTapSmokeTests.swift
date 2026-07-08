import AVFoundation
import XCTest

@testable import PlaySenseAudio
import PlaySenseCore

/// Live-engine smoke test for the D21 mic tap: install the tap on the real input node, let it run over
/// the simulator mic (silence is fine), and confirm it drains without xruns/crashes and tears down
/// cleanly. Gated behind `RUN_AUDIO_SMOKE=1` (same convention as D20). Logs findings for the report.
final class OnsetMicTapSmokeTests: XCTestCase {

    @MainActor
    func testMicTapRunsAndTearsDown() throws {
        guard ProcessInfo.processInfo.environment["RUN_AUDIO_SMOKE"] == "1" else {
            throw XCTSkip("Set RUN_AUDIO_SMOKE=1 to run the live mic-tap smoke test.")
        }

        let session = AudioSessionController()
        _ = try? session.configure()

        let engine = GameAudioEngine(sampleRate: 48_000)
        engine.prepare()
        let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 8)
        _ = try engine.start(t0Delay: 2.5, clicks: clicks)

        let lock = NSLock()
        var messageCount = 0
        var levelCount = 0
        engine.installMicTap(config: getInstrumentConfig(.conga)) { message in
            lock.lock(); defer { lock.unlock() }
            messageCount += 1
            if case .level = message { levelCount += 1 }
        }

        // Let the tap run ~0.5 s of real time.
        let done = expectation(description: "tap window")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { done.fulfill() }
        wait(for: [done], timeout: 3)

        lock.lock(); let total = messageCount; let levels = levelCount; lock.unlock()
        NSLog("[MicSmoke] messages: \(total) (levels: \(levels)), drops: \(engine.micDropCount)")
        XCTAssertGreaterThan(levels, 0, "the tap should have produced level messages over 0.5 s")

        engine.removeMicTap()
        engine.teardown()
        session.deactivate()
        XCTAssertFalse(engine.engine.isRunning, "teardown must stop the engine")
    }
}
