import Foundation
import ScoreModel

/// The clef a track is engraved in — `extractTrackEvents` (`score-to-vexflow.ts`) only ever
/// picks `'treble'` (pitched) or `'percussion'` (any `perc-*` instrument).
public enum Clef: String, Equatable, Hashable, Sendable {
    case treble
    case percussion
}

/// The accidental glyph to attach to a notehead — the only two `extractAccidental`
/// (`score-to-vexflow.ts`) ever produces. Natural is never emitted: the `#`/`b` comes straight
/// from the spelled key string, and there is no key-signature or carry-through-measure state
/// (matching the web renderer exactly — see the descriptor-parity note in the C14 report).
public enum DescriptorAccidental: Equatable, Hashable, Sendable {
    case sharp
    case flat
}

/// A VexFlow duration code — the eight codes `vexflowDurationCode` (`score-to-vexflow.ts`) can
/// produce, `w` (whole) through `128` (hundred-twenty-eighth). Dotting is carried separately
/// (`EventDescriptor.dotted`); this is always the *base* code.
public enum DurationCode: String, Equatable, Hashable, Sendable, CaseIterable {
    case whole = "w"
    case half = "h"
    case quarter = "q"
    case eighth = "8"
    case sixteenth = "16"
    case thirtySecond = "32"
    case sixtyFourth = "64"
    case oneTwentyEighth = "128"

    /// True for `8`…`128` — the durations that carry a flag when unbeamed (and can be beamed).
    public var hasFlag: Bool {
        switch self {
        case .whole, .half, .quarter: return false
        case .eighth, .sixteenth, .thirtySecond, .sixtyFourth, .oneTwentyEighth: return true
        }
    }

    /// True for `w` — the one code with no stem (and, in practice, no flag).
    public var isStemless: Bool { self == .whole }

    /// Number of beams (equivalently, flag hooks) this duration carries: `1` for an eighth,
    /// `2` for a sixteenth, up to `5` for a 128th; `0` for a quarter or longer (which cannot be
    /// beamed). This is the beam-level count `BeamGeometry` draws and the "beamable" predicate
    /// `BeamGrouper` uses (`beamCount >= 1`) — the Swift mirror of VexFlow's
    /// `getBeamCount()` / `durationToNumber(...) < 8` test.
    public var beamCount: Int {
        switch self {
        case .whole, .half, .quarter: return 0
        case .eighth: return 1
        case .sixteenth: return 2
        case .thirtySecond: return 3
        case .sixtyFourth: return 4
        case .oneTwentyEighth: return 5
        }
    }
}

/// One notehead within an event — a single note is one `NoteDescriptor`, a chord is several.
public struct NoteDescriptor: Equatable, Hashable, Sendable {
    /// Treble-referenced staff position (see `StaffGeometry`'s convention: `0` = bottom line,
    /// `+1` per half-space up). Percussion tracks position by their `PercStroke.staffLine`
    /// key string read in the same treble frame — the web renderer draws a treble clef for
    /// every track, so a stroke's `staffLine` is authored against treble positions.
    public let staffPosition: Int
    /// Accidental glyph to draw before this notehead (`nil` = none).
    public let accidental: DescriptorAccidental?
    /// MIDI number, for cursor anchoring / round-tripping. `nil` only when unknown.
    public let midi: Int?
    /// `true` for an `'x'` notehead (percussion slap/mute/cymbal — `PercStroke.noteType`).
    public let isCross: Bool
    /// The VexFlow key string this position/accidental was derived from (e.g. `"c#/4"`),
    /// retained for parity/debug against the TS descriptor's `keys` array.
    public let keyString: String

    public init(staffPosition: Int, accidental: DescriptorAccidental?, midi: Int?, isCross: Bool, keyString: String) {
        self.staffPosition = staffPosition
        self.accidental = accidental
        self.midi = midi
        self.isCross = isCross
        self.keyString = keyString
    }
}

