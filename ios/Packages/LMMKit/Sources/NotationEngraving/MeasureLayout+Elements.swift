import CoreGraphics
import Foundation
import ScoreModel

/// Per-event element generation for `MeasureLayoutEngine` — rests, noteheads/accidentals/dots/
/// ledgers, stems + flags, chord second-interval displacement, and the clef/time-signature
/// lead-in. Split out of `MeasureLayout.swift` to keep each declaration focused.
extension MeasureLayoutEngine {
    // MARK: Rest

    static func appendRest(
        _ event: EventDescriptor,
        x eventX: CGFloat,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) {
        let glyph = restGlyph(for: event.durationCode)
        // Conventional vertical placement (VexFlow-like): the whole rest hangs from the second
        // line from the top (position 6); every other rest centers on the middle line.
        let restPosition = event.durationCode == .whole ? 6 : MeasureLayoutMetrics.middleLinePosition
        let restY = env.yPosition(restPosition)
        elements.rests.append(PositionedGlyph(glyph: glyph, origin: CGPoint(x: eventX, y: restY)))

        let bbox = env.metrics.boundingBox(for: glyph)
        if event.dotted {
            let restRight = eventX + env.points(bbox?.neX ?? 1.0)
            let dotX = restRight + env.points(MeasureLayoutMetrics.dotGapSpaces)
            elements.dots.append(PositionedGlyph(glyph: .augmentationDot, origin: CGPoint(x: dotX, y: restY)))
        }

        let frame = CGRect(
            x: eventX + env.points(bbox?.swX ?? 0),
            y: restY - env.points(bbox?.neY ?? 1),
            width: env.points(bbox?.width ?? 1),
            height: env.points(bbox?.height ?? 2)
        )
        elements.anchors.append(NoteAnchor(qnStart: event.qnStart, frame: frame))
    }

    // MARK: Pitched note / chord

    static func appendPitchedEvent(
        _ event: EventDescriptor,
        x eventX: CGFloat,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) {
        // Sort low→high (by staff position) for stacking + stem/second logic; ties keep order.
        let sorted = event.notes.sorted { $0.staffPosition < $1.staffPosition }
        let positions = sorted.map(\.staffPosition)
        let stemUp = stemPointsUp(positions: positions)
        let displaced = secondDisplacement(sortedPositions: positions, stemUp: stemUp)
        let glyph = noteheadGlyph(for: event.durationCode, isCross: sorted.first?.isCross ?? false)

        var minY = CGFloat.greatestFiniteMagnitude
        var maxY = -CGFloat.greatestFiniteMagnitude
        for (index, note) in sorted.enumerated() {
            let noteX = eventX + sideShift(displaced: displaced[index], stemUp: stemUp, env: env)
            let noteY = env.yPosition(note.staffPosition)
            minY = min(minY, noteY)
            maxY = max(maxY, noteY)
            appendNotehead(note, event: event, origin: CGPoint(x: noteX, y: noteY), env: env, into: &elements)
        }

        let plan = StemPlan(positions: positions, stemUp: stemUp, glyph: glyph, columnX: eventX)
        appendStemAndFlag(event: event, plan: plan, env: env, into: &elements)

        let anchorX = eventX + env.points(env.metrics.boundingBox(for: glyph)?.swX ?? 0)
        let frame = CGRect(
            x: anchorX,
            y: minY - env.noteheadWidth / 2,
            width: env.noteheadWidth,
            height: (maxY - minY) + env.noteheadWidth
        )
        elements.anchors.append(NoteAnchor(qnStart: event.qnStart, frame: frame))
    }

    /// One notehead plus its accidental, augmentation dot, and any ledger lines.
    private static func appendNotehead(
        _ note: NoteDescriptor,
        event: EventDescriptor,
        origin: CGPoint,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) {
        elements.noteheads.append(PositionedGlyph(
            glyph: noteheadGlyph(for: event.durationCode, isCross: note.isCross),
            origin: origin
        ))

        if let accidental = note.accidental {
            let accGlyph: Glyph = accidental == .sharp ? .accidentalSharp : .accidentalFlat
            let accWidth = env.metrics.boundingBox(for: accGlyph)?.width ?? 1.0
            let accX = origin.x - env.points(accWidth + MeasureLayoutMetrics.accidentalGapSpaces)
            elements.accidentals.append(PositionedGlyph(glyph: accGlyph, origin: CGPoint(x: accX, y: origin.y)))
        }

        if event.dotted {
            // Dot sits in the space to the right, nudged up into the space above when the note
            // is on a line (even position).
            let position = note.staffPosition
            let dotPosition = position % 2 == 0 ? position + 1 : position
            let dotX = origin.x + env.noteheadWidth + env.points(MeasureLayoutMetrics.dotGapSpaces)
            elements.dots.append(PositionedGlyph(
                glyph: .augmentationDot,
                origin: CGPoint(x: dotX, y: env.yPosition(dotPosition))
            ))
        }

        appendLedgerLines(position: note.staffPosition, noteX: origin.x, env: env, into: &elements)
    }

