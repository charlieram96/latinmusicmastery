import CoreGraphics
import ScoreModel
import XCTest

@testable import NotationEngraving

/// Golden-value + rule-matrix coverage for `MeasureLayoutEngine`. Everything is computed at
/// `staffSpacePoints = 10`, which makes 1 staff space == 10 points == the web renderer's own
/// "model unit" (`STAFF_LINE_SPAN 40 / 4 spaces`), so the constants here line up 1:1 with the
/// ported `staff-renderer.tsx` values.
final class MeasureLayoutTests: XCTestCase {
    /// 10 pt/space: points == web model px, and staff positions map to round y-values.
    private let scale = ScaleContext(staffSpacePoints: 10)
    /// Origin at (0, 40): top line y=40, bottom line y=80, `y(pos) = 80 - pos*5`.
    private let origin = CGPoint(x: 0, y: 40)
    private let acc: CGFloat = 1e-6

    private let fourFour = TimeSignature(numerator: 4, denominator: 4)

    private func bareContext() -> MeasureContext {
        MeasureContext(clef: .treble, timeSignature: fourFour, showClef: false, showTimeSignature: false)
    }

    private func headerContext() -> MeasureContext {
        MeasureContext(clef: .treble, timeSignature: fourFour, showClef: true, showTimeSignature: true)
    }

    /// A single-position note event with a given duration code.
    private func note(pos: Int, code: DurationCode = .quarter, dotted: Bool = false) -> EventDescriptor {
        let head = NoteDescriptor(staffPosition: pos, accidental: nil, midi: 64, isCross: false, keyString: "x")
        return EventDescriptor(
            kind: .note, qnStart: 0, durationQN: 1, beatInMeasure: 1, durationCode: code,
            isRest: false, dotted: dotted, notes: [head], midi: 64,
            triplet: false, tieToNext: false, articulation: nil
        )
    }

