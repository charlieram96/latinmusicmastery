import CoreBluetooth
import Foundation

// Port of `contexts/playsense-context.tsx`'s notification protocol: the PlaySense hardware controller
// (piezo-sensored conga/timbale surfaces) streams UTF-8 JSON `{piezos: number[], mic: number}` over one
// BLE characteristic. D25 is the CoreBluetooth side of that same wire contract.

/// The GATT identifiers the PlaySense firmware advertises — verbatim from `playsense-context.tsx`'s
/// `SERVICE_UUID`/`CHARACTERISTIC_UUID` constants (byte-identical strings; CoreBluetooth and Web
/// Bluetooth both accept 128-bit UUID literals in this form).
public enum PlaySenseBLEProtocol {
    public static let serviceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789abc")
    public static let characteristicUUID = CBUUID(string: "abcd1234-5678-1234-5678-abcdef123456")

    /// The exact device name the web's `requestDevice({ filters: [{ name: 'PlaySense' }] })` matches.
    /// CoreBluetooth has no server-side name filter for `scanForPeripherals`, so `PlaySenseDeviceManager`
    /// scans unfiltered and applies this (plus a service-UUID fallback) locally — see `matches(name:
    /// advertisementData:)`.
    public static let deviceName = "PlaySense"

    /// Whether a discovered peripheral is a PlaySense device: an exact name match (`peripheral.name` OR
    /// the advertised local name — some firmware only sets one of the two), OR the advertisement already
    /// lists our service UUID. Two independent signals because "the firmware may not advertise the
    /// service" (per the plan) — either one is sufficient to identify the device, so neither is required
    /// alone. Pure/testable: takes plain values, no CoreBluetooth peripheral/central instance needed.
    public static func matches(name: String?, advertisementData: [String: Any]) -> Bool {
        let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        if name == deviceName || localName == deviceName { return true }
        if let uuids = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID], uuids.contains(serviceUUID) {
            return true
        }
        return false
    }
}

/// One decoded BLE notification — port of `PlaysenseReading` (`playsense-context.tsx`), minus
/// `receivedAt` (a `performance.now()` capture the web stores on the reading itself; iOS instead stamps
/// each derived ``OnsetEvent`` with `GameClock` host-seconds at the moment `BLEOnsetSource` handles the
/// reading, which is the same "arrival time" instant this `receivedAt` was standing in for).
public struct PlaySenseBLEReading: Equatable, Sendable {
    /// Raw piezo ADC readings, one per channel; `> 0` means a hit (web: `val > 0`). Kept as `Double`
    /// (not `Int`) to mirror the wire's untyped JSON `number` — matches `hooks/use-playsense-onsets.ts`'s
    /// arithmetic (`maxPiezo / 4095`) without a lossy round-trip through an integer.
    public let piezos: [Double]
    /// Onboard mic level, decoded for parity but UNUSED for grading — confirmed against the web: neither
    /// `playsense-context.tsx` nor `use-playsense-onsets.ts` feeds `.mic` into onset detection; the only
    /// web consumer is a debug meter (`components/play-sense/playsense-test-panel.tsx`). Kept here for
    /// the same potential future debug use, at zero cost.
    public let mic: Double
    // Optional future firmware timestamp field (not in the current wire contract). Decoded if present,
    // per the plan — but deliberately UNUSED for grading: BLE notification jitter is absorbed by the
    // BLE-source calibration offset (`CalibrationRecord` keyed `.ble`), the same way host-arrival-time
    // stamping already works for the mic path. A future firmware revision that adds a reliable on-device
    // capture timestamp could switch to it without changing this type's shape. `t` mirrors the wire's
    // field name (a hypothetical future `{ ..., t: <seconds> }`); two letters is the whole name — same
    // rationale as `ToleranceWindows.ok` in `PlaySenseCore/Types.swift`.
    // swiftlint:disable:next identifier_name
    public let t: Double?

    // swiftlint:disable:next identifier_name
    public init(piezos: [Double], mic: Double = 0, t: Double? = nil) {
        self.piezos = piezos
        self.mic = mic
        self.t = t
    }
}

/// Tolerant JSON decoder for one notification payload — port of `playsense-context.tsx`'s
/// `handleNotification`'s try/catch: `JSON.parse` + duck-typed field access, where a malformed payload
/// (bad JSON, or a missing/non-array `piezos`) drops the WHOLE reading (`nil`, never thrown), while
/// `mic`/`t` are opportunistic (default/absent on any type mismatch, never fail the decode by
/// themselves) — `Number(data.mic) || 0` is exactly "coerce to a number or fall back to 0, no matter
/// what". Implemented via `JSONSerialization` rather than `Decodable` so field-level tolerance is a
/// direct match for the web's per-field duck typing (a strict `Decodable` struct would fail the ENTIRE
/// decode over one bad secondary field, which the web does not).
public enum PlaySenseBLEReadingDecoder {
    public static func decode(_ data: Data) -> PlaySenseBLEReading? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data),
            let object = json as? [String: Any],
            let piezosRaw = object["piezos"] as? [Any]
        else { return nil }

        let piezos = piezosRaw.map { ($0 as? NSNumber)?.doubleValue ?? 0 }
        let mic = (object["mic"] as? NSNumber)?.doubleValue ?? 0
        // swiftlint:disable:next identifier_name
        let t = (object["t"] as? NSNumber)?.doubleValue
        return PlaySenseBLEReading(piezos: piezos, mic: mic, t: t)
    }
}
