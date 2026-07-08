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
///
/// `schemaVersion` is embedded in the encoded PAYLOAD (not the `CalibrationStore` key) so a future shape
/// change can be detected without touching the keying/invalidation scheme at all. A custom
/// `init(from:)` treats a MISSING `schemaVersion` key as legacy `1` (the only shape this type ever had
/// before the key was added), so already-persisted records keep decoding rather than being wiped by this
/// very fix; a blob that fails to decode for any OTHER reason (corrupt bytes, wrong types, a future
/// schema this build doesn't understand) is `CalibrationStore`'s job to detect and remove — see its
/// decode-fallback cleanup in `load`/`allRecords`.
public struct CalibrationRecord: Codable, Equatable, Sendable {
    /// This type's current encoded shape. Bump when a change could break decoding an already-persisted
    /// record.
    public static let currentSchemaVersion = 1

    public let schemaVersion: Int
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
        sourceType: CalibrationSourceType,
        schemaVersion: Int = CalibrationRecord.currentSchemaVersion
    ) {
        self.schemaVersion = schemaVersion
        self.offsetMs = offsetMs
        self.iqrMs = iqrMs
        self.widenMs = widenMs
        self.sampleCount = sampleCount
        self.date = date
        self.routeKey = routeKey
        self.sourceType = sourceType
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion, offsetMs, iqrMs, widenMs, sampleCount, date, routeKey, sourceType
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Legacy (pre-fix) records have no `schemaVersion` key at all — treat that as `1`, not a decode
        // failure, so this fix doesn't silently discard every calibration a user already has stored.
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
        offsetMs = try container.decode(Double.self, forKey: .offsetMs)
        iqrMs = try container.decode(Double.self, forKey: .iqrMs)
        widenMs = try container.decode(Double.self, forKey: .widenMs)
        sampleCount = try container.decode(Int.self, forKey: .sampleCount)
        date = try container.decode(Date.self, forKey: .date)
        routeKey = try container.decode(String.self, forKey: .routeKey)
        sourceType = try container.decode(CalibrationSourceType.self, forKey: .sourceType)
    }
}

/// Why a calibration take was aborted mid-flight by an audio-session disruption rather than allowed to
/// silently "complete" (and become persistable) from a partial recording — surfaced by
/// `CalibrationSession.interrupt(reason:)` (driven by `CalibrationRunner`, in response to
/// `AudioSessionController.onEvent`/SwiftUI `scenePhase`) so the wizard can show honest, specific
/// messaging instead of a generic error.
public enum CalibrationInterruptionReason: Equatable, Sendable {
    /// A system audio interruption began (phone call, another app taking over the audio session, etc).
    case audioInterruption
    /// The audio route changed mid-take (headphones plugged/unplugged, AirPlay, etc). Because
    /// `CalibrationStore` is route-keyed, the take's `routeKey` no longer describes the LIVE route —
    /// retrying must restart from the intro screen (which re-reads the current route), not resume the
    /// same take.
    case routeChanged
    /// The app was backgrounded (SwiftUI `scenePhase` → `.background`) while a take was in progress.
    case backgrounded
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
