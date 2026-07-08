import AVFoundation
import XCTest

@testable import PlaySenseAudio

/// Live-engine smoke test for the D20 audio foundation. Unlike the offline manual-rendering tests, this
/// drives the REAL `AVAudioEngine` (`start()`, `mainMixerNode.lastRenderTime` anchor resolution,
/// scheduling on host-time `AVAudioTime`, `teardown()`) — the path the debug harness exercises on
/// device. Live audio start-up is environment-sensitive, so it is gated behind `RUN_AUDIO_SMOKE=1`
/// (same convention as the notation goldens) and logs its findings for the task report.
final class GameAudioEngineSmokeTests: XCTestCase {

    @MainActor
    func testLiveEngineStartResolvesT0AndTearsDown() throws {
        guard ProcessInfo.processInfo.environment["RUN_AUDIO_SMOKE"] == "1" else {
            throw XCTSkip("Set RUN_AUDIO_SMOKE=1 to run the live-engine smoke test.")
        }

        let engine = GameAudioEngine(sampleRate: 48_000)
        let sampleRate = engine.engine.mainMixerNode.outputFormat(forBus: 0).sampleRate
        NSLog("[AudioSmoke] engine sampleRate: \(sampleRate)")

        // One synthetic backing stem (2 s, 220 Hz) so the graph has a stem player attached.
        let frames = Int(sampleRate * 2)
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        let stem = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))!
        stem.frameLength = AVAudioFrameCount(frames)
        for frame in 0..<frames {
            stem.floatChannelData![0][frame] = 0.2 * Float(sin(2 * Double.pi * 220 * Double(frame) / sampleRate))
        }
        engine.loadBackingBuffers([stem])
        engine.setBackingMode(.speakerSafe)
        engine.prepare()

        let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 8)
        let resolved = try engine.start(t0Delay: 2.5, clicks: clicks)

        NSLog("[AudioSmoke] scheduled \(clicks.count) clicks + 1 stem")
        NSLog("[AudioSmoke] t0 hostSeconds: \(resolved.hostSeconds)")
        NSLog("[AudioSmoke] t0 outputSampleTime: \(resolved.outputSampleTime)")
        NSLog("[AudioSmoke] engine running: \(engine.engine.isRunning)")

        NSLog("[AudioSmoke] resolved.sampleRate: \(resolved.sampleRate) (mixer output \(sampleRate))")
        XCTAssertTrue(engine.engine.isRunning)
        XCTAssertGreaterThan(resolved.hostTicks, GameClock.now() - HostTimebase.system.ticks(fromSeconds: 1))
        XCTAssertGreaterThan(resolved.sampleRate, 0)

        // Let a little real time elapse so the engine actually renders, then tear down cleanly.
        let expectation = expectation(description: "render window")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { expectation.fulfill() }
        wait(for: [expectation], timeout: 2)

        engine.teardown()
        NSLog("[AudioSmoke] after teardown, engine running: \(engine.engine.isRunning)")
        XCTAssertFalse(engine.engine.isRunning, "teardown must stop the engine (no leaks across sessions)")
    }
}
