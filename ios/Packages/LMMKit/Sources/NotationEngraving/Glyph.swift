import Foundation

/// The catalog of Bravura/SMuFL glyphs this engraving engine draws. Scoped to what a static
/// staff render + (eventually, C14) unbeamed measure layout needs — durations `w` through
/// `128th` (matching `lib/playsense-studio/score-to-vexflow.ts`'s `vexflowDurationCode`,
/// which caps at `'128'`), the two clefs the web app uses (`score-to-vexflow.ts`'s
/// `extractTrackEvents` only ever picks `'treble'` or `'percussion'`), the `'x'` notehead
/// percussion tracks use for slap/mute/cymbal strokes (`perc-strokes.ts`'s `PercStroke.noteType`),
/// and one tuplet digit (`3`, the only tuplet grouping the model currently marks via
/// `MusicalEvent.triplet`).
///
/// Each case's raw value is the glyph's canonical SMuFL name (`smuflName`) — the same string
/// used as a key into `bravura_metadata.json`'s `glyphBBoxes` / `glyphsWithAnchors`.
public enum Glyph: String, CaseIterable, Equatable, Hashable, Sendable {
    // Clefs
    case gClef
    case unpitchedPercussionClef1

    // Time signature digits
    case timeSig0, timeSig1, timeSig2, timeSig3, timeSig4
    case timeSig5, timeSig6, timeSig7, timeSig8, timeSig9

    // Noteheads
    case noteheadBlack
    case noteheadHalf
    case noteheadWhole
    case noteheadXBlack
    case noteheadXHalf

    // Flags (one pair per duration `vexflowDurationCode` can produce below quarter note)
    case flag8thUp, flag8thDown
    case flag16thUp, flag16thDown
    case flag32ndUp, flag32ndDown
    case flag64thUp, flag64thDown
    case flag128thUp, flag128thDown

    // Rests (one per duration `vexflowDurationCode` can produce, `w` through `128th`)
    case restWhole
    case restHalf
    case restQuarter
    case rest8th
    case rest16th
    case rest32nd
    case rest64th
    case rest128th

    // Accidentals
    case accidentalSharp
    case accidentalFlat
    case accidentalNatural

    // Augmentation dot (dotted-note rendering)
    case augmentationDot

    // Tuplet digit (triplet bracketing)
    case tuplet3

    /// The canonical SMuFL glyph name — identical to `rawValue` for every case here, but kept
    /// as its own property so metadata-lookup call sites read as "the SMuFL name" rather than
    /// "this enum's raw string".
    public var smuflName: String { rawValue }

    /// The glyph's Unicode codepoint in Bravura's Private Use Area range (all SMuFL glyphs
    /// used here fit in a single UTF-16 code unit — no surrogate pairs).
    ///
    /// Hardcoded rather than resolved via SMuFL's `glyphnames.json` (github.com/w3c/smufl):
    /// that file is ~300KB of names for the full SMuFL range (thousands of glyphs) to look up
    /// ~40 values we already know, and it isn't Bravura-specific — it's simpler and lighter to
    /// bundle only what NotationEngraving actually draws. Every codepoint below was cross-checked
    /// against `glyphnames.json` at authoring time and is spot-verified against Bravura's own
    /// `bravura_metadata.json` (whose `glyphBBoxes`/`glyphsWithAnchors` are keyed by this same
    /// `smuflName`) in `GlyphCatalogTests`/`GlyphMetricsTests`.
    public var codepoint: UnicodeScalar {
        switch self {
        case .gClef: return "\u{E050}"
        case .unpitchedPercussionClef1: return "\u{E069}"

        case .timeSig0: return "\u{E080}"
        case .timeSig1: return "\u{E081}"
        case .timeSig2: return "\u{E082}"
        case .timeSig3: return "\u{E083}"
        case .timeSig4: return "\u{E084}"
        case .timeSig5: return "\u{E085}"
        case .timeSig6: return "\u{E086}"
        case .timeSig7: return "\u{E087}"
        case .timeSig8: return "\u{E088}"
        case .timeSig9: return "\u{E089}"

        case .noteheadWhole: return "\u{E0A2}"
        case .noteheadHalf: return "\u{E0A3}"
        case .noteheadBlack: return "\u{E0A4}"
        case .noteheadXHalf: return "\u{E0A8}"
        case .noteheadXBlack: return "\u{E0A9}"

        case .flag8thUp: return "\u{E240}"
        case .flag8thDown: return "\u{E241}"
        case .flag16thUp: return "\u{E242}"
        case .flag16thDown: return "\u{E243}"
        case .flag32ndUp: return "\u{E244}"
        case .flag32ndDown: return "\u{E245}"
        case .flag64thUp: return "\u{E246}"
        case .flag64thDown: return "\u{E247}"
        case .flag128thUp: return "\u{E248}"
        case .flag128thDown: return "\u{E249}"

        case .restWhole: return "\u{E4E3}"
        case .restHalf: return "\u{E4E4}"
        case .restQuarter: return "\u{E4E5}"
        case .rest8th: return "\u{E4E6}"
        case .rest16th: return "\u{E4E7}"
        case .rest32nd: return "\u{E4E8}"
        case .rest64th: return "\u{E4E9}"
        case .rest128th: return "\u{E4EA}"

        case .accidentalFlat: return "\u{E260}"
        case .accidentalNatural: return "\u{E261}"
        case .accidentalSharp: return "\u{E262}"

        case .augmentationDot: return "\u{E1E7}"

        case .tuplet3: return "\u{E883}"
        }
    }
}
