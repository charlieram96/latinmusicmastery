import Foundation
import XCTest

@testable import PlaySenseAudio
@testable import PlaySenseCore

/// D22 carry-forward: the `updateConfig` partial-reset matrix — behaviorally asserts (via the
/// `debug*` accessors `OnsetDetector` exposes only to this test target) exactly what a runtime config
/// patch resets vs preserves, mirroring the worklet's `port.onmessage`/`{type:'config'}` handler 1:1.
/// `configure()` remains a FULL reset (construct-time semantics) — the last test contrasts the two.
final class OnsetDetectorUpdateConfigTests: XCTestCase {

    private let sampleRate = 48_000.0
    private let blockSize = 128

    /// Feed `samples` through `detector` in 128-sample sub-blocks (the worklet's render-quantum
    /// granularity), starting at `startTime`, collecting every emitted message. Returns the blockTime
    /// the NEXT sub-block would start at.
    @discardableResult
    private func feed(
        _ detector: OnsetDetector,
        samples: [Float],
        startTime: Double,
        into messages: inout [OnsetDetectorMessage]
    ) -> Double {
        var blockTime = startTime
        var offset = 0
        while offset < samples.count {
            let len = min(blockSize, samples.count - offset)
            let block = Array(samples[offset..<(offset + len)])
            detector.process(block, blockTime: blockTime) { messages.append($0) }
            blockTime += Double(len) / sampleRate
            offset += len
        }
        return blockTime
    }

    /// A near-silent 300 Hz tone (establishes a low adaptive-threshold history — 300 Hz sits inside
    /// every profile's band-pass) followed by a loud burst of the same tone. The burst is short (20 ms,
    /// under every profile's refractory period) so at most one onset can fire from it.
    private func quietThenLoudSignal(quietSeconds: Double, loudSeconds: Double = 0.02) -> [Float] {
        let freq = 300.0
        let quietN = Int(quietSeconds * sampleRate)
        let loudN = Int(loudSeconds * sampleRate)
        var buf = [Float](repeating: 0, count: quietN + loudN)
        for sample in 0..<quietN {
            buf[sample] = Float(0.0005 * sin(2 * Double.pi * freq * Double(sample) / sampleRate))
        }
        for sample in 0..<loudN {
            buf[quietN + sample] = Float(0.6 * sin(2 * Double.pi * freq * Double(sample) / sampleRate))
        }
        return buf
    }

    private func onsetTimestamps(_ messages: [OnsetDetectorMessage]) -> [Double] {
        messages.compactMap {
            if case let .onset(timestamp, _, _, _) = $0 { return timestamp }
            return nil
        }
    }

    // MARK: - What SURVIVES a config patch

