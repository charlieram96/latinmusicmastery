import Foundation

/// Port of `PercStroke['noteType']` (`lib/playsense-studio/perc-strokes.ts`) — `'x'`
/// renders an X notehead (slap/mute/cymbal); `nil` (omitted `noteType`) is a normal
/// notehead.
public enum NoteheadType: String, Equatable, Hashable, Sendable {
    case xNotehead = "x"
}

/// Port of `PercStroke` (`lib/playsense-studio/perc-strokes.ts`).
///
/// Percussion tracks don't have a meaningful chromatic pitch. Instead each instrument has
/// a small fixed set of named strokes (e.g. a conga's Open/Slap/Mute/Bass), each mapped to
/// a MIDI number (so the rest of the pipeline — add-note, set-event-pitch, serialization —
/// is unchanged; strokes are just MIDI under the hood) and a VexFlow staff position that
/// fixes where the notehead sits on the percussion staff.
public struct PercStroke: Equatable, Hashable, Sendable {
    /// Stable id (used for palette keys).
    public let id: String
    /// Human label shown in the stroke palette.
    public let label: String
    /// MIDI number stored on the note. Unique within the instrument.
    public let midi: Int
    /// VexFlow key string fixing the notehead's staff position, e.g. `"g/5"`.
    public let staffLine: String
    public let noteType: NoteheadType?

    public init(id: String, label: String, midi: Int, staffLine: String, noteType: NoteheadType? = nil) {
        self.id = id
        self.label = label
        self.midi = midi
        self.staffLine = staffLine
        self.noteType = noteType
    }
}

/// Port of the `PERC_STROKES` table + its accessor functions (`perc-strokes.ts`). The MIDI
/// values follow GM percussion where it makes sense (drum kit) and the conga fixture in
/// `score-fixtures.ts` (62/63/64) for hand drums — stable + unique within an instrument so
/// strokes round-trip, not a claim of universal GM correctness.
public enum PercStrokes {
    // Ordered high→low so a palette UI reads top-to-bottom like the staff.
    private static let table: [Instrument: [PercStroke]] = [
        .percConga: [
            PercStroke(id: "open-high", label: "Open High", midi: 64, staffLine: "g/5"),
            PercStroke(id: "slap", label: "Slap", midi: 62, staffLine: "g/5", noteType: .xNotehead),
            PercStroke(id: "open-low", label: "Open Low", midi: 63, staffLine: "e/5"),
            PercStroke(id: "mute", label: "Mute", midi: 61, staffLine: "d/5", noteType: .xNotehead),
            PercStroke(id: "bass", label: "Bass", midi: 60, staffLine: "c/5")
        ],
        .percBongo: [
            PercStroke(id: "macho-open", label: "Macho Open", midi: 64, staffLine: "g/5"),
            PercStroke(id: "macho-slap", label: "Macho Slap", midi: 63, staffLine: "g/5", noteType: .xNotehead),
            PercStroke(id: "hembra-open", label: "Hembra Open", midi: 62, staffLine: "e/5"),
            PercStroke(id: "hembra-slap", label: "Hembra Slap", midi: 61, staffLine: "e/5", noteType: .xNotehead)
        ],
        .percTimbal: [
            PercStroke(id: "cascara", label: "Cáscara", midi: 65, staffLine: "a/5", noteType: .xNotehead),
            PercStroke(id: "high", label: "High Drum", midi: 64, staffLine: "g/5"),
            PercStroke(id: "low", label: "Low Drum", midi: 62, staffLine: "e/5"),
            PercStroke(id: "rim", label: "Rim/Clave", midi: 61, staffLine: "c/5", noteType: .xNotehead)
        ],
        .percClave: [
            PercStroke(id: "stroke", label: "Clave", midi: 60, staffLine: "b/4", noteType: .xNotehead)
        ],
        .percKit: [
            PercStroke(id: "crash", label: "Crash", midi: 49, staffLine: "a/5", noteType: .xNotehead),
            PercStroke(id: "ride", label: "Ride", midi: 51, staffLine: "f/5", noteType: .xNotehead),
            PercStroke(id: "hh-closed", label: "HH Closed", midi: 42, staffLine: "g/5", noteType: .xNotehead),
            PercStroke(id: "hh-open", label: "HH Open", midi: 46, staffLine: "g/5", noteType: .xNotehead),
            PercStroke(id: "hi-tom", label: "Hi Tom", midi: 48, staffLine: "e/5"),
            PercStroke(id: "mid-tom", label: "Mid Tom", midi: 45, staffLine: "d/5"),
            PercStroke(id: "snare", label: "Snare", midi: 38, staffLine: "c/5"),
            PercStroke(id: "floor-tom", label: "Floor Tom", midi: 41, staffLine: "a/4"),
            PercStroke(id: "kick", label: "Kick", midi: 36, staffLine: "f/4")
        ]
    ]

    /// True for any percussion instrument (`perc-kit`/`conga`/`bongo`/`timbal`/`clave`).
    public static func isPercussion(_ instrument: Instrument) -> Bool {
        instrument.rawValue.hasPrefix("perc-")
    }

    /// Stroke palette for a percussion instrument, or `nil` for pitched instruments.
    public static func strokes(for instrument: Instrument) -> [PercStroke]? {
        table[instrument]
    }

    /// Resolve a stored MIDI back to its stroke (for rendering + palette highlight).
    public static func stroke(for instrument: Instrument, midi: Int) -> PercStroke? {
        table[instrument]?.first { $0.midi == midi }
    }
}
