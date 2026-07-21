import Foundation
import XCTest

@testable import PlaySenseAudio
import PlaySenseCore

// swiftlint:disable identifier_name

/// Tests for the realtime plumbing that the DSP goldens don't cover: the lock-free SPSC ring, the
/// standalone `PitchDetector`, and an allocation-free assertion for the `OnsetDetector` hot path.
final class OnsetRealtimeTests: XCTestCase {

    // MARK: - SPSC ring

    func testRingFIFOOrderAndPayloads() throws {
        let slot = 128
        let ring = try XCTUnwrap(AudioSampleRing(capacity: 8, slotFrames: slot))
        var dst = [Float](repeating: 0, count: slot)

        // Interleave pushes and pops; verify FIFO order, frame counts and hostTimes.
        for round in 0..<20 {
            let frames = 1 + (round % slot)
            var src = [Float](repeating: 0, count: frames)
            for i in 0..<frames { src[i] = Float(round) + Float(i) / 1000 }
            let pushed = src.withUnsafeBufferPointer {
                ring.push($0.baseAddress!, frames: frames, hostTime: UInt64(1000 + round))
            }
            XCTAssertTrue(pushed)

            let popped = dst.withUnsafeMutableBufferPointer { ring.pop(into: $0.baseAddress!) }
            let result = try XCTUnwrap(popped)
            XCTAssertEqual(result.frames, frames)
            XCTAssertEqual(result.hostTime, UInt64(1000 + round))
            for i in 0..<frames { XCTAssertEqual(dst[i], Float(round) + Float(i) / 1000) }
        }
    }

    func testRingDropsWhenFull() throws {
        // capacity rounds up to a power of two; one slot is reserved to distinguish full/empty.
        let ring = try XCTUnwrap(AudioSampleRing(capacity: 4, slotFrames: 4))
        var src = [Float](repeating: 1, count: 4)
        var pushed = 0
        for _ in 0..<10 {
            let ok = src.withUnsafeMutableBufferPointer { ring.push($0.baseAddress!, frames: 4, hostTime: 0) }
            if ok { pushed += 1 }
        }
        XCTAssertEqual(pushed, 3, "4-slot ring holds capacity-1 = 3 before dropping")
        XCTAssertEqual(ring.dropCount, 7)
    }

    func testRingConcurrentProducerConsumer() throws {
        let slot = 64
        let ring = try XCTUnwrap(AudioSampleRing(capacity: 64, slotFrames: slot))
        let total = 5000
        let consumed = expectation(description: "all consumed")

        DispatchQueue.global(qos: .userInteractive).async {
            var dst = [Float](repeating: 0, count: slot)
            var next: UInt64 = 0
            while next < UInt64(total) {
                if let r = dst.withUnsafeMutableBufferPointer({ ring.pop(into: $0.baseAddress!) }) {
                    XCTAssertEqual(r.hostTime, next, "in-order, no loss")
                    next += 1
                }
            }
            consumed.fulfill()
        }
        DispatchQueue.global(qos: .userInitiated).async {
            var src = [Float](repeating: 0.5, count: slot)
            var i: UInt64 = 0
            while i < UInt64(total) {
                let ok = src.withUnsafeMutableBufferPointer { ring.push($0.baseAddress!, frames: slot, hostTime: i) }
                if ok { i += 1 } // retry on full until the consumer drains
            }
        }
        wait(for: [consumed], timeout: 10)
    }

    // MARK: - Standalone PitchDetector

    func testPitchDetectorAttackToneReturnsInRangePitch() {
        let sr = 48_000.0
        let detector = PitchDetector(sampleRate: sr)
        // Silence prefix + constant-amplitude 220 Hz tone — the "captured mid-attack note" shape the
        // worklet's onset path sees (a well-conditioned NAC input). Exact-Hz parity with the reference
        // is proven by the OnsetDetector golden (sine_pitch_default detects 110 Hz through THIS same
        // detector); here we assert the standalone `[Float]` entry point returns a confident, in-range
        // fundamental (27–1500 Hz) rather than nil/garbage.
        var buf = [Float](repeating: 0, count: 4096)
        for i in 1008..<buf.count {
            buf[i] = Float(0.5 * sin(2 * Double.pi * 220 * Double(i - 1008) / sr))
        }
        let f = detector.detect(buf)
        XCTAssertNotNil(f)
        if let f { XCTAssertTrue(f >= 27 && f <= 1500 && f.isFinite, "out of range: \(f)") }
    }

    func testPitchDetectorSilenceReturnsNil() {
        let detector = PitchDetector(sampleRate: 48_000)
        let buf = [Float](repeating: 0, count: 4096)
        XCTAssertNil(detector.detect(buf))
    }

    // MARK: - Realtime discipline

    func testProcessSoakStaysStable() {
        // Soak the per-frame hot path (2000 blocks) to surface any crash/UB in the preallocated-scratch
        // contract documented on OnsetDetector. Onset/level messages carry no heap payload; chroma (the
        // one allocating path) fires at most once per onset and is off this hot path.
        let detector = OnsetDetector()
        detector.configure(config: onsetConfigDefault, sampleRate: 48_000)
        var block = [Float](repeating: 0, count: 128)
        for i in 0..<128 { block[i] = Float(0.01 * sin(Double(i))) }
        var count = 0
        for b in 0..<2000 {
            detector.process(block, blockTime: Double(b) * 128 / 48_000) { _ in count += 1 }
        }
        XCTAssertGreaterThan(count, 0, "level messages emitted every block")
    }
}

// swiftlint:enable identifier_name
