import Foundation

// Port of `hooks/use-calibration.ts`'s tap-along calibration math (`computeCalibration` +
// `startCalibration`'s scheduling constants). All timestamps here are host-seconds (see the
// "one-clock simplification" note below) — the SAME clock `T0Anchor.hostSeconds` and D21's
// `OnsetEvent.timestamp` already share, so unlike the web there is no clock-domain bridge to build.
//
// ## The one-clock simplification
// The web hook runs on TWO clocks: `AudioContext.currentTime` (what the metronome is scheduled against
// and what the mic worklet stamps onsets with) and `performance.now()` (what a BLE hit callback is
// stamped with, off the Web Audio graph entirely). `startCalibration` has to sample
// `performToAudioOffsetRef = performance.now()/1000 - audioContext.currentTime` once at the start of a
// BLE calibration and use it to convert every BLE timestamp into AudioContext seconds before it can be
// compared against the scheduled click times.
//
// iOS has exactly one clock end-to-end: `GameClock`'s host-seconds domain. `GameAudioEngine.start`
// resolves `t0` in host-seconds (`T0Anchor.hostSeconds`), the metronome is scheduled from that same
// anchor, and D21's `OnsetDetector`/`MicTap` stamp every onset via `GameClock.hostSeconds(fromTicks:)` —
// literally the same conversion function, not just the same units. D25's BLE hits are expected to do the
// same (stamp with `GameClock.hostSeconds(fromTicks:)` at receipt), so `LatencyCalibrator` takes plain
// `Double` host-second timestamps with NO per-source clock bridge — the offset-vs-BLE-bridge machinery in
// `use-calibration.ts` simply has no iOS analogue to port.

/// Pure tap-along latency calibration math — a 1:1 port of `computeCalibration` (plus the scheduling
/// constants `startCalibration` uses) from `hooks/use-calibration.ts`. No engine/mic/timer state lives
/// here; `CalibrationSession` (the wizard state machine) and `CalibrationRunner` (the engine glue) are
/// built on top of this.
public enum LatencyCalibrator {
    /// Port of `CALIBRATION_BPM`.
    public static let bpm: Double = 100
    /// Fixed 4-beat count-in (not itself a named web constant, but hard-coded identically in
    /// `startCalibration`'s scheduling: `4 * beatDuration`).
    public static let countInBeats = 4
    /// Port of `CALIBRATION_BEATS`.
    public static let measuredBeats = 16

    /// Onsets farther than this from their nearest expected click (seconds) are discarded before the
    /// median/IQR — port of the inline `Math.abs(bestOffset) < 0.2` gate.
    static let validityGateSeconds = 0.2
    /// Port of the inline `1.5` outlier-fence multiplier.
    static let outlierMultiplier = 1.5
    /// Port of the inline `onsets.length < 4` / `offsets.length < 4` minimums.
    static let minValidTaps = 4
    /// Port of the inline `filtered.length < 3` minimum.
    static let minFilteredTaps = 3
    /// Port of `use-exercise-session.ts`'s inline `iqrMs > 30 ? 15 : 0`.
    static let iqrWidenThresholdMs = 30.0
    static let widenAmountMs = 15.0

    /// Beat duration at the fixed calibration tempo.
    public static var beatDuration: Double { 60.0 / bpm }

    /// The expected (host-seconds) click times for the `measuredBeats` recording beats, given `t0` (the
    /// first measured beat's host-seconds instant — the count-in precedes it at negative offsets, per
    /// `MetronomeSchedule`'s existing convention).
    public static func expectedTimes(t0 t0Seconds: Double) -> [Double] {
        (0..<measuredBeats).map { t0Seconds + Double($0) * beatDuration }
    }

    /// Pure computation — port of `computeCalibration`. `onsetTimestamps` and every value in
    /// `expectedTimes` are host-seconds.
    public static func compute(
        expectedTimes: [Double],
        onsetTimestamps: [Double],
        routeKey: String,
        sourceType: CalibrationSourceType,
        date: Date = Date()
    ) -> CalibrationOutcome {
        guard onsetTimestamps.count >= minValidTaps else {
            return .failure(.notEnoughTaps(detected: onsetTimestamps.count, minimum: minValidTaps))
        }

        // For each onset, find its NEAREST expected click (by absolute distance, first-wins on an exact
        // tie — matches the web's `dist < minDist` strict comparison) and keep the SIGNED offset if it's
        // within the validity gate.
        var offsetsMs: [Double] = []
        for onset in onsetTimestamps {
            var minDist = Double.infinity
            var bestOffset = 0.0
            for expected in expectedTimes {
                let dist = abs(onset - expected)
                if dist < minDist {
                    minDist = dist
                    bestOffset = onset - expected
                }
            }
            if abs(bestOffset) < validityGateSeconds {
                offsetsMs.append(bestOffset * 1000)
            }
        }

        guard offsetsMs.count >= minValidTaps else {
            return .failure(.notEnoughValidTaps(valid: offsetsMs.count, minimum: minValidTaps))
        }

        let sorted = offsetsMs.sorted()
        let lowerQuartile = quartile(sorted, 0.25)
        let upperQuartile = quartile(sorted, 0.75)
        let iqr = upperQuartile - lowerQuartile
        let lower = lowerQuartile - outlierMultiplier * iqr
        let upper = upperQuartile + outlierMultiplier * iqr
        let filtered = sorted.filter { $0 >= lower && $0 <= upper }

        guard filtered.count >= minFilteredTaps else {
            return .failure(.tooInconsistent)
        }

        let mid = filtered.count / 2
        let median = filtered.count % 2 == 0 ? (filtered[mid - 1] + filtered[mid]) / 2 : filtered[mid]
        let finalIqr = quartile(filtered, 0.75) - quartile(filtered, 0.25)

        let offsetMs = jsRound(median * 100) / 100
        let iqrMs = jsRound(finalIqr * 100) / 100
        let widenMs = iqrMs > iqrWidenThresholdMs ? widenAmountMs : 0

        return .success(CalibrationRecord(
            offsetMs: offsetMs,
            iqrMs: iqrMs,
            widenMs: widenMs,
            sampleCount: filtered.count,
            date: date,
            routeKey: routeKey,
            sourceType: sourceType
        ))
    }

    /// `sorted[Math.floor(sorted.length * fraction)]` — the web's ad hoc quartile index (not the more
    /// common `(n-1)*fraction` interpolated definition; ported verbatim since it changes which exact tap
    /// value the median/IQR land on).
    private static func quartile(_ sorted: [Double], _ fraction: Double) -> Double {
        let index = Int((Double(sorted.count) * fraction).rounded(.down))
        return sorted[index]
    }
}

/// Replica of JavaScript's `Math.round` (halves toward +∞) — every rounding site ported from
/// `lib/play-sense` uses this, not Swift's `rounded()` (halves away from zero). Duplicated per-module
/// (see `OnsetDetector.swift`'s copy) since `PlaySenseCore`'s is not public across modules.
private func jsRound(_ value: Double) -> Double {
    guard value.isFinite else { return value }
    let floorValue = value.rounded(.down)
    let fraction = value - floorValue
    return fraction < 0.5 ? floorValue : floorValue + 1
}
