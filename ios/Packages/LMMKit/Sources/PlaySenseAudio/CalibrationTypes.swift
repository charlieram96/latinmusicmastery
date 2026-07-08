import Foundation

// Port of the calibration data shape in `hooks/use-calibration.ts` (`CalibrationData`,
// `lib/play-sense/types.ts`) plus its three `calibrationError` failure modes.

/// Which pipeline produced a calibration — mirrors the web's separate `playSenseCalibration` (mic) /
/// `playSenseCalibrationBle` (BLE) `localStorage` keys, kept as two independently-stored records here
/// too (`CalibrationStore` keys by this).
public enum CalibrationSourceType: String, Codable, Equatable, Sendable {
    case mic
    case ble
}

/// A completed tap-along calibration — the persisted, per-(source, route) result `CalibrationStore`
/// saves and D23's grading reads back.
///
/// Port of `CalibrationData { latencyMs, iqrMs, sampleRate, browser, timestamp, method }`, with two
/// iOS-specific changes:
/// - `browser` (used only to invalidate mic calibration on a browser change) has no iOS analogue;
///   `routeKey` replaces it as the invalidation key (route hardware — not runtime identity — is what
///   actually determines latency; see `CalibrationStore`).
/// - `widenMs` (`iqrMs > 30 ? 15 : 0`, computed inline at grading time in `use-exercise-session.ts`) is
///   precomputed ONCE here and stored, so D23 reads it directly instead of re-deriving it from `iqrMs`
///   on every grading call — same semantics, simpler consumption.
public struct CalibrationRecord: Codable, Equatable, Sendable {
    /// Median tap offset vs. the nearest expected click, in milliseconds (signed — positive means taps
    /// landed AFTER the click, i.e. capture latency).
    public let offsetMs: Double
    /// Interquartile range of the (outlier-filtered) offsets, in milliseconds — a consistency measure.
    public let iqrMs: Double
    /// Extra tolerance-window widening (ms) to apply at grading time when `iqrMs` indicates a noisy
    /// calibration. `0` unless `iqrMs > 30`, in which case `15` (ported constants).
    public let widenMs: Double
    /// Number of taps that survived the outlier filter and fed the median/IQR.
    public let sampleCount: Int
    public let date: Date
    /// Identifies the audio route this calibration applies to (see `CalibrationStore.routeKey(for:)`).
    public let routeKey: String
    public let sourceType: CalibrationSourceType

    public init(
        offsetMs: Double,
        iqrMs: Double,
        widenMs: Double,
        sampleCount: Int,
        date: Date,
        routeKey: String,
        sourceType: CalibrationSourceType
    ) {
        self.offsetMs = offsetMs
        self.iqrMs = iqrMs
        self.widenMs = widenMs
        self.sampleCount = sampleCount
        self.date = date
        self.routeKey = routeKey
        self.sourceType = sourceType
    }
}

/// Port of `use-calibration.ts`'s three `calibrationError` messages (kept as distinct cases rather than
/// interpolated strings so the wizard UI can localize/style each failure independently).
public enum CalibrationFailure: Equatable, Sendable {
    /// Fewer than `minimum` onsets were detected at all (before the nearest-expected-time match).
    case notEnoughTaps(detected: Int, minimum: Int)
    /// Enough onsets were detected, but fewer than `minimum` landed within the 0.2s validity gate of
    /// their nearest expected click.
    case notEnoughValidTaps(valid: Int, minimum: Int)
    /// Enough valid taps existed, but the IQR×1.5 outlier filter left too few (< 3) to trust a median.
    /// Ported for 1:1 parity with the web's defensive check; see `LatencyCalibrator` doc comment — this
    /// branch is structurally unreachable for `n >= 4` inputs (proven, not just untested) given how the
    /// quartile index positions are computed, so it has no hand-computed test vector.
    case tooInconsistent
}

/// The result of a completed calibration attempt.
public enum CalibrationOutcome: Equatable, Sendable {
    case success(CalibrationRecord)
    case failure(CalibrationFailure)
}
