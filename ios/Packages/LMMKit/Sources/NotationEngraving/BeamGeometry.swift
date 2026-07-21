import CoreGraphics
import Foundation

/// One beam bar — a filled parallelogram whose two long edges follow the beam slope. `start`
/// and `end` are the bar's **center-line** endpoints (in canvas points, y-down); the bar fills
/// `thickness` points straddling that line. A group's primary (8th-level) beam spans the whole
/// group; secondary (16th+) bars are shorter segments and partial stubs.
public struct BeamSegment: Equatable, Sendable {
    public let start: CGPoint
    public let end: CGPoint
    public let thickness: CGFloat

    public init(start: CGPoint, end: CGPoint, thickness: CGFloat) {
        self.start = start
        self.end = end
        self.thickness = thickness
    }
}

/// Pure beam geometry for one beam group: given each stem's x, the beam-side extreme notehead
/// y, and the note's beam count, produce the primary + secondary beam bars and the y each stem
/// must extend to. No fonts, no drawing.
///
/// Rules (documented for provenance):
///   - **Single unified stem direction** is decided by the caller (mean staff position over the
///     whole group) and passed in — every stem in a group points the same way.
///   - **Slant** is the natural first→last stem-tip slope, with the total rise across the group
///     clamped to ±1 staff space (`slantClampSpaces`) — the standard readability cap.
///   - **Min stem length**: the beam is positioned so the shortest stem is exactly
///     `stemLengthSpaces` (3.5 spaces, matching an unbeamed stem) and no stem is shorter — the
///     beam sits as close to the noteheads as that constraint allows.
///   - **Secondary bars** (16th and shorter): one per extra beam level, offset toward the
///     noteheads by `beamThickness + beamSpacing`. A run of ≥2 consecutive notes that share a
///     level gets a full bar; an isolated note gets a **partial stub** that points toward the
///     neighbour that justifies it — left (toward the preceding note) unless the note is the
///     first of the group, in which case right. This renders dotted-eighth/sixteenth and mixed
///     16th figures correctly.
public enum BeamGeometry {
    /// The maximum beam rise across a group, in staff spaces (the slant clamp).
    public static let slantClampSpaces: StaffSpaces = 1.0
    /// Length of a partial (broken) secondary beam stub, in staff spaces.
    public static let partialBeamLengthSpaces: StaffSpaces = 1.0

    /// One note's contribution to a beam group.
    public struct Note: Equatable, Sendable {
        /// Canvas x of this note's stem (points).
        public let stemX: CGFloat
        /// Canvas y (points) of the notehead nearest the beam — the highest notehead for a
        /// stem-up group, the lowest for stem-down. For a single note this is just its y.
        public let beamSideNoteheadY: CGFloat
        /// Number of beams this note carries (`DurationCode.beamCount`): 1 = eighth, 2 = 16th, …
        public let beamCount: Int

        public init(stemX: CGFloat, beamSideNoteheadY: CGFloat, beamCount: Int) {
            self.stemX = stemX
            self.beamSideNoteheadY = beamSideNoteheadY
            self.beamCount = beamCount
        }
    }

    /// The geometry for one beam group.
    public struct Result: Equatable, Sendable {
        /// Primary beam first, then every secondary bar / stub.
        public let segments: [BeamSegment]
        /// The beam center-line y at each input note's stem x — where that stem must reach.
        public let stemTips: [CGFloat]
        public let stemUp: Bool
    }

