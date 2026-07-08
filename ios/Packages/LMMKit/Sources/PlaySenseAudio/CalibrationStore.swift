import Foundation

/// `UserDefaults`-backed persistence for ``CalibrationRecord``s, keyed by `(sourceType, routeKey)` — the
/// iOS analogue of the web's `playSenseCalibration` / `playSenseCalibrationBle` `localStorage` entries.
///
/// ## Keying / invalidation
/// The web keys by source only and separately invalidates the mic record if `navigator.userAgent`
/// changed (a coarse "did the environment change" signal — there is no in-browser way to detect an
/// actual route/device change). iOS has a precise signal instead: `AudioSessionController.currentRouteInfo`
/// (input+output port types/names). `routeKey(for:)` folds the ENTIRE route into the storage key, so a
/// route change (new headphones, BLE mic, etc.) naturally reads back `nil` for the new key — there is no
/// separate "invalidate" step to run, storing under a route-scoped key IS the invalidation.
///
/// ## Schema versioning
/// `CalibrationRecord.schemaVersion` lives in the encoded PAYLOAD, not the key. `load`/`allRecords`
/// treat any blob that fails to decode (corrupt, wrong shape, or a future schema this build doesn't
/// understand) as unreadable and remove it — a legacy pre-versioning record with no `schemaVersion` key
/// at all is NOT one of those (see `CalibrationRecord.init(from:)`); it still decodes as `1`.
public enum CalibrationStore {
    private static let keyPrefix = "com.lmm.playsense.calibration."

    // MARK: - Keying

    /// A stable identifier for a route, built from its port types + names (order-preserving — a
    /// different port ORDER is, in practice, a different route configuration too).
    public static func routeKey(for route: RouteInfo) -> String {
        let inputs = route.inputs.map { "\($0.portType):\($0.portName)" }.joined(separator: "|")
        let outputs = route.outputs.map { "\($0.portType):\($0.portName)" }.joined(separator: "|")
        return "in[\(inputs)]_out[\(outputs)]"
    }

    /// `internal` (not `private`) specifically so `@testable`-imported tests can reconstruct the exact
    /// key a legacy/corrupt blob would live under (see `CalibrationStoreTests`'s decode-fallback and
    /// schema-version tests) — still not exposed as part of this module's PUBLIC API.
    static func storageKey(sourceType: CalibrationSourceType, routeKey: String) -> String {
        "\(keyPrefix)\(sourceType.rawValue).\(routeKey)"
    }

    // MARK: - CRUD

    public static func save(_ record: CalibrationRecord, defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(record) else { return }
        defaults.set(data, forKey: storageKey(sourceType: record.sourceType, routeKey: record.routeKey))
    }

    public static func load(
        sourceType: CalibrationSourceType,
        routeKey: String,
        defaults: UserDefaults = .standard
    ) -> CalibrationRecord? {
        let key = storageKey(sourceType: sourceType, routeKey: routeKey)
        guard let data = defaults.data(forKey: key) else { return nil }
        guard let record = try? JSONDecoder().decode(CalibrationRecord.self, from: data) else {
            // Unreadable — corrupt bytes, an unexpected shape, or a FUTURE `schemaVersion` this build
            // doesn't know how to decode (a legacy record with no `schemaVersion` key at all still
            // decodes fine, see `CalibrationRecord.init(from:)`). Clean it up rather than leaving a
            // permanently-dead blob that every future `load`/`allRecords` call re-attempts and silently
            // swallows — the caller falls back to a seeded record either way (`effectiveCalibration`).
            defaults.removeObject(forKey: key)
            return nil
        }
        return record
    }

    public static func clear(sourceType: CalibrationSourceType, routeKey: String, defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: storageKey(sourceType: sourceType, routeKey: routeKey))
    }

    /// All stored records across every (sourceType, route) — for the debug screen's "stored records per
    /// route" listing. `UserDefaults` has no native prefix-scan, so this scans
    /// `dictionaryRepresentation()`, which is fine at this scale (a handful of routes ever calibrated).
    public static func allRecords(defaults: UserDefaults = .standard) -> [CalibrationRecord] {
        defaults.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(keyPrefix) }
            .compactMap { key -> CalibrationRecord? in
                guard let data = defaults.data(forKey: key) else { return nil }
                guard let record = try? JSONDecoder().decode(CalibrationRecord.self, from: data) else {
                    // Same decode-fallback cleanup as `load` — see its doc comment.
                    defaults.removeObject(forKey: key)
                    return nil
                }
                return record
            }
            .sorted { $0.date > $1.date }
    }

    /// Clears every stored record (debug screen "clear all").
    public static func clearAll(defaults: UserDefaults = .standard) {
        for record in allRecords(defaults: defaults) {
            clear(sourceType: record.sourceType, routeKey: record.routeKey, defaults: defaults)
        }
    }

    // MARK: - Seeded default

    /// A coarse seeded record derived from AVAudioSession-reported latencies, used when no tap-along
    /// calibration has been run yet for this (sourceType, route) — `iqrMs`/`widenMs` are `0` and
    /// `sampleCount` is `0` so a caller CAN distinguish "seeded" from "measured" if it needs to (measured
    /// records always have `sampleCount >= 3`, per `LatencyCalibrator`'s `minFilteredTaps`).
    public static func seedFromSessionLatencies(
        inputLatency: TimeInterval,
        outputLatency: TimeInterval,
        ioBufferDuration: TimeInterval,
        routeKey: String,
        sourceType: CalibrationSourceType,
        date: Date = Date()
    ) -> CalibrationRecord {
        let offsetMs = (inputLatency + outputLatency + ioBufferDuration) * 1000
        return CalibrationRecord(
            offsetMs: (offsetMs * 100).rounded() / 100,
            iqrMs: 0,
            widenMs: 0,
            sampleCount: 0,
            date: date,
            routeKey: routeKey,
            sourceType: sourceType
        )
    }

    /// The record to use for grading: the stored tap-along calibration for this (sourceType, route) if
    /// one exists, otherwise a seeded default computed from the session's reported latencies.
    public static func effectiveCalibration(
        sourceType: CalibrationSourceType,
        route: RouteInfo,
        inputLatency: TimeInterval,
        outputLatency: TimeInterval,
        ioBufferDuration: TimeInterval,
        defaults: UserDefaults = .standard
    ) -> CalibrationRecord {
        let key = routeKey(for: route)
        if let stored = load(sourceType: sourceType, routeKey: key, defaults: defaults) {
            return stored
        }
        return seedFromSessionLatencies(
            inputLatency: inputLatency,
            outputLatency: outputLatency,
            ioBufferDuration: ioBufferDuration,
            routeKey: key,
            sourceType: sourceType
        )
    }
}
