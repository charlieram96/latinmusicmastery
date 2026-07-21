import Foundation
import XCTest

@testable import PlaySenseAudio
@testable import PlaySenseCore

/// Hand-computed parity vectors for `LatencyCalibrator.compute` — the pure port of
/// `computeCalibration` in `hooks/use-calibration.ts`. Every vector below is worked out by hand in the
/// PR/task report; `expectedTimes` are always `LatencyCalibrator.expectedTimes(t0: 0)` (100 BPM, 0.6s
/// beats) and onsets are built as `expectedTimes[i] + offsetSeconds` so the tests also exercise the
/// nearest-expected-click match, not just quartile arithmetic in isolation.
final class LatencyCalibratorTests: XCTestCase {

    private let t0Seconds = 0.0
    private lazy var expected = LatencyCalibrator.expectedTimes(t0: t0Seconds)

    private func onset(beat: Int, offsetSeconds: Double) -> Double {
        expected[beat] + offsetSeconds
    }

    // MARK: - Vector 1: 4 clean taps, small spread around 30ms — no outliers, no widen

    /// Offsets (ms) at beats 0...3: [28, 29, 31, 32] (deliberately NOT all identical — four
    /// bit-identical doubles make `iqr` compute to exactly 0, which then makes the outlier fence
    /// `[q1, q3]` exact-equality-width and floating-point noise in the nearest-click subtraction can tip
    /// a value a few ULPs outside it; real taps never land on the literal same instant, so a tiny spread
    /// here is the representative case). sorted = same. n=4: q1 = sorted[1] = 29, q3 = sorted[3] = 32,
    /// iqr = 3, lower = 29-4.5 = 24.5, upper = 32+4.5 = 36.5 → nothing excluded.
    /// median (even, n=4) = (sorted[1]+sorted[2])/2 = (29+31)/2 = 30.
    /// fq1 = filtered[1] = 29, fq3 = filtered[3] = 32, finalIqr = 3.
    func testComputeBasicFourTapsSmallSpread() throws {
        let offsetsMs: [Double] = [28, 29, 31, 32]
        let onsets = offsetsMs.enumerated().map { index, offsetMs in
            onset(beat: index, offsetSeconds: offsetMs / 1000)
        }
        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        guard case let .success(record) = outcome else {
            return XCTFail("expected success, got \(outcome)")
        }
        XCTAssertEqual(record.offsetMs, 30, accuracy: 1e-9)
        XCTAssertEqual(record.iqrMs, 3, accuracy: 1e-9)
        XCTAssertEqual(record.widenMs, 0)
        XCTAssertEqual(record.sampleCount, 4)
        XCTAssertEqual(record.routeKey, "route")
        XCTAssertEqual(record.sourceType, .mic)
    }

    // MARK: - Vector 2: one outlier excluded by IQR×1.5, no widen

    /// Offsets (ms) at beats 0...5: [20, 22, 25, 28, 30, 90].
    /// sorted = same (already ascending). n=6: q1 = sorted[floor(6*0.25)] = sorted[1] = 22,
    /// q3 = sorted[floor(6*0.75)] = sorted[4] = 30, iqr = 8, lower = 22-12 = 10, upper = 30+12 = 42.
    /// filtered = [20,22,25,28,30] (90 excluded, > 42). median (odd, n=5) = filtered[2] = 25.
    /// fq1 = filtered[floor(5*0.25)] = filtered[1] = 22, fq3 = filtered[floor(5*0.75)] = filtered[3] = 28,
    /// finalIqr = 6.
    func testComputeExcludesSingleOutlierByIQR() throws {
        let onsets = [
            onset(beat: 0, offsetSeconds: 0.020),
            onset(beat: 1, offsetSeconds: 0.022),
            onset(beat: 2, offsetSeconds: 0.025),
            onset(beat: 3, offsetSeconds: 0.028),
            onset(beat: 4, offsetSeconds: 0.030),
            onset(beat: 5, offsetSeconds: 0.090)
        ]
        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        guard case let .success(record) = outcome else {
            return XCTFail("expected success, got \(outcome)")
        }
        XCTAssertEqual(record.offsetMs, 25, accuracy: 1e-9)
        XCTAssertEqual(record.iqrMs, 6, accuracy: 1e-9)
        XCTAssertEqual(record.widenMs, 0)
        XCTAssertEqual(record.sampleCount, 5, "the 90ms outlier must be excluded from the final sample count")
    }

