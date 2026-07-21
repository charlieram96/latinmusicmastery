import XCTest

@testable import PlaySenseAudio
import PlaySenseCore

/// Unit coverage for the D23 fix-round-1 live pitch/chroma wiring at the mic-source seam. The message
/// mapping (`.onset` → `OnsetEvent` w/ frequency, `.chord` → keyed chroma store, `.level` → dropped) is
/// driven directly through the internal ``MicOnsetEventSource/handle(_:)`` seam, so it needs no live
/// `AVAudioEngine`. The `currentPitch()` re-read through the real tap is exercised by the detector-level
/// test below (`OnsetDetectorCurrentPitchTests`) plus the gated live-mic smoke posture (`RUN_AUDIO_SMOKE`).
@MainActor
final class MicOnsetEventSourceTests: XCTestCase {

    private func makeSource() -> MicOnsetEventSource {
        let engine = GameAudioEngine(sampleRate: 48_000)
        return MicOnsetEventSource(engine: engine, config: getInstrumentConfig(.guitar))
    }

    func testOnsetMessageForwardsFrequencyIntoOnsetEvent() {
        let source = makeSource()
        var received: OnsetEvent?
        source.onOnset = { received = $0 }

        source.handle(.onset(timestamp: 12.5, energy: 0.7, fluxConfirmed: true, frequency: 261.63))

        XCTAssertEqual(received?.timestamp, 12.5)
        XCTAssertEqual(received?.energy ?? 0, 0.7, accuracy: 1e-9)
        XCTAssertEqual(received?.frequency ?? 0, 261.63, accuracy: 1e-9,
                       "the detector's onset frequency must survive into the forwarded OnsetEvent")
    }

    func testChordMessageIsStoredKeyedByRoundedOnsetMilliseconds() {
        let source = makeSource()
        var chroma = [Double](repeating: 0, count: 12)
        chroma[0] = 1.0
        chroma[4] = 0.5

        let onsetTimestamp = 3.1417
        source.handle(.chord(onsetTimestamp: onsetTimestamp, chroma: chroma))

        // The key `LiveScorer.chromaProvider` looks up is `round(onsetTimestamp * 1000)`.
        let expectedKey = Int((onsetTimestamp * 1000).rounded())
        XCTAssertEqual(source.chroma(forOnsetKey: expectedKey), chroma)
        XCTAssertNil(source.chroma(forOnsetKey: expectedKey + 1), "only the exact rounded-ms key resolves")
    }

    func testLevelMessageIsDropped() {
        let source = makeSource()
        var onsetFired = false
        source.onOnset = { _ in onsetFired = true }

        source.handle(.level(0.42))

        XCTAssertFalse(onsetFired)
        XCTAssertNil(source.chroma(forOnsetKey: 0))
    }

    func testChromaStoreEvictsOldestBeyondCapacity() {
        let source = makeSource()
        // Push 70 distinct chroma entries (cap is 64); the oldest 6 keys must have been evicted.
        for index in 0..<70 {
            var chroma = [Double](repeating: 0, count: 12)
            chroma[index % 12] = 1.0
            source.handle(.chord(onsetTimestamp: Double(index), chroma: chroma))
        }
        XCTAssertNil(source.chroma(forOnsetKey: 0), "oldest entry evicted past the 64-entry cap")
        XCTAssertNil(source.chroma(forOnsetKey: 5_000), "sixth-oldest entry evicted")
        XCTAssertNotNil(source.chroma(forOnsetKey: 6_000), "key round(6*1000) still present")
        XCTAssertNotNil(source.chroma(forOnsetKey: 69_000), "newest entry present")
    }

    // MARK: - Pre-filtering (no main-actor hop for `.level`)

    /// `GameAudioEngine`/`MicTap` are concrete, hardware-backed types with no synthetic-message injection
    /// seam, so there's no way to drive `start()` itself through a counting executor or hop-counter and
    /// observe actor hops directly in a fast unit test. Instead this asserts against
    /// `needsMainActorHop(_:)` — the exact predicate `start()`'s `installMicTap` callback evaluates, on the
    /// drain queue, before ever constructing a `Task`. If `.level` ever starts requiring a hop again (or
    /// `.onset`/`.chord` stop requiring one), this fails.
    func testLevelMessageNeverRequiresMainActorHop() {
        XCTAssertFalse(MicOnsetEventSource.needsMainActorHop(.level(0.42)),
                       "`.level` fires ~375/sec and is unused here — it must be filtered before any Task hop")
    }

    func testOnsetAndChordMessagesRequireMainActorHop() {
        XCTAssertTrue(
            MicOnsetEventSource.needsMainActorHop(.onset(timestamp: 0, energy: 0, fluxConfirmed: true, frequency: nil))
        )
        XCTAssertTrue(MicOnsetEventSource.needsMainActorHop(.chord(onsetTimestamp: 0, chroma: [])))
    }
}

/// Detector-level coverage of the on-demand ``OnsetDetector/currentPitch()`` re-read that backs
/// `pitchFrequencyProvider` — no hardware needed: feed a synthetic sustained tone and confirm the ring
/// re-read recovers its fundamental.
final class OnsetDetectorCurrentPitchTests: XCTestCase {

    func testCurrentPitchRecoversSustainedTonePeriodicity() {
        let sampleRate = 48_000.0
        let detector = OnsetDetector()
        detector.configure(config: getInstrumentConfig(.guitar), sampleRate: sampleRate)

        // ~125 ms of a 220 Hz tone (A3) with harmonics — comfortably more than the 4096-sample pitch ring.
        let fundamental = 220.0
        let total = 6000
        var samples = [Float](repeating: 0, count: total)
        for index in 0..<total {
            let phase = 2 * Double.pi * fundamental * Double(index) / sampleRate
            samples[index] = Float(0.3 * sin(phase) + 0.15 * sin(2 * phase) + 0.08 * sin(3 * phase))
        }

        var blockTime = 0.0
        var idx = 0
        while idx < total {
            let len = min(128, total - idx)
            detector.process(Array(samples[idx..<(idx + len)]), blockTime: blockTime) { _ in }
            blockTime += Double(len) / sampleRate
            idx += len
        }

        let pitch = detector.currentPitch()
        XCTAssertNotNil(pitch, "a sustained tone must yield a confident on-demand pitch read")
        // NAC is octave/subharmonic-ambiguous on a perfectly stationary synthetic tone — the D21 reference
        // itself latches `sine_pitch_default`'s 220 Hz sine down to 110 Hz. So we assert the on-demand
        // re-read recovers the tone's PERIODICITY (an integer submultiple of the fundamental) — a strong,
        // garbage-rejecting check — not an exact octave. Grading-value pitch accuracy is covered by the
        // onset goldens; this test's job is to prove the on-demand ring re-read runs and detects.
        if let pitch {
            let nearestMultiple = (fundamental / pitch).rounded()
            XCTAssertGreaterThanOrEqual(nearestMultiple, 1, "detected pitch is at or below the fundamental")
            XCTAssertEqual(pitch * nearestMultiple, fundamental, accuracy: 3.0,
                           "the on-demand re-read locks onto the 220 Hz periodicity (at some octave)")
        }
    }

    func testCurrentPitchIsNilForSilence() {
        let detector = OnsetDetector()
        detector.configure(config: getInstrumentConfig(.guitar), sampleRate: 48_000)
        for _ in 0..<50 { detector.process([Float](repeating: 0, count: 128), blockTime: 0) { _ in } }
        XCTAssertNil(detector.currentPitch(), "silence yields no confident pitch (the detector's RMS gate)")
    }
}
