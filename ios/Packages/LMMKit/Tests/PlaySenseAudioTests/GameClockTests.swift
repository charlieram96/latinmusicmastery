import AVFoundation
import XCTest

@testable import PlaySenseAudio

/// Pure host-time ⇄ sample-time conversion math, exercised with synthetic timebases and anchors so the
/// assertions do not depend on the test host's actual `mach_timebase_info`.
final class GameClockTests: XCTestCase {

    // Apple-silicon-like ratio (1 tick ≈ 41.667 ns) and the Intel identity ratio.
    private let appleSilicon = HostTimebase(numer: 125, denom: 3)
    private let identity = HostTimebase(numer: 1, denom: 1)

    func testTicksSecondsRoundTrip() {
        // Realistic timebases only (1 tick ≪ the intervals under test); a coarse ratio like
        // 1 tick = 1 s cannot represent 5 ms and is not a real platform value.
        for candidate in [identity, appleSilicon, HostTimebase(numer: 3, denom: 125)] {
            for seconds in [0.0, 0.005, 0.25, 1.0, 3.14159, 120.0] {
                let ticks = candidate.ticks(fromSeconds: seconds)
                let back = candidate.seconds(fromTicks: ticks)
                XCTAssertEqual(back, seconds, accuracy: 1e-6, "round-trip \(seconds)s on \(candidate)")
            }
        }
    }

    func testIdentityTimebaseTicksAreNanoseconds() {
        XCTAssertEqual(identity.ticks(fromSeconds: 1.0), 1_000_000_000)
        XCTAssertEqual(identity.seconds(fromTicks: 500_000_000), 0.5, accuracy: 1e-12)
    }

    func testSignedSecondsHandlesBothDirections() {
        XCTAssertEqual(GameClock.signedSeconds(from: 1000, to: 3000, timebase: identity),
                       2000.0 / 1e9, accuracy: 1e-15)
        XCTAssertEqual(GameClock.signedSeconds(from: 3000, to: 1000, timebase: identity),
                       -2000.0 / 1e9, accuracy: 1e-15)
        XCTAssertEqual(GameClock.signedSeconds(from: 5, to: 5, timebase: identity), 0)
    }

    func testOutputSampleTimeFromAnchor() {
        // Anchor: sample 10_000 at host tick 1_000_000_000 (identity → 1.0 s), 48 kHz.
        let anchor = RenderAnchor(hostTicks: 1_000_000_000, sampleTime: 10_000, sampleRate: 48_000)
        // 0.5 s later → +24_000 samples.
        let laterTicks = anchor.hostTicks + identity.ticks(fromSeconds: 0.5)
        let sample = GameClock.outputSampleTime(forHostTicks: laterTicks, anchor: anchor, timebase: identity)
        XCTAssertEqual(sample, 34_000, accuracy: 1e-6)

        // 0.25 s earlier → −12_000 samples.
        let earlierTicks = anchor.hostTicks - identity.ticks(fromSeconds: 0.25)
        let earlier = GameClock.outputSampleTime(forHostTicks: earlierTicks, anchor: anchor, timebase: identity)
        XCTAssertEqual(earlier, -2_000, accuracy: 1e-6)
    }

    func testHostTicksSampleTimeInverse() {
        let anchor = RenderAnchor(hostTicks: 2_000_000_000, sampleTime: 5_000, sampleRate: 44_100)
        for targetSample in [5_000.0, 27_050.0, 100_000.0, 1_000.0] {
            let host = GameClock.hostTicks(forSampleTime: targetSample, anchor: anchor, timebase: appleSilicon)
            let back = GameClock.outputSampleTime(forHostTicks: host, anchor: anchor, timebase: appleSilicon)
            XCTAssertEqual(back, targetSample, accuracy: 1.0, "sample↔host inverse for \(targetSample)")
        }
    }

    func testResolveT0PopulatesBothCoordinates() {
        let anchor = RenderAnchor(hostTicks: 1_000_000_000, sampleTime: 0, sampleRate: 48_000)
        let targetTicks = anchor.hostTicks + identity.ticks(fromSeconds: 0.2) // 200 ms ahead
        let resolved = GameClock.resolveT0(atHostTicks: targetTicks, anchor: anchor, timebase: identity)
        XCTAssertEqual(resolved.hostTicks, targetTicks)
        XCTAssertEqual(resolved.hostSeconds, identity.seconds(fromTicks: targetTicks), accuracy: 1e-9)
        XCTAssertEqual(resolved.outputSampleTime, 9_600) // 0.2 s × 48 kHz
        XCTAssertEqual(resolved.sampleRate, 48_000)
    }

    func testAVAudioTimeRenderAnchorRequiresBothDomains() {
        let sampleOnly = AVAudioTime(sampleTime: 100, atRate: 48_000)
        XCTAssertNil(sampleOnly.renderAnchor, "sample-only AVAudioTime is not a full anchor")

        let both = AVAudioTime(hostTime: 123_456, sampleTime: 789, atRate: 48_000)
        let anchor = both.renderAnchor
        XCTAssertEqual(anchor?.hostTicks, 123_456)
        XCTAssertEqual(anchor?.sampleTime, 789)
        XCTAssertEqual(anchor?.sampleRate, 48_000)
    }

    func testAVAudioTimeOffsetHostDomain() {
        let base = AVAudioTime(hostTime: 1_000_000)
        let offset = base.offset(bySeconds: 0.5, timebase: identity)
        XCTAssertTrue(offset.isHostTimeValid)
        XCTAssertEqual(offset.hostTime, 1_000_000 + identity.ticks(fromSeconds: 0.5))
    }

    func testAVAudioTimeOffsetSampleDomainForOfflineRendering() {
        let base = AVAudioTime(sampleTime: 2_000, atRate: 48_000)
        let offset = base.offset(bySeconds: -0.01) // −10 ms → −480 frames
        XCTAssertFalse(offset.isHostTimeValid)
        XCTAssertTrue(offset.isSampleTimeValid)
        XCTAssertEqual(offset.sampleTime, 2_000 - 480)
    }
}