    // MARK: - Vector 3: high natural spread (no single outlier) — triggers widenMs=15

    /// Offsets (ms) at beats 0...7: [-40,-30,-10,0,10,30,50,60]. n=8:
    /// q1 = sorted[floor(8*0.25)] = sorted[2] = -10, q3 = sorted[floor(8*0.75)] = sorted[6] = 50,
    /// iqr = 60, lower = -10-90 = -100, upper = 50+90 = 140 → nothing excluded (all within bounds).
    /// median (even, n=8) = (sorted[3]+sorted[4])/2 = (0+10)/2 = 5.
    /// fq1 = filtered[2] = -10, fq3 = filtered[6] = 50, finalIqr = 60 (> 30 ⇒ widenMs = 15).
    func testComputeHighSpreadTriggersWiden() throws {
        let offsetsMs: [Double] = [-40, -30, -10, 0, 10, 30, 50, 60]
        let onsets = offsetsMs.enumerated().map { index, offsetMs in
            onset(beat: index, offsetSeconds: offsetMs / 1000)
        }
        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        guard case let .success(record) = outcome else {
            return XCTFail("expected success, got \(outcome)")
        }
        XCTAssertEqual(record.offsetMs, 5, accuracy: 1e-9)
        XCTAssertEqual(record.iqrMs, 60, accuracy: 1e-9)
        XCTAssertEqual(record.widenMs, 15, "iqrMs (60) > 30 must set widenMs to 15")
        XCTAssertEqual(record.sampleCount, 8)
    }

    // MARK: - Validity gate: a tap too far from any expected click is discarded, not just down-weighted

    func testValidityGateDropsTapFarFromNearestClick() throws {
        // [8, 9, 11, 12]ms — small spread (see the vector-1 comment on why not 4 identical values).
        var onsets = [
            onset(beat: 0, offsetSeconds: 0.008),
            onset(beat: 1, offsetSeconds: 0.009),
            onset(beat: 2, offsetSeconds: 0.011),
            onset(beat: 3, offsetSeconds: 0.012)
        ]
        // Exactly midway between beat 4 (2.4s) and beat 5 (3.0s) — 0.3s from its nearest click, over the
        // 0.2s validity gate, so it must be dropped rather than perturb the median.
        onsets.append((expected[4] + expected[5]) / 2)

        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        guard case let .success(record) = outcome else {
            return XCTFail("expected success, got \(outcome)")
        }
        XCTAssertEqual(record.offsetMs, 10, accuracy: 1e-9)
        XCTAssertEqual(record.iqrMs, 3, accuracy: 1e-9)
        XCTAssertEqual(record.sampleCount, 4, "the out-of-gate onset must not count toward the sample")
    }

    // MARK: - Failure paths

    func testFewerThanFourRawOnsetsFails() {
        let onsets = [
            onset(beat: 0, offsetSeconds: 0),
            onset(beat: 1, offsetSeconds: 0),
            onset(beat: 2, offsetSeconds: 0)
        ]
        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        XCTAssertEqual(outcome, .failure(.notEnoughTaps(detected: 3, minimum: 4)))
    }

    func testFourRawOnsetsAllOutsideValidityGateFails() {
        // Each 250ms from its nearest expected click — over the 0.2s gate, so ALL are discarded even
        // though 4 raw onsets were detected.
        let onsets = [
            onset(beat: 0, offsetSeconds: 0.25),
            onset(beat: 1, offsetSeconds: 0.25),
            onset(beat: 2, offsetSeconds: 0.25),
            onset(beat: 3, offsetSeconds: 0.25)
        ]
        let outcome = LatencyCalibrator.compute(
            expectedTimes: expected, onsetTimestamps: onsets, routeKey: "route", sourceType: .mic
        )
        XCTAssertEqual(outcome, .failure(.notEnoughValidTaps(valid: 0, minimum: 4)))
    }

    // MARK: - Expected-times generation

    func testExpectedTimesAreSixteenBeatsAt100BPM() {
        let times = LatencyCalibrator.expectedTimes(t0: 10.0)
        XCTAssertEqual(times.count, 16)
        XCTAssertEqual(times.first, 10.0)
        XCTAssertEqual(times.last!, 10.0 + 15 * 0.6, accuracy: 1e-9)
        XCTAssertEqual(LatencyCalibrator.beatDuration, 0.6, accuracy: 1e-9)
    }
}