    private static func appendLedgerLines(
        position: Int,
        noteX: CGFloat,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) {
        let half = env.noteheadWidth / 2 + env.points(env.defaults.legerLineExtension)
        for ledgerY in env.geometry.ledgerLineYPositions(forPosition: position) {
            if elements.ledgerLines.contains(where: { abs($0.start.y - ledgerY) < 0.01 }) { continue }
            elements.ledgerLines.append(LineSegment(
                start: CGPoint(x: noteX - half, y: ledgerY),
                end: CGPoint(x: noteX + half, y: ledgerY),
                thickness: env.points(env.defaults.legerLineThickness)
            ))
        }
    }

    // MARK: Stem direction + second-interval displacement

    /// Below the middle line → stem up; on/above → stem down (`< middle` = strictly below).
    private static func stemPointsUp(positions: [Int]) -> Bool {
        guard !positions.isEmpty else { return true }
        let mean = Double(positions.reduce(0, +)) / Double(positions.count)
        return mean < Double(MeasureLayoutMetrics.middleLinePosition)
    }

    /// Horizontal shift for a notehead: displaced (second-interval) heads move one notehead
    /// width to the far side of the stem.
    private static func sideShift(displaced: Bool, stemUp: Bool, env: LayoutEnv) -> CGFloat {
        guard displaced else { return 0 }
        return stemUp ? env.noteheadWidth : -env.noteheadWidth
    }

    /// For each sorted (low→high) notehead, whether it is displaced to the far side of the stem
    /// because it forms a second with its inner neighbour. Walks outward from the stem: bottom→
    /// top on a stem-up chord, top→bottom on stem-down, so the note nearest the stem stays on
    /// the main column and its stepwise neighbour flips.
    static func secondDisplacement(sortedPositions positions: [Int], stemUp: Bool) -> [Bool] {
        guard positions.count > 1 else { return positions.map { _ in false } }
        var result = [Bool](repeating: false, count: positions.count)
        let order = stemUp ? Array(positions.indices) : Array(positions.indices.reversed())
        var previousIndex: Int?
        for index in order {
            if let prev = previousIndex, abs(positions[index] - positions[prev]) == 1, !result[prev] {
                result[index] = true
            }
            previousIndex = index
        }
        return result
    }

    // MARK: Stem + flag

    /// The inputs a stem needs: the chord's staff positions, direction, notehead glyph, and the
    /// event's column x.
    struct StemPlan {
        let positions: [Int]
        let stemUp: Bool
        let glyph: Glyph
        let columnX: CGFloat
    }

    private static func appendStemAndFlag(
        event: EventDescriptor,
        plan: StemPlan,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) {
        guard !event.durationCode.isStemless,
              let lowest = plan.positions.min(),
              let highest = plan.positions.max() else { return }
        let stem = layoutStem(plan: plan, lowest: lowest, highest: highest, env: env)
        elements.stems.append(stem.segment)
        if event.durationCode.hasFlag,
           let flag = flagGlyph(for: event.durationCode, stemUp: plan.stemUp, tip: stem.tip) {
            elements.flags.append(flag)
        }
    }

    private struct StemResult {
        let segment: LineSegment
        let tip: CGPoint
    }

    private static func layoutStem(plan: StemPlan, lowest: Int, highest: Int, env: LayoutEnv) -> StemResult {
        let stemLength = env.points(MeasureLayoutMetrics.stemLengthSpaces)
        let middleY = env.yPosition(MeasureLayoutMetrics.middleLinePosition)
        let thickness = env.points(env.defaults.stemThickness)

        if plan.stemUp {
            let anchor = env.metrics.stemUpSE(for: plan.glyph)
            let stemX = plan.columnX + env.points(anchor?.x ?? env.noteheadWidthSpaces)
            let baseY = env.yPosition(lowest) - env.points(anchor?.y ?? 0)
            // Tip 3.5 spaces above the highest note, extended to at least the middle line.
            let tip = CGPoint(x: stemX, y: min(env.yPosition(highest) - stemLength, middleY))
            let segment = LineSegment(start: CGPoint(x: stemX, y: baseY), end: tip, thickness: thickness)
            return StemResult(segment: segment, tip: tip)
        }
        let anchor = env.metrics.stemDownNW(for: plan.glyph)
        let stemX = plan.columnX + env.points(anchor?.x ?? 0)
        let baseY = env.yPosition(highest) - env.points(anchor?.y ?? 0)
        // Tip 3.5 spaces below the lowest note, extended to at least the middle line.
        let tip = CGPoint(x: stemX, y: max(env.yPosition(lowest) + stemLength, middleY))
        let segment = LineSegment(start: CGPoint(x: stemX, y: baseY), end: tip, thickness: thickness)
        return StemResult(segment: segment, tip: tip)
    }

