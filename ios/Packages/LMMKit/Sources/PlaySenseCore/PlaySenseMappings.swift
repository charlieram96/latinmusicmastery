import Foundation

// Port of `lib/play-sense/playsense-mappings.ts` — piezo channel → drum surface maps for
// the PlaySense BLE device (consumed by PlaySenseBLE in D25; ported as data with the core).

/// Port of `PlaySenseMapping`.
public struct PlaySenseMapping: Equatable, Sendable {
    /// TS narrows this to `'conga' | 'timbale'`; the enum carries the same raw values.
    public let instrument: Instrument
    /// Piezo channel index → drum surface name.
    public let piezoMap: [Int: String]
    /// Whether the mic supplements the piezos for this instrument.
    public let useMic: Bool

    public init(instrument: Instrument, piezoMap: [Int: String], useMic: Bool) {
        self.instrument = instrument
        self.piezoMap = piezoMap
        self.useMic = useMic
    }
}

/// Port of `CONGA_MAPPING`.
public let congaMapping = PlaySenseMapping(
    instrument: .conga,
    piezoMap: [0: "quinto", 1: "conga", 2: "tumba"],
    useMic: true
)

/// Port of `TIMBALE_MAPPING`.
public let timbaleMapping = PlaySenseMapping(
    instrument: .timbale,
    piezoMap: [
        0: "macho",
        1: "hembra",
        2: "campana",
        3: "cencerro",
        4: "jamblock",
        5: "cascara"
    ],
    useMic: false
)

/// Port of `PLAYSENSE_MAPPINGS` (keys include the plural aliases used in course data).
public let playSenseMappings: [String: PlaySenseMapping] = [
    "conga": congaMapping,
    "congas": congaMapping,
    "timbale": timbaleMapping,
    "timbales": timbaleMapping
]

/// Port of `PLAYSENSE_INSTRUMENTS` — instruments that support PlaySense device input.
public let playSenseInstruments: Set<String> = ["conga", "congas", "timbale", "timbales"]

/// Port of `getPlaySenseMapping` — the PlaySense mapping for an instrument, or `nil` if
/// unsupported.
public func getPlaySenseMapping(_ instrument: String) -> PlaySenseMapping? {
    playSenseMappings[instrument]
}