/// Port of `VexEventDescriptor` (`score-to-vexflow.ts`), for one voice-1 event of one track.
/// Pure geometry-free data: a layout engine (`MeasureLayoutEngine`) turns a measure's worth of
/// these into positioned glyphs.
public struct EventDescriptor: Equatable, Hashable, Sendable {
    public let kind: MusicalEvent.Kind
    /// Cumulative QN from the start of the track at the START of this event.
    public let qnStart: Double
    public let durationQN: Double
    /// 1-based beat in the measure (downbeat is `1`; offsets are fractional).
    public let beatInMeasure: Double
    public let durationCode: DurationCode
    public let isRest: Bool
    public let dotted: Bool
    /// Noteheads in authored order (parity with the TS `keys` array). Empty for a rest.
    public let notes: [NoteDescriptor]
    /// MIDI of the first pitch (chord: first authored note). `nil` for rests.
    public let midi: Int?
    public let triplet: Bool
    public let tieToNext: Bool
    public let articulation: ArticulationType?

    public init(
        kind: MusicalEvent.Kind,
        qnStart: Double,
        durationQN: Double,
        beatInMeasure: Double,
        durationCode: DurationCode,
        isRest: Bool,
        dotted: Bool,
        notes: [NoteDescriptor],
        midi: Int?,
        triplet: Bool,
        tieToNext: Bool,
        articulation: ArticulationType?
    ) {
        self.kind = kind
        self.qnStart = qnStart
        self.durationQN = durationQN
        self.beatInMeasure = beatInMeasure
        self.durationCode = durationCode
        self.isRest = isRest
        self.dotted = dotted
        self.notes = notes
        self.midi = midi
        self.triplet = triplet
        self.tieToNext = tieToNext
        self.articulation = articulation
    }
}

/// One measure's worth of extracted events plus the context needed to lay it out — the Swift
/// mirror of one element of `extractTrackEvents`'s return array (`score-to-vexflow.ts`).
public struct MeasureDescriptor: Equatable, Sendable {
    public let measure: Measure
    public let events: [EventDescriptor]
    /// Cumulative QN at the start of this measure.
    public let cumulativeQN: Double
    public let timeSignature: TimeSignature
    public let clef: Clef

    public init(
        measure: Measure,
        events: [EventDescriptor],
        cumulativeQN: Double,
        timeSignature: TimeSignature,
        clef: Clef
    ) {
        self.measure = measure
        self.events = events
        self.cumulativeQN = cumulativeQN
        self.timeSignature = timeSignature
        self.clef = clef
    }
}

/// Pure port of the descriptor half of `score-to-vexflow.ts` — duration codes, pitch spelling,
/// accidental extraction, percussion stroke resolution, and `extractTrackEvents`. Every
/// function here is total: a malformed `durationQN` never throws (it clamps/falls back exactly
/// like `vexflowDurationCode`), and a malformed key string resolves to the middle line rather
/// than trapping.
public enum EventDescriptorBuilder {
    // MARK: Duration code (port of `vexflowDurationCode`)

    /// VexFlow duration code for a quarter-note duration, with the same nearest-power-of-2
    /// fallback `vexflowDurationCode` uses for unusual (e.g. MIDI-imported) durations. Total:
    /// zero / negative / non-finite inputs resolve to a code rather than throwing.
    /// Exact quarter-note durations → code (the eps-matched cases from `vexflowDurationCode`).
    private static let exactDurations: [(quarterNotes: Double, code: DurationCode)] = [
        (4, .whole), (2, .half), (1, .quarter), (0.5, .eighth),
        (0.25, .sixteenth), (0.125, .thirtySecond), (0.0625, .sixtyFourth), (0.03125, .oneTwentyEighth)
    ]
    /// `round(log2(base))` → code, for the nearest-power-of-2 fallback (powers >= 2 clamp to whole).
    private static let fallbackByPower: [Int: DurationCode] = [
        1: .half, 0: .quarter, -1: .eighth, -2: .sixteenth, -3: .thirtySecond, -4: .sixtyFourth
    ]

    public static func durationCode(durationQN: Double, dotted: Bool) -> DurationCode {
        // If dotted, the underlying (undotted) duration is durationQN * 2/3 — reverse before lookup.
        let base = dotted ? (durationQN * 2) / 3 : durationQN
        if let match = exactDurations.first(where: { abs(base - $0.quarterNotes) < 1e-7 }) {
            return match.code
        }
        // Fallback: round to the nearest power of 2. Guard the log2 domain so the function stays
        // total (TS relied on JS's Infinity/NaN arithmetic; Swift's `Int(_:)` would trap).
        guard base.isFinite, base > 0 else {
            return base == .infinity ? .whole : .oneTwentyEighth
        }
        let power = Int(log2(base).rounded())
        if power >= 2 { return .whole }
        return fallbackByPower[power] ?? .oneTwentyEighth
    }