    public static func layout(
        notes: [Note],
        stemUp: Bool,
        scale: ScaleContext,
        defaults: EngravingDefaults,
        stemLengthSpaces: StaffSpaces = MeasureLayoutMetrics.stemLengthSpaces
    ) -> Result {
        guard let first = notes.first, let last = notes.last, notes.count >= 2 else {
            return Result(segments: [], stemTips: notes.map(\.beamSideNoteheadY), stemUp: stemUp)
        }

        let space = scale.staffSpacePoints
        let stemLen = scale.points(stemLengthSpaces)
        let beamThickness = scale.points(defaults.beamThickness)
        let beamStep = scale.points(defaults.beamThickness + defaults.beamSpacing)
        let clamp = scale.points(slantClampSpaces)

        // Slope: natural first→last stem-tip rise, clamped to ±1 space, spread over the span.
        let sign: CGFloat = stemUp ? -1 : 1
        func naturalTip(_ note: Note) -> CGFloat { note.beamSideNoteheadY + sign * stemLen }
        let rawRise = naturalTip(last) - naturalTip(first)
        let clampedRise = max(-clamp, min(clamp, rawRise))
        let span = last.stemX - first.stemX
        let slope = abs(span) < 1e-9 ? 0 : clampedRise / span

        // Intercept `b` for beamY(x) = b + slope*x, keeping every stem ≥ stemLen. Stem-up: the
        // beam must be at/above every note's tip (smaller y), so take the lowest feasible line
        // (max y ⇒ min of the per-note ceilings). Stem-down: mirror.
        let ceilings = notes.map { $0.beamSideNoteheadY + sign * stemLen - slope * $0.stemX }
        let intercept = stemUp ? (ceilings.min() ?? 0) : (ceilings.max() ?? 0)
        func beamY(_ xValue: CGFloat) -> CGFloat { intercept + slope * xValue }

        let metrics = SecondaryMetrics(
            slope: slope, intercept: intercept, stemUp: stemUp,
            beamStep: beamStep, beamThickness: beamThickness, stubLength: scale.points(partialBeamLengthSpaces)
        )
        var segments: [BeamSegment] = [BeamSegment(
            start: CGPoint(x: first.stemX, y: beamY(first.stemX)),
            end: CGPoint(x: last.stemX, y: beamY(last.stemX)),
            thickness: beamThickness
        )]
        segments.append(contentsOf: secondarySegments(notes: notes, metrics: metrics))

        return Result(segments: segments, stemTips: notes.map { beamY($0.stemX) }, stemUp: stemUp)
    }

    // MARK: Secondary beams + partial stubs

    /// The constants a secondary/partial bar needs, so the segment builder stays a two-argument
    /// function.
    private struct SecondaryMetrics {
        let slope: CGFloat
        let intercept: CGFloat
        let stemUp: Bool
        let beamStep: CGFloat
        let beamThickness: CGFloat
        let stubLength: CGFloat

        /// Primary beam center-line y at `xValue`.
        func beamY(_ xValue: CGFloat) -> CGFloat { intercept + slope * xValue }
    }

    private static func secondarySegments(notes: [Note], metrics: SecondaryMetrics) -> [BeamSegment] {
        let maxLevel = notes.map(\.beamCount).max() ?? 1
        guard maxLevel >= 2 else { return [] }
        // Secondary bars sit toward the noteheads: below the primary for stem-up (larger y),
        // above for stem-down.
        let levelSign: CGFloat = metrics.stemUp ? 1 : -1
        var result: [BeamSegment] = []

        for level in 2...maxLevel {
            let offset = levelSign * CGFloat(level - 1) * metrics.beamStep
            func yAt(_ xValue: CGFloat) -> CGFloat { metrics.beamY(xValue) + offset }
            for run in runs(notes: notes, level: level) {
                guard let firstIndex = run.first, let lastIndex = run.last else { continue }
                if run.count >= 2 {
                    let start = notes[firstIndex].stemX
                    let end = notes[lastIndex].stemX
                    result.append(BeamSegment(
                        start: CGPoint(x: start, y: yAt(start)),
                        end: CGPoint(x: end, y: yAt(end)),
                        thickness: metrics.beamThickness
                    ))
                } else {
                    // Partial stub: point toward the neighbour that justifies it — left unless
                    // this is the first note of the group (then right).
                    let stemX = notes[firstIndex].stemX
                    let otherX = firstIndex == 0 ? stemX + metrics.stubLength : stemX - metrics.stubLength
                    result.append(BeamSegment(
                        start: CGPoint(x: stemX, y: yAt(stemX)),
                        end: CGPoint(x: otherX, y: yAt(otherX)),
                        thickness: metrics.beamThickness
                    ))
                }
            }
        }
        return result
    }

    /// Maximal runs of consecutive note indices whose `beamCount >= level`.
    private static func runs(notes: [Note], level: Int) -> [[Int]] {
        var result: [[Int]] = []
        var current: [Int] = []
        for index in notes.indices {
            if notes[index].beamCount >= level {
                current.append(index)
            } else if !current.isEmpty {
                result.append(current)
                current = []
            }
        }
        if !current.isEmpty { result.append(current) }
        return result
    }
}
