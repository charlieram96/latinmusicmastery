import Foundation

// Port of the scoring constants in `lib/play-sense/types.ts`. TS `SCREAMING_SNAKE`
// exports keep their names in lowerCamelCase (noted per constant).

/// Port of `TOLERANCE_BY_DIFFICULTY` — timing windows (ms) per difficulty.
public let toleranceByDifficulty: [Difficulty: ToleranceWindows] = [
    .beginner: ToleranceWindows(perfect: 40, good: 70, ok: 110),
    .intermediate: ToleranceWindows(perfect: 30, good: 55, ok: 85),
    .advanced: ToleranceWindows(perfect: 20, good: 40, ok: 65)
]

/// Port of `PITCH_TOLERANCE_CENTS`. A detected note within this many cents of the
/// expected pitch counts as correct, so a slightly flat/sharp player is not zeroed out.
/// 100 cents = one semitone.
public let pitchToleranceCents: [Difficulty: Double] = [
    .beginner: 80,
    .intermediate: 55,
    .advanced: 35
]

/// Port of `PITCH_OCTAVE_AGNOSTIC`. When true, pitch is matched by pitch-class (ignoring
/// octave) so common octave-detection errors don't zero an otherwise-correct note.
public let pitchOctaveAgnostic: [Difficulty: Bool] = [
    .beginner: true,
    .intermediate: true,
    .advanced: false
]

/// Port of `CHORD_PRESENCE_RATIO`. Fraction of a chord's distinct pitch classes that must
/// be present (in the detected chroma) for the chord to count as a hit. Presence-only:
/// extra/wrong notes are not penalized.
public let chordPresenceRatio: [Difficulty: Double] = [
    .beginner: 0.66,
    .intermediate: 0.8,
    .advanced: 1.0
]

/// Port of `CHROMA_PRESENCE_THRESHOLD` — a chroma bin counts as "present" when its energy
/// is at least this fraction of the chroma max.
public let chromaPresenceThreshold = 0.35

/// Port of `GRADE_POINTS`.
public let gradePoints: [HitGrade: Double] = [
    .perfect: 100,
    .good: 70,
    .ok: 40,
    .miss: 0
]

/// Port of `GRADE_COLORS` (hex strings, UI concern but ported with the table for parity).
public let gradeColors: [HitGrade: String] = [
    .perfect: "#22c55e",
    .good: "#eab308",
    .ok: "#f97316",
    .miss: "#ef4444"
]

extension Difficulty {
    /// Non-optional accessors for the difficulty tables (total over `Difficulty` by
    /// construction, so the lookups can never miss).
    var toleranceWindows: ToleranceWindows {
        // swiftlint:disable:next force_unwrapping
        toleranceByDifficulty[self]!
    }

    var pitchToleranceInCents: Double {
        // swiftlint:disable:next force_unwrapping
        pitchToleranceCents[self]!
    }

    var isOctaveAgnostic: Bool {
        // swiftlint:disable:next force_unwrapping
        pitchOctaveAgnostic[self]!
    }

    var requiredChordPresenceRatio: Double {
        // swiftlint:disable:next force_unwrapping
        chordPresenceRatio[self]!
    }
}

extension HitGrade {
    /// Non-optional accessor for `GRADE_POINTS` (total over `HitGrade`).
    var points: Double {
        // swiftlint:disable:next force_unwrapping
        gradePoints[self]!
    }
}
