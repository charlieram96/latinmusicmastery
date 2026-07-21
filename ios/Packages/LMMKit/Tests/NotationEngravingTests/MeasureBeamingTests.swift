import CoreGraphics
import ScoreModel
import XCTest

@testable import NotationEngraving

/// Integration coverage for the C15 rhythm layer inside `MeasureLayoutEngine`: that beam groups
/// produce beams and suppress flags, share one stem direction, and that ties render.
final class MeasureBeamingTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 10)
    private let origin = CGPoint(x: 0, y: 40)
    private let fourFour = TimeSignature(numerator: 4, denominator: 4)

    private func bareContext() -> MeasureContext {
        MeasureContext(clef: .treble, timeSignature: fourFour, showClef: false, showTimeSignature: false)
    }

    private func layout(_ events: [EventDescriptor]) -> MeasureFrame {
        MeasureLayoutEngine.layout(events: events, context: bareContext(), origin: origin, scale: scale)
    }

    private func eighth(qnStart: Double, pos: Int, tie: Bool = false) -> EventDescriptor {
        let head = NoteDescriptor(staffPosition: pos, accidental: nil, midi: 64, isCross: false, keyString: "e/4")
        return EventDescriptor(
            kind: .note, qnStart: qnStart, durationQN: 0.5, beatInMeasure: qnStart + 1, durationCode: .eighth,
            isRest: false, dotted: false, notes: [head], midi: 64, triplet: false, tieToNext: tie, articulation: nil
        )
    }

    func testBeamedEighthsProduceBeamAndSuppressFlags() {
        // Two eighths in one beat → one beam, both flags removed, both stems reach the beam line.
        let frame = layout([eighth(qnStart: 0, pos: 0), eighth(qnStart: 0.5, pos: 0)])
        XCTAssertFalse(frame.beams.isEmpty, "beamed eighths must produce a beam")
        XCTAssertTrue(frame.flags.isEmpty, "beamed notes drop their flags")
        XCTAssertEqual(frame.stems.count, 2)
        let beam = frame.beams[0]
        for stem in frame.stems {
            XCTAssertEqual(stem.end.y, beam.start.y, accuracy: 1e-6, "each stem reaches the beam")
        }
    }

    func testLoneEighthKeepsItsFlagAndDrawsNoBeam() {
        // eighth, eighth-rest: the lone eighth cannot beam → keeps its flag, no beam.
        let rest = EventDescriptor(
            kind: .rest, qnStart: 0.5, durationQN: 0.5, beatInMeasure: 1.5, durationCode: .eighth,
            isRest: true, dotted: false, notes: [], midi: nil, triplet: false, tieToNext: false, articulation: nil
        )
        let frame = layout([eighth(qnStart: 0, pos: 0), rest])
        XCTAssertTrue(frame.beams.isEmpty)
        XCTAssertEqual(frame.flags.count, 1)
    }

    func testBeamGroupSharesOneStemDirection() {
        // A beat mixing a below-middle note (pos 0, stem-up alone) and a high note (pos 10,
        // stem-down alone): the group's mean (5) is ≥ middle → both stem down (beam below).
        let frame = layout([eighth(qnStart: 0, pos: 0), eighth(qnStart: 0.5, pos: 10)])
        XCTAssertEqual(frame.beams.count, 1)
        XCTAssertGreaterThan(frame.beams[0].start.y, 80, "beam sits below both noteheads")
    }

    func testTieProducesArcBetweenSamePitchNotes() {
        let head = NoteDescriptor(staffPosition: 2, accidental: nil, midi: 67, isCross: false, keyString: "g/4")
        let first = EventDescriptor(
            kind: .note, qnStart: 0, durationQN: 1, beatInMeasure: 1, durationCode: .quarter,
            isRest: false, dotted: false, notes: [head], midi: 67, triplet: false, tieToNext: true, articulation: nil
        )
        let second = EventDescriptor(
            kind: .note, qnStart: 1, durationQN: 1, beatInMeasure: 2, durationCode: .quarter,
            isRest: false, dotted: false, notes: [head], midi: 67, triplet: false, tieToNext: false, articulation: nil
        )
        let frame = layout([first, second])
        XCTAssertEqual(frame.ties.count, 1)
        XCTAssertLessThan(frame.ties[0].start.x, frame.ties[0].end.x)
    }
}
