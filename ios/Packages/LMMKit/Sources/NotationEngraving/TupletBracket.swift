import CoreGraphics
import Foundation

/// A tuplet indication: the number digit plus (when not fully beamed) an enclosing bracket. All
/// coordinates are canvas points (y-down). The web computes `triplet` but never draws a bracket
/// (see `score-to-vexflow.ts`); drawing it is a deliberate iOS improvement the plan chose.
public struct TupletShape: Equatable, Sendable {
    /// The tuplet-number glyph (e.g. `tuplet3`), positioned at its SMuFL origin.
    public let digit: PositionedGlyph
    /// Bracket strokes (a horizontal span split around the digit plus two end hooks). **Empty**
    /// when every note in the run is beamed — the standard rule is to show the number alone over
    /// the beam and omit the bracket.
    public let bracket: [LineSegment]

    public init(digit: PositionedGlyph, bracket: [LineSegment]) {
        self.digit = digit
        self.bracket = bracket
    }
}

/// Pure tuplet-bracket geometry. Following VexFlow's `setTupletLocation`, the number/bracket
/// sits on the **stem side** — above the notes for a stem-up run, below for stem-down — so it
/// rides with the beam. When the run is fully beamed the bracket is dropped and only the digit
/// is drawn (over the beam); otherwise a broken bracket with two inward hooks encloses the run.
public enum TupletBracket {
    /// Gap between the reference edge (beam/stem tips) and the bracket, in staff spaces.
    public static let bracketGapSpaces: StaffSpaces = 1.2
    /// Length of the bracket's end hooks (pointing back toward the notes), in staff spaces.
    public static let hookLengthSpaces: StaffSpaces = 0.75
    /// Half-width of the gap left in the bracket for the digit, in staff spaces.
    public static let digitHalfGapSpaces: StaffSpaces = 0.75

    /// One tuplet run's inputs: where its notes' stems are, the beam/stem-tip edge to clear, its
    /// stem direction, and whether every note is beamed.
    public struct Run: Equatable, Sendable {
        public let stemXs: [CGFloat]
        public let referenceYs: [CGFloat]
        public let stemUp: Bool
        public let fullyBeamed: Bool

        public init(stemXs: [CGFloat], referenceYs: [CGFloat], stemUp: Bool, fullyBeamed: Bool) {
            self.stemXs = stemXs
            self.referenceYs = referenceYs
            self.stemUp = stemUp
            self.fullyBeamed = fullyBeamed
        }
    }

    /// Build the tuplet indication for one `run`. `digitBBox` (the number glyph's bounding box)
    /// centers the digit horizontally; `nil` leaves it uncentered.
    public static func tuplet(
        run: Run,
        digitGlyph: Glyph,
        digitBBox: GlyphBoundingBox?,
        scale: ScaleContext,
        defaults: EngravingDefaults
    ) -> TupletShape? {
        guard let firstX = run.stemXs.first, let lastX = run.stemXs.last, !run.referenceYs.isEmpty else {
            return nil
        }
        let stemUp = run.stemUp

        // Outward = away from the noteheads: up (−y) for stem-up, down (+y) for stem-down.
        let outward: CGFloat = stemUp ? -1 : 1
        let gap = scale.points(bracketGapSpaces)
        // Clear the most-extreme tip so the straight bracket sits outside every stem.
        let extremeTip = stemUp ? (run.referenceYs.min() ?? 0) : (run.referenceYs.max() ?? 0)
        let bracketY = extremeTip + outward * gap

        let centerX = (firstX + lastX) / 2
        let digitWidth = scale.points(digitBBox?.width ?? 1.0)
        let digitHeight = scale.points((digitBBox.map { $0.neY - $0.swY }) ?? 1.0)
        // Center the glyph horizontally; nudge it a touch further out than the bracket line so it
        // reads as sitting on/above the bracket.
        let digitOrigin = CGPoint(
            x: centerX - digitWidth / 2,
            y: bracketY + outward * digitHeight / 2
        )
        let digit = PositionedGlyph(glyph: digitGlyph, origin: digitOrigin)

        guard !run.fullyBeamed else {
            return TupletShape(digit: digit, bracket: [])
        }

        let thickness = scale.points(defaults.tupletBracketThickness)
        let hook = scale.points(hookLengthSpaces)
        let halfGap = scale.points(digitHalfGapSpaces)
        // Hooks point back toward the notes (inward = −outward).
        let hookEndY = bracketY - outward * hook
        func hookLine(_ xValue: CGFloat) -> LineSegment {
            LineSegment(
                start: CGPoint(x: xValue, y: bracketY), end: CGPoint(x: xValue, y: hookEndY), thickness: thickness
            )
        }
        var bracket: [LineSegment] = [hookLine(firstX), hookLine(lastX)]
        // Horizontal span, split around the digit gap (skip a half if it would invert).
        let leftEnd = centerX - halfGap
        let rightStart = centerX + halfGap
        if leftEnd > firstX {
            bracket.append(LineSegment(
                start: CGPoint(x: firstX, y: bracketY), end: CGPoint(x: leftEnd, y: bracketY), thickness: thickness
            ))
        }
        if rightStart < lastX {
            bracket.append(LineSegment(
                start: CGPoint(x: rightStart, y: bracketY), end: CGPoint(x: lastX, y: bracketY), thickness: thickness
            ))
        }
        return TupletShape(digit: digit, bracket: bracket)
    }
}