    func testUpdateConfigPreservesEnvelopeAndOnsetTiming() {
        let detector = OnsetDetector()
        let config = getInstrumentConfig(.guitar)
        detector.configure(config: config, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        let signal = quietThenLoudSignal(quietSeconds: 0.3)
        feed(detector, samples: signal, startTime: 0, into: &messages)

        let onsets = onsetTimestamps(messages)
        XCTAssertEqual(onsets.count, 1, "expected exactly one onset from the quiet→loud transient")
        let envelopeBefore = detector.debugEnvelope
        let onsetTimeBefore = detector.debugLastOnsetTime
        XCTAssertGreaterThan(envelopeBefore, 0)
        XCTAssertEqual(onsetTimeBefore, onsets[0])

        detector.updateConfig(OnsetConfigPatch(adaptiveThresholdMultiplier: 2.5))

        XCTAssertEqual(detector.debugEnvelope, envelopeBefore,
                       "envelope must survive a config patch (only configure() resets it)")
        XCTAssertEqual(detector.debugLastOnsetTime, onsetTimeBefore,
                       "lastOnsetTime (the refractory clock) must survive a config patch")
    }

    func testUpdateConfigPreservesBandPassMemoryButRecomputesCoefficients() {
        let detector = OnsetDetector()
        detector.configure(config: onsetConfigDefault, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        // A partial frame's worth of signal — nonzero biquad memory without necessarily completing a
        // full analysis frame.
        let signal = (0..<600).map { Float(0.2 * sin(2 * Double.pi * 300 * Double($0) / sampleRate)) }
        feed(detector, samples: signal, startTime: 0, into: &messages)

        let x1Before = detector.debugBandPassX1
        let x2Before = detector.debugBandPassX2
        let y1Before = detector.debugBandPassY1
        let y2Before = detector.debugBandPassY2
        XCTAssertNotEqual(y1Before, 0, "expected nonzero biquad memory after processing signal")

        detector.updateConfig(OnsetConfigPatch(bandPassLow: 200)) // changes the coefficients

        XCTAssertEqual(detector.debugBandPassX1, x1Before, "band-pass x1 memory must survive a config patch")
        XCTAssertEqual(detector.debugBandPassX2, x2Before, "band-pass x2 memory must survive a config patch")
        XCTAssertEqual(detector.debugBandPassY1, y1Before, "band-pass y1 memory must survive a config patch")
        XCTAssertEqual(detector.debugBandPassY2, y2Before, "band-pass y2 memory must survive a config patch")
    }

    func testUpdateConfigPreservesPitchRingWritePosition() {
        let detector = OnsetDetector()
        detector.configure(config: onsetConfigDefault, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        let signal = [Float](repeating: 0.1, count: 777)
        feed(detector, samples: signal, startTime: 0, into: &messages)

        let posBefore = detector.debugPitchWritePos
        XCTAssertEqual(posBefore, 777, "raw pitch ring write position should advance by sample count")

        detector.updateConfig(OnsetConfigPatch(minOnsetEnergy: 0.02))

        XCTAssertEqual(detector.debugPitchWritePos, posBefore,
                       "the raw pitch ring buffer's write position must survive a config patch")
    }

    func testUpdateConfigPreservesPendingChromaAndItStillFires() {
        let detector = OnsetDetector()
        let config = getInstrumentConfig(.guitar) // analyzeChroma: true
        detector.configure(config: config, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        let signal = quietThenLoudSignal(quietSeconds: 0.3)
        let afterOnsetTime = feed(detector, samples: signal, startTime: 0, into: &messages)

        XCTAssertEqual(onsetTimestamps(messages).count, 1)
        XCTAssertEqual(detector.debugPendingChromaCount, 1,
                       "an onset under analyzeChroma should enqueue exactly one pending chroma")
        XCTAssertFalse(messages.contains { if case .chord = $0 { return true }; return false },
                       "the chord should not have fired yet (the 0.08s chord window hasn't elapsed)")

        // Patch mid-flight — pendingChromas must survive.
        detector.updateConfig(OnsetConfigPatch(adaptiveThresholdMultiplier: 2.0))
        XCTAssertEqual(detector.debugPendingChromaCount, 1, "pendingChromas must survive a config patch")

        // Keep feeding silence past the 0.08s chord window; the preserved entry must still fire.
        var moreMessages: [OnsetDetectorMessage] = []
        let silence = [Float](repeating: 0, count: Int(0.2 * sampleRate))
        feed(detector, samples: silence, startTime: afterOnsetTime, into: &moreMessages)

        let chordFired = moreMessages.contains { if case .chord = $0 { return true }; return false }
        XCTAssertTrue(chordFired, "the pending chroma preserved across updateConfig should still fire")
    }

    func testUpdateConfigResetsAdaptiveHistoryAndPrevMagnitudes() {
        let detector = OnsetDetector()
        detector.configure(config: onsetConfigDefault, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        // Several full analysis frames' worth of signal so energy/flux history + prevMagnitudes get
        // populated (frameSize 1024, hopSize 512 → 1024 + 3*512 gives 4 analyzeFrame calls).
        let sampleCount = onsetConfigDefault.frameSize + 3 * onsetConfigDefault.hopSize
        let signal = (0..<sampleCount).map { Float(0.05 * sin(2 * Double.pi * 300 * Double($0) / sampleRate)) }
        feed(detector, samples: signal, startTime: 0, into: &messages)

        XCTAssertGreaterThan(detector.debugEnergyHistoryCount, 0)
        XCTAssertGreaterThan(detector.debugFluxHistoryCount, 0)
        XCTAssertTrue(detector.debugHasPrevMagnitudes)

        detector.updateConfig(OnsetConfigPatch(adaptiveThresholdMultiplier: 3.0))

        XCTAssertEqual(detector.debugEnergyHistoryCount, 0, "energyHistory must be CLEARED by a config patch")
        XCTAssertEqual(detector.debugFluxHistoryCount, 0, "fluxHistory must be CLEARED by a config patch")
        XCTAssertFalse(detector.debugHasPrevMagnitudes,
                       "prevMagnitudes must be CLEARED (`prevMagnitudes = null`) by a config patch")
    }

    func testUpdateConfigReallocatesFrameBufferOnFrameSizeChange() {
        let detector = OnsetDetector()
        detector.configure(config: onsetConfigDefault, sampleRate: sampleRate) // frameSize 1024

        var messages: [OnsetDetectorMessage] = []
        // A partial frame (not a multiple of frameSize) so bufferIndex is nonzero pre-patch.
        let signal = [Float](repeating: 0.01, count: 300)
        feed(detector, samples: signal, startTime: 0, into: &messages)
        XCTAssertEqual(detector.debugBufferIndex, 300)
        XCTAssertEqual(detector.debugInputBufferSize, 1024)

        detector.updateConfig(OnsetConfigPatch(frameSize: 2048, hopSize: 1024))

        XCTAssertEqual(detector.debugInputBufferSize, 2048, "inputBuffer must be reallocated to the new frameSize")
        XCTAssertEqual(detector.debugBufferIndex, 0, "bufferIndex must reset to 0 on a config patch (frame realloc)")
    }

    // MARK: - Contrast: `configure()` is a FULL reset

    func testConfigureFullyResetsEverythingUnlikeUpdateConfig() {
        let detector = OnsetDetector()
        let config = getInstrumentConfig(.guitar)
        detector.configure(config: config, sampleRate: sampleRate)

        var messages: [OnsetDetectorMessage] = []
        let signal = quietThenLoudSignal(quietSeconds: 0.3)
        feed(detector, samples: signal, startTime: 0, into: &messages)

        XCTAssertGreaterThan(detector.debugEnvelope, 0)
        XCTAssertNotEqual(detector.debugLastOnsetTime, -.infinity)
        XCTAssertEqual(detector.debugPendingChromaCount, 1)

        detector.configure(config: config, sampleRate: sampleRate) // full reset (construct-time semantics)

        XCTAssertEqual(detector.debugEnvelope, 0, "configure() must fully reset envelope")
        XCTAssertEqual(detector.debugLastOnsetTime, -.infinity, "configure() must fully reset lastOnsetTime")
        XCTAssertEqual(detector.debugPendingChromaCount, 0, "configure() must clear pendingChromas")
        XCTAssertEqual(detector.debugBandPassX1, 0)
        XCTAssertEqual(detector.debugBandPassX2, 0)
        XCTAssertEqual(detector.debugBandPassY1, 0)
        XCTAssertEqual(detector.debugBandPassY2, 0)
    }
}
