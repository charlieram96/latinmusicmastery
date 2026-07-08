import Foundation

/// Port of `InstrumentConfig` (`lib/playsense-studio/instruments.ts`) — single source of
/// truth for fretboard, tab, and auto-fingering systems. Adding a new instrument should be
/// a row addition in ``Instruments/all``, not a code change elsewhere.
public struct InstrumentConfig: Equatable, Hashable, Sendable {
    public let instrument: Instrument
    public let displayName: String
    /// Open-string note names, low-to-high (course-by-course).
    public let tuning: [String]
    /// Number of distinct courses (strings/string-groups).
    public let courseCount: Int
    /// Strings per course. 1 = single, 2 = double (tres), 3 = triple (tiple).
    public let stringMultiplicity: Int
    /// Number of frets shown on the fretboard view.
    public let fretCount: Int
    /// True if the instrument is fretted and supports tab/fretboard views.
    public let fretted: Bool
    /// Used by auto-fingering — preferred string for a given pitch range.
    public let preferredFingeringHint: String?

    public init(
        instrument: Instrument,
        displayName: String,
        tuning: [String],
        courseCount: Int,
        stringMultiplicity: Int,
        fretCount: Int,
        fretted: Bool,
        preferredFingeringHint: String? = nil
    ) {
        self.instrument = instrument
        self.displayName = displayName
        self.tuning = tuning
        self.courseCount = courseCount
        self.stringMultiplicity = stringMultiplicity
        self.fretCount = fretCount
        self.fretted = fretted
        self.preferredFingeringHint = preferredFingeringHint
    }
}

/// Port of `INSTRUMENTS` + its accessor functions (`lib/playsense-studio/instruments.ts`).
public enum Instruments {
    public static let all: [Instrument: InstrumentConfig] = [
        .guitar: InstrumentConfig(
            instrument: .guitar,
            displayName: "Guitar",
            tuning: ["E2", "A2", "D3", "G3", "B3", "E4"],
            courseCount: 6,
            stringMultiplicity: 1,
            fretCount: 22,
            fretted: true
        ),
        .bass: InstrumentConfig(
            instrument: .bass,
            displayName: "Bass",
            tuning: ["E1", "A1", "D2", "G2"],
            courseCount: 4,
            stringMultiplicity: 1,
            fretCount: 22,
            fretted: true
        ),
        .tres: InstrumentConfig(
            instrument: .tres,
            displayName: "Cuban Tres",
            // 3 double courses, traditional tuning G3-G4 / C4-C4 / E4-E4. Stored as the
            // lower note of each course; UI shows both per course.
            tuning: ["G3", "C4", "E4"],
            courseCount: 3,
            stringMultiplicity: 2,
            fretCount: 19,
            fretted: true
        ),
        .cuatro: InstrumentConfig(
            instrument: .cuatro,
            displayName: "Venezuelan Cuatro",
            // Standard 4-string Venezuelan cuatro: A3-D4-F#4-B3 (re-entrant).
            tuning: ["A3", "D4", "F#4", "B3"],
            courseCount: 4,
            stringMultiplicity: 1,
            fretCount: 17,
            fretted: true
        ),
        .tiple: InstrumentConfig(
            instrument: .tiple,
            displayName: "Colombian Tiple",
            // 4 triple courses. Each course shown as its octave-pair root.
            tuning: ["D3", "G3", "B3", "E4"],
            courseCount: 4,
            stringMultiplicity: 3,
            fretCount: 18,
            fretted: true
        ),
        .ukulele: InstrumentConfig(
            instrument: .ukulele,
            displayName: "Ukulele",
            tuning: ["G4", "C4", "E4", "A4"],
            courseCount: 4,
            stringMultiplicity: 1,
            fretCount: 15,
            fretted: true
        ),
        .mandolin: InstrumentConfig(
            instrument: .mandolin,
            displayName: "Mandolin",
            tuning: ["G3", "D4", "A4", "E5"],
            courseCount: 4,
            stringMultiplicity: 2,
            fretCount: 20,
            fretted: true
        ),
        .piano: InstrumentConfig(
            instrument: .piano,
            displayName: "Piano",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .staff: InstrumentConfig(
            instrument: .staff,
            displayName: "Staff",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .percKit: InstrumentConfig(
            instrument: .percKit,
            displayName: "Drum Kit",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .percConga: InstrumentConfig(
            instrument: .percConga,
            displayName: "Conga",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .percBongo: InstrumentConfig(
            instrument: .percBongo,
            displayName: "Bongo",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .percTimbal: InstrumentConfig(
            instrument: .percTimbal,
            displayName: "Timbales",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        ),
        .percClave: InstrumentConfig(
            instrument: .percClave,
            displayName: "Clave",
            tuning: [],
            courseCount: 0,
            stringMultiplicity: 0,
            fretCount: 0,
            fretted: false
        )
    ]

    /// `INSTRUMENTS` is total over `Instrument`'s cases, so this table lookup can never
    /// miss — safe to force-unwrap rather than return `Optional` at every call site.
    public static func config(for instrument: Instrument) -> InstrumentConfig {
        // swiftlint:disable:next force_unwrapping
        all[instrument]!
    }

    public static func isFretted(_ instrument: Instrument) -> Bool {
        config(for: instrument).fretted
    }

    public static func tuning(for instrument: Instrument) -> [String] {
        config(for: instrument).tuning
    }
}