    /// Four ascending quarter notes built through the real descriptor pipeline (C4..F4).
    private func quarterNotes(_ midis: [Int]) -> [EventDescriptor] {
        let events = midis.map { MusicalEvent.note(Note(durationQN: 1, midi: $0)) }
        let voice = Voice(number: 1, events: events)
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil, stringMultiplicity: 1,
            channel: 0, defaultView: .staff, measures: [Measure(number: 1, voices: [voice])]
        )
        return EventDescriptorBuilder.extractTrackEvents(track: track, initialTimeSignature: fourFour).first!.events
    }

    private func layout(_ events: [EventDescriptor], context: MeasureContext) -> MeasureFrame {
        MeasureLayoutEngine.layout(events: events, context: context, origin: origin, scale: scale)
    }

    // MARK: Width accumulation (ported spacing model)

    func testWidthMatchesPortedSpacingModel() {
        // 4/4 measure of 4 quarters: measureWidth = max(4*9, 4*2.2) = 36 spaces = 360 pt.
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: bareContext())
        XCTAssertEqual(frame.width, 360, accuracy: acc)
    }

    func testDenseBarUsesPerNoteFloor() {
        // A bar with far more events than the beat-based width covers: the note-count floor
        // count*2.2 wins. 200 notes → 200*2.2 = 440 spaces = 4400 pt >> 4*9. The events are packed
        // WITHIN the 4-QN bar (qnStart 0…~4, small durations) so the bar is NOT over-full — this
        // isolates the per-note floor from the over-full widening exercised separately below.
        let events = (0..<200).map { index -> EventDescriptor in
            let head = NoteDescriptor(staffPosition: 0, accidental: nil, midi: 64, isCross: false, keyString: "e/4")
            return EventDescriptor(
                kind: .note, qnStart: Double(index) * 0.02, durationQN: 0.02, beatInMeasure: 1,
                durationCode: .sixteenth, isRest: false, dotted: false, notes: [head], midi: 64,
                triplet: false, tieToNext: false, articulation: nil
            )
        }
        XCTAssertEqual(layout(events, context: bareContext()).width, 4400, accuracy: acc)
    }

    // MARK: Over-full bar (more content than the meter admits)

    func testOverFullBarSpreadsEventsWithDistinctIncreasingPositions() {
        // 17 quarter notes crammed into a 4/4 bar — the corpus doc `1613b8d9` pathology. The
        // nominal measureQN is 4, but the actual content is 17 QN. The layout denominator must
        // widen to 17 so every event lands at a distinct, strictly-increasing x rather than piling
        // onto the right barline (which is what clamping the fraction to [0,1] against 4 QN did).
        let events = (0..<17).map { index -> EventDescriptor in
            let head = NoteDescriptor(staffPosition: 0, accidental: nil, midi: 64, isCross: false, keyString: "e/4")
            return EventDescriptor(
                kind: .note, qnStart: Double(index), durationQN: 1, beatInMeasure: 1,
                durationCode: .quarter, isRest: false, dotted: false, notes: [head], midi: 64,
                triplet: false, tieToNext: false, articulation: nil
            )
        }
        let frame = layout(events, context: bareContext())
        let noteXs = frame.noteheads.map(\.origin.x)
        XCTAssertEqual(noteXs.count, 17)
        // Adjacent x's strictly increasing by more than an epsilon (a full staff space). On a
        // monotonic run this also proves NO two noteheads collapse within that epsilon.
        for (left, right) in zip(noteXs, noteXs.dropFirst()) {
            XCTAssertGreaterThan(right - left, 1.0, "events must spread, not clamp onto the barline")
        }
        // The natural width widened ~17/4× vs a nominal 4/4 bar (max(4*9, 17*2.2) × 17/4).
        XCTAssertEqual(frame.width, max(4.0 * 9.0, 17.0 * 2.2) * (17.0 / 4.0) * 10, accuracy: 1e-3)
        // Every notehead sits left of the (widened) barline.
        XCTAssertTrue(noteXs.allSatisfy { $0 < frame.barline.start.x })
    }

    func testWellFormedFullBarIsNotWidened() {
        // A brim-full 4/4 bar (contentQN == measureQN == 4) must NOT trip the over-full path — its
        // width and note x's stay exactly nominal, so no well-formed golden shifts.
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: bareContext())
        XCTAssertEqual(frame.width, 360, accuracy: acc)
        XCTAssertEqual(frame.noteheads.map(\.origin.x), [10, 92.5, 175, 257.5])
    }

    // MARK: Golden x/y for four quarters

    func testGoldenNoteheadPositions() {
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: bareContext())
        // noteAreaSpaces = 36 - 1(leadIn) - 2(rightPad) = 33 → 330 pt; noteStartX = 10.
        // x = 10 + fraction*330, fraction = qnInMeasure/4 = {0, .25, .5, .75}.
        XCTAssertEqual(frame.noteheads.map(\.origin.x), [10, 92.5, 175, 257.5])
        // y = 80 - pos*5. C4 pos -2 → 90, D4 -1 → 85, E4 0 → 80, F4 1 → 75.
        XCTAssertEqual(frame.noteheads.map(\.origin.y), [90, 85, 80, 75])
        XCTAssertTrue(frame.noteheads.allSatisfy { $0.glyph == .noteheadBlack })
    }

    func testGoldenHeaderShiftsNotesRightWithoutChangingTotalWidth() {
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: headerContext())
        // Header lead-in = 8 spaces → noteStartX = 80; noteArea = 36-8-2 = 26 → 260 pt.
        XCTAssertEqual(frame.width, 360, accuracy: acc) // total width unchanged
        XCTAssertEqual(frame.noteheads.first?.origin.x ?? -1, 80, accuracy: acc)
        XCTAssertEqual(frame.noteheads.last?.origin.x ?? -1, 80 + 0.75 * 260, accuracy: acc)
        XCTAssertNotNil(frame.clef)
        XCTAssertFalse(frame.timeSignature.isEmpty)
    }

    // MARK: Meter change (measureStartQN anchor)

    func testDownbeatAfterMeterChangeLandsAtFractionZero() {
        // A 4/4 measure (4 quarters) followed by a 3/4 measure (3 quarters): the second measure
        // starts at cumulative QN 4, which is NOT a multiple of its own 3-QN length — exactly
        // the case a naive `qnStart % measureQN` gets wrong (4 % 3 = 1 → fraction 1/3 instead
        // of the correct 0).
        let threeFour = TimeSignature(numerator: 3, denominator: 4)
        let firstMeasureEvents: [MusicalEvent] = [60, 62, 64, 65].map { .note(Note(durationQN: 1, midi: $0)) }
        let secondMeasureEvents: [MusicalEvent] = [67, 69, 71].map { .note(Note(durationQN: 1, midi: $0)) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil, stringMultiplicity: 1,
            channel: 0, defaultView: .staff,
            measures: [
                Measure(number: 1, voices: [Voice(number: 1, events: firstMeasureEvents)]),
                Measure(number: 2, timeSignature: threeFour, voices: [Voice(number: 1, events: secondMeasureEvents)])
            ]
        )
        let measures = EventDescriptorBuilder.extractTrackEvents(track: track, initialTimeSignature: fourFour)
        XCTAssertEqual(measures.count, 2)
        let second = measures[1]
        XCTAssertEqual(second.cumulativeQN, 4, accuracy: acc) // anchor: measure 1 is 4 QN long
        XCTAssertEqual(second.timeSignature, threeFour)

        let context = MeasureContext(
            clef: .treble, timeSignature: threeFour, showClef: false, showTimeSignature: false,
            measureStartQN: second.cumulativeQN
        )
        let frame = layout(second.events, context: context)

        // measureWidth(3/4) = max(3*9, 3*2.2) = 27 spaces = 270pt; bare lead-in 1, trailing pad 2
        // → noteArea = 27-1-2 = 24 spaces = 240pt; noteStartX = 10.
        XCTAssertEqual(frame.width, 270, accuracy: acc)
        // Downbeat (qnStart=4=measureStartQN) → fraction 0 → x = noteStartX = 10.
        XCTAssertEqual(frame.noteheads.first?.origin.x ?? -1, 10, accuracy: acc)
        // Mid-measure note (qnStart=5) → fraction (5-4)/3 = 1/3.
        XCTAssertEqual(frame.noteheads[1].origin.x, 10 + (1.0 / 3.0) * 240, accuracy: 1e-3)
        // Last beat (qnStart=6) → fraction 2/3.
        XCTAssertEqual(frame.noteheads[2].origin.x, 10 + (2.0 / 3.0) * 240, accuracy: 1e-3)
    }

    // MARK: Stem direction matrix

    /// One row of the stem-direction matrix.
    private struct StemCase {
        let position: Int
        let expectUp: Bool
    }

    func testStemDirectionMatrix() {
        // pos < 4 (below middle) → up; pos >= 4 → down. Middle line (4, B4) → down.
        let cases = [
            StemCase(position: -2, expectUp: true),  // C4
            StemCase(position: 0, expectUp: true),   // E4
            StemCase(position: 3, expectUp: true),   // A4
            StemCase(position: 4, expectUp: false),  // B4 middle line → down
            StemCase(position: 5, expectUp: false),  // C5
            StemCase(position: 8, expectUp: false)   // F5
        ]
        for testCase in cases {
            let frame = layout([note(pos: testCase.position)], context: bareContext())
            guard let stem = frame.stems.first else { return XCTFail("no stem at \(testCase.position)") }
            // Stem up: tip (end) is above the base (smaller y). Stem down: tip below.
            XCTAssertEqual(stem.end.y < stem.start.y, testCase.expectUp, "pos \(testCase.position)")
        }
    }

    func testStemLengthAndAnchorForSingleNote() {
        // E4 (pos 0) quarter, stem up. stemUpSE anchor = (1.18, 0.168) spaces.
        guard let stem = layout([note(pos: 0)], context: bareContext()).stems.first else {
            return XCTFail("no stem")
        }
        // stemX = noteX(10) + 1.18*10 = 21.8; base y = y(0)=80 - 0.168*10 = 78.32.
        XCTAssertEqual(stem.start.x, 21.8, accuracy: acc)
        XCTAssertEqual(stem.start.y, 78.32, accuracy: acc)
        // tip = min(y(0) - 3.5*10, middleY=y(4)=60) = min(45, 60) = 45.
        XCTAssertEqual(stem.end.y, 45, accuracy: acc)
    }

    func testWholeNoteHasNoStemOrFlag() {
        let frame = layout([note(pos: 0, code: .whole)], context: bareContext())
        XCTAssertTrue(frame.stems.isEmpty)
        XCTAssertTrue(frame.flags.isEmpty)
        XCTAssertEqual(frame.noteheads.first?.glyph, .noteheadWhole)
    }

    func testEighthNoteGetsFlag() {
        let frame = layout([note(pos: 0, code: .eighth)], context: bareContext())
        XCTAssertEqual(frame.flags.count, 1)
        XCTAssertEqual(frame.flags.first?.glyph, .flag8thUp) // pos 0 → stem up
    }

    // MARK: Ledger lines

    func testLedgerLineCounts() {
        // C4 (pos -2) needs 1 ledger below; A5 (pos 10) needs 1 ledger above; middle-staff none.
        let below = layout(quarterNotes([60]), context: bareContext()) // C4 pos -2
        XCTAssertEqual(below.ledgerLines.count, 1)
        XCTAssertEqual(below.ledgerLines.first?.start.y ?? -1, 90, accuracy: acc) // y(-2)=90

        XCTAssertEqual(layout(quarterNotes([81]), context: bareContext()).ledgerLines.count, 1) // A5 pos 10
        XCTAssertEqual(layout(quarterNotes([67]), context: bareContext()).ledgerLines.count, 0) // G4 pos 2
    }

    func testLedgerLineExtentCentersOnNotehead() {
        guard let ledger = layout(quarterNotes([60]), context: bareContext()).ledgerLines.first else {
            return XCTFail("no ledger")
        }
        // half = noteheadWidth(1.18)*10/2 + legerLineExtension(0.4)*10 = 5.9 + 4 = 9.9. Centered at x=10.
        XCTAssertEqual(ledger.start.x, 10 - 9.9, accuracy: 1e-3)
        XCTAssertEqual(ledger.end.x, 10 + 9.9, accuracy: 1e-3)
    }

    func testLedgerLinesNotDedupedAcrossRepeatedPitchEvents() {
        // Two consecutive C4s (pos -2, one ledger each at y(-2)=90) followed by two in-staff
        // notes. A prior bug deduped ledgers by y alone, so the second C4's ledger — sharing y
        // with the first but sitting at a different x — was silently dropped. Both must survive,
        // at their own (distinct) event x.
        let frame = layout(quarterNotes([60, 60, 64, 65]), context: bareContext())
        XCTAssertEqual(frame.ledgerLines.count, 2, "each C4 should get its own ledger line")
        guard frame.ledgerLines.count == 2 else { return }
        let sortedByX = frame.ledgerLines.sorted { $0.start.x < $1.start.x }
        XCTAssertEqual(sortedByX[0].start.y, 90, accuracy: acc)
        XCTAssertEqual(sortedByX[1].start.y, 90, accuracy: acc)
        XCTAssertGreaterThan(sortedByX[1].start.x, sortedByX[0].start.x + 1, "ledgers should sit at distinct x")
    }

    func testChordSharedLedgerCollapsesToOneLine() {
        // Chord of C4 (pos -2, needs 1 ledger at y(-2)=90) + A3 (pos -4, needs 2 ledgers at
        // y(-2)=90 and y(-4)=100). The positions differ by 2 (not a stepwise second), so neither
        // notehead is displaced — both sit at the same (undisplaced) column x. The shared
        // y(-2) ledger must still collapse to a single line for that column: 2 total ledgers
        // (90, 100), not 3.
        let upper = NoteDescriptor(staffPosition: -2, accidental: nil, midi: 60, isCross: false, keyString: "c/4")
        let lower = NoteDescriptor(staffPosition: -4, accidental: nil, midi: 57, isCross: false, keyString: "a/3")
        let chord = EventDescriptor(
            kind: .chord, qnStart: 0, durationQN: 1, beatInMeasure: 1, durationCode: .quarter,
            isRest: false, dotted: false, notes: [upper, lower], midi: 57,
            triplet: false, tieToNext: false, articulation: nil
        )
        let frame = layout([chord], context: bareContext())
        XCTAssertEqual(frame.ledgerLines.count, 2, "shared ledger should collapse, not double up")
        guard frame.ledgerLines.count == 2 else { return }
        let sortedByY = frame.ledgerLines.sorted { $0.start.y < $1.start.y }
        XCTAssertEqual(sortedByY.map(\.start.y), [90, 100])
        // Both ledgers sit at the same (undisplaced) chord column x.
        XCTAssertEqual(sortedByY[0].start.x, sortedByY[1].start.x, accuracy: acc)
    }

    // MARK: Accidental offset

    func testAccidentalSitsLeftOfNoteheadByMetricsGap() {
        // C#4 in a sharp key → sharp accidental left of the notehead.
        let head = NoteDescriptor(staffPosition: -2, accidental: .sharp, midi: 61, isCross: false, keyString: "c#/4")
        let event = EventDescriptor(
            kind: .note, qnStart: 0, durationQN: 1, beatInMeasure: 1, durationCode: .quarter,
            isRest: false, dotted: false, notes: [head], midi: 61, triplet: false, tieToNext: false, articulation: nil
        )
        guard let accidental = layout([event], context: bareContext()).accidentals.first else {
            return XCTFail("no accidental")
        }
        XCTAssertEqual(accidental.glyph, .accidentalSharp)
        let sharpWidth = GlyphMetrics.shared.boundingBox(for: .accidentalSharp)!.width
        // accX = noteX(10) - (sharpWidth + 0.28)*10.
        XCTAssertEqual(accidental.origin.x, 10 - CGFloat(sharpWidth + 0.28) * 10, accuracy: 1e-3)
    }

    // MARK: Dotted note line adjustment

    func testDottedNoteOnLineNudgesDotUpToSpaceAbove() {
        // Note on the bottom line (pos 0, even) → dot moves to the space above (pos 1) → y(1)=75.
        let onLine = layout([note(pos: 0, dotted: true)], context: bareContext())
        XCTAssertEqual(onLine.augmentationDots.first?.origin.y ?? -1, 75, accuracy: acc)
        // Note in a space (pos 1, odd) → dot stays in that space → y(1)=75.
        let inSpace = layout([note(pos: 1, dotted: true)], context: bareContext())
        XCTAssertEqual(inSpace.augmentationDots.first?.origin.y ?? -1, 75, accuracy: acc)
    }

    // MARK: Chord second-interval displacement

    func testChordSecondFlipsNoteheadAcrossStem() {
        // Chord B4 (pos 4) + C5 (pos 5): a second. mean 4.5 → stem down. The lower note flips
        // to the LEFT of the stem (stem-down side rule).
        let low = NoteDescriptor(staffPosition: 4, accidental: nil, midi: 71, isCross: false, keyString: "b/4")
        let high = NoteDescriptor(staffPosition: 5, accidental: nil, midi: 72, isCross: false, keyString: "c/5")
        let chord = EventDescriptor(
            kind: .chord, qnStart: 0, durationQN: 1, beatInMeasure: 1, durationCode: .quarter,
            isRest: false, dotted: false, notes: [low, high], midi: 71,
            triplet: false, tieToNext: false, articulation: nil
        )
        let frame = layout([chord], context: bareContext())
        XCTAssertEqual(frame.noteheads.count, 2)
        // Column x is the event x (10). noteheadWidth = 11.8 pt. pos 4 → y=60, pos 5 → y=55.
        let lowHead = frame.noteheads.first { $0.origin.y == 60 }
        let highHead = frame.noteheads.first { $0.origin.y == 55 }
        XCTAssertEqual(lowHead?.origin.x ?? -1, 10 - 11.8, accuracy: 1e-3) // displaced left
        XCTAssertEqual(highHead?.origin.x ?? -1, 10, accuracy: acc)         // main column
        XCTAssertEqual(frame.stems.count, 1)
    }

    // MARK: Rests + barline + anchors

    private func rest(_ code: DurationCode, dur: Double = 2) -> EventDescriptor {
        EventDescriptor(
            kind: .rest, qnStart: 0, durationQN: dur, beatInMeasure: 1, durationCode: code,
            isRest: true, dotted: false, notes: [], midi: nil, triplet: false, tieToNext: false, articulation: nil
        )
    }

    func testRestGlyphAndConventionalPosition() {
        let half = layout([rest(.half)], context: bareContext())
        XCTAssertEqual(half.rests.first?.glyph, .restHalf)
        XCTAssertEqual(half.rests.first?.origin.y ?? -1, 60, accuracy: acc) // middle line y(4)=60

        let whole = layout([rest(.whole, dur: 4)], context: bareContext())
        XCTAssertEqual(whole.rests.first?.glyph, .restWhole)
        XCTAssertEqual(whole.rests.first?.origin.y ?? -1, 50, accuracy: acc) // hangs from pos 6 → y(6)=50
    }

    func testBarlineAtRightEdge() {
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: bareContext())
        XCTAssertEqual(frame.barline.start.x, 360, accuracy: acc)
        XCTAssertEqual(frame.barline.end.x, 360, accuracy: acc)
        XCTAssertEqual(frame.barline.start.y, 40, accuracy: acc) // top line
        XCTAssertEqual(frame.barline.end.y, 80, accuracy: acc)   // bottom line
    }

    func testNoteAnchorsCarryQnStartInOrder() {
        let frame = layout(quarterNotes([60, 62, 64, 65]), context: bareContext())
        XCTAssertEqual(frame.noteAnchors.map(\.qnStart), [0, 1, 2, 3])
        for (anchor, notehead) in zip(frame.noteAnchors, frame.noteheads) {
            XCTAssertTrue(anchor.frame.width > 0 && anchor.frame.height > 0)
            XCTAssertTrue(anchor.frame.minX <= notehead.origin.x + 1)
        }
    }
}