    // MARK: Glyph selection

    private static func noteheadGlyph(for code: DurationCode, isCross: Bool) -> Glyph {
        if isCross {
            // Catalog has X noteheads only for half + black; whole-x (rare/absent in the corpus)
            // falls back to the black X. Documented in the C14 report.
            return code == .half ? .noteheadXHalf : .noteheadXBlack
        }
        switch code {
        case .whole: return .noteheadWhole
        case .half: return .noteheadHalf
        default: return .noteheadBlack
        }
    }

    private static func restGlyph(for code: DurationCode) -> Glyph {
        switch code {
        case .whole: return .restWhole
        case .half: return .restHalf
        case .quarter: return .restQuarter
        case .eighth: return .rest8th
        case .sixteenth: return .rest16th
        case .thirtySecond: return .rest32nd
        case .sixtyFourth: return .rest64th
        case .oneTwentyEighth: return .rest128th
        }
    }

    private static func flagGlyph(for code: DurationCode, stemUp: Bool, tip: CGPoint) -> PositionedGlyph? {
        let glyph: Glyph
        switch code {
        case .eighth: glyph = stemUp ? .flag8thUp : .flag8thDown
        case .sixteenth: glyph = stemUp ? .flag16thUp : .flag16thDown
        case .thirtySecond: glyph = stemUp ? .flag32ndUp : .flag32ndDown
        case .sixtyFourth: glyph = stemUp ? .flag64thUp : .flag64thDown
        case .oneTwentyEighth: glyph = stemUp ? .flag128thUp : .flag128thDown
        default: return nil
        }
        // Flag origin at the stem tip (SMuFL flags attach at the stem end). Approximate — flags
        // are usually removed by beaming (C15); documented in the C14 report.
        return PositionedGlyph(glyph: glyph, origin: tip)
    }

    // MARK: Clef + time signature

    static func clefGlyph(context: MeasureContext, env: LayoutEnv) -> PositionedGlyph {
        let clefX = env.geometry.originX + env.points(1.0)
        switch context.clef {
        case .treble:
            // G clef origin sits on the bottom line (position 0) — the SMuFL convention.
            return PositionedGlyph(glyph: .gClef, origin: CGPoint(x: clefX, y: env.yPosition(0)))
        case .percussion:
            // The web renderer always draws a treble clef; we draw a real percussion clef,
            // centered on the middle line — an intentional, isolated improvement (note
            // positions are treble-referenced either way). Documented in the C14 report.
            let middle = MeasureLayoutMetrics.middleLinePosition
            return PositionedGlyph(
                glyph: .unpitchedPercussionClef1,
                origin: CGPoint(x: clefX, y: env.yPosition(middle))
            )
        }
    }

    static func timeSignatureGlyphs(_ timeSignature: TimeSignature, env: LayoutEnv) -> [PositionedGlyph] {
        let startX = env.geometry.originX + env.points(4.5) // after the clef
        let numerator = digitGlyphs(timeSignature.numerator, startX: startX, baselineY: env.yPosition(6), env: env)
        let denominator = digitGlyphs(timeSignature.denominator, startX: startX, baselineY: env.yPosition(2), env: env)
        return numerator + denominator
    }

    /// One glyph per decimal digit, laid left-to-right (handles multi-digit meters like 12/8).
    private static func digitGlyphs(
        _ value: Int,
        startX: CGFloat,
        baselineY: CGFloat,
        env: LayoutEnv
    ) -> [PositionedGlyph] {
        let digits = String(max(0, value)).compactMap(\.wholeNumberValue)
        let advance = env.points(1.4) // approximate digit advance
        return digits.enumerated().map { index, digit in
            PositionedGlyph(
                glyph: timeSigDigitGlyph(digit),
                origin: CGPoint(x: startX + CGFloat(index) * advance, y: baselineY)
            )
        }
    }

    private static func timeSigDigitGlyph(_ digit: Int) -> Glyph {
        switch digit {
        case 0: return .timeSig0
        case 1: return .timeSig1
        case 2: return .timeSig2
        case 3: return .timeSig3
        case 4: return .timeSig4
        case 5: return .timeSig5
        case 6: return .timeSig6
        case 7: return .timeSig7
        case 8: return .timeSig8
        default: return .timeSig9
        }
    }
}