    // MARK: Pitch spelling (port of `midiToKeyString` / `extractAccidental`)

    private static let sharpNames: [String] = [
        "c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"
    ]
    private static let flatNames: [String] = [
        "c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"
    ]

    /// MIDI number → VexFlow key string (e.g. `60` → `"c/4"`). Honors an explicit
    /// `spellingHint` (e.g. `"Bb"`, `"F#"`); otherwise flat keys (`keyFifths < 0`) prefer
    /// flats and everything else prefers sharps — a verbatim port of `midiToKeyString`.
    public static func midiToKeyString(midi: Int, spellingHint: String?, keyFifths: Int) -> String {
        if let hint = spellingHint, let spelled = keyString(fromSpellingHint: hint, midi: midi) {
            return spelled
        }
        let pitchClass = ((midi % 12) + 12) % 12
        let octave = Int((Double(midi) / 12).rounded(.down)) - 1
        let table = keyFifths < 0 ? flatNames : sharpNames
        return "\(table[pitchClass])/\(octave)"
    }

    /// Parse a spelling hint the way the TS regex `^([A-Ga-g])([#b])?(\d?)$` does — a single
    /// letter, an optional accidental, an optional single-digit octave — returning `nil` if
    /// the whole string doesn't match (so `midiToKeyString` falls back to the table).
    private static func keyString(fromSpellingHint hint: String, midi: Int) -> String? {
        let chars = Array(hint)
        guard let first = chars.first, "ABCDEFGabcdefg".contains(first) else { return nil }
        let letter = Character(first.lowercased())
        var index = 1
        var accidental = ""
        if index < chars.count, chars[index] == "#" || chars[index] == "b" {
            accidental = String(chars[index])
            index += 1
        }
        // `.rounded(.down)` (not `/`, which truncates toward zero) to match `midiToKeyString`'s
        // floor semantics above — identical result for any valid (non-negative) MIDI number, but
        // consistent so neither reads as a copy/paste divergence.
        var octave = Int((Double(midi) / 12).rounded(.down)) - 1
        if index < chars.count, chars[index].isNumber {
            octave = Int(String(chars[index])) ?? octave
            index += 1
        }
        guard index == chars.count else { return nil } // anchored `$`: no trailing junk
        return "\(letter)\(accidental)/\(octave)"
    }

    /// Which accidental (if any) a VexFlow key string carries — a verbatim port of
    /// `extractAccidental`: a `#` anywhere → sharp, else a `b` anywhere → flat.
    ///
    /// NOTE — faithful web quirk: because the note letter B is spelled `"b"`, a B-natural key
    /// like `"b/4"` matches the `contains("b")` test and is reported as a flat, exactly as the
    /// web renderer does. This is a latent bug in `score-to-vexflow.ts`, but the C14 brief
    /// mandates descriptor parity ("this exactly matches web output"), so it is ported as-is
    /// and isolated here — the fix (only inspecting the accidental slot) is a one-line change
    /// if/when the web source is corrected. See the C14 report.
    public static func extractAccidental(_ keyString: String) -> DescriptorAccidental? {
        if keyString.contains("#") { return .sharp }
        if keyString.contains("b") { return .flat }
        return nil
    }

    // MARK: Key string → staff position (diatonic math)

    private static let letterToIndex: [Character: Int] = [
        "c": 0, "d": 1, "e": 2, "f": 3, "g": 4, "a": 5, "b": 6
    ]

    /// Treble-referenced staff position for a VexFlow key string. The web renderer draws a
    /// treble clef for every track (`stave.addClef('treble')`), so both pitched and percussion
    /// key strings resolve in the treble frame: the bottom line is E4 (position `0`), each
    /// diatonic step is one half-space. The accidental never shifts the position (VexFlow
    /// behavior). Total: an unparseable string resolves to the middle line (`4`).
    public static func staffPosition(forKeyString keyString: String) -> Int {
        let parts = keyString.split(separator: "/")
        guard parts.count == 2,
              let octave = Int(parts[1]),
              let letter = parts[0].lowercased().first,
              let letterIndex = letterToIndex[letter] else {
            return 4 // middle line — builder-produced key strings are always well-formed
        }
        let diatonic = octave * 7 + letterIndex
        let trebleBottomLine = 4 * 7 + 2 // E4
        return diatonic - trebleBottomLine
    }

}
