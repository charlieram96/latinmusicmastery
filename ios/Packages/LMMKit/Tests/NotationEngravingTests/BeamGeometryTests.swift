import CoreGraphics
import XCTest

@testable import NotationEngraving

/// Golden-value coverage for `BeamGeometry` at 10 pt/space (so 1 space == 10 pt and constants
/// read directly): slant clamp, min-stem positioning, secondary bars, partial stubs, direction.
final class BeamGeometryTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 10)
    private let defaults = GlyphMetrics.shared.engravingDefaults
    private let acc: CGFloat = 1e-6

    private func note(stemX: CGFloat, headY: CGFloat, beams: Int = 1) -> BeamGeometry.Note {
        BeamGeometry.Note(stemX: stemX, beamSideNoteheadY: headY, beamCount: beams)
    }

    private func layout(_ notes: [BeamGeometry.Note], stemUp: Bool) -> BeamGeometry.Result {
        BeamGeometry.layout(notes: notes, stemUp: stemUp, scale: scale, defaults: defaults)
    }

    // MARK: Flat beam (equal pitches)

    func testFlatBeamSitsOneStemLengthAboveNoteheads() {
        // Two equal-pitch eighths, stem up: beam is flat, 3.5 spaces (35 pt) above the heads.
        let result = layout([note(stemX: 0, headY: 80), note(stemX: 90, headY: 80)], stemUp: true)
        XCTAssertEqual(result.segments.count, 1) // primary only
        XCTAssertEqual(result.segments[0].start, CGPoint(x: 0, y: 45))
        XCTAssertEqual(result.segments[0].end, CGPoint(x: 90, y: 45))
        XCTAssertEqual(result.segments[0].thickness, 5, accuracy: acc) // 0.5 space
        XCTAssertEqual(result.stemTips, [45, 45])
    }

    // MARK: Slant clamp

    func testSteepRiseIsClampedToOneStaffSpace() {
        // First head low (y 80), last head high (y 40) — a 40 pt natural rise. Clamped to ±1
        // space (10 pt): beam drops from y 15 to y 5, and the extreme (last) note keeps exactly
        // a 35 pt stem.
        let result = layout([note(stemX: 0, headY: 80), note(stemX: 90, headY: 40)], stemUp: true)
        XCTAssertEqual(result.segments[0].start.y, 15, accuracy: acc)
        XCTAssertEqual(result.segments[0].end.y, 5, accuracy: acc)
        // Rise across the beam is the clamped −10, not the natural −40.
        XCTAssertEqual(result.segments[0].end.y - result.segments[0].start.y, -10, accuracy: acc)
        // Highest note (last) stem is exactly 35 pt; the lower (first) note stem is longer.
        XCTAssertEqual(80 - result.stemTips[0], 65, accuracy: acc)
        XCTAssertEqual(40 - result.stemTips[1], 35, accuracy: acc)
    }

    // MARK: Secondary bars

    func testSixteenthGroupGetsFullSecondaryBar() {
        // Two sixteenths: primary + one full secondary bar, inset toward the noteheads by
        // beamThickness + beamSpacing = 0.75 space = 7.5 pt (stem-up → +y).
        let result = layout([note(stemX: 0, headY: 80, beams: 2), note(stemX: 90, headY: 80, beams: 2)], stemUp: true)
        XCTAssertEqual(result.segments.count, 2)
        XCTAssertEqual(result.segments[1].start.y, 52.5, accuracy: acc)
        XCTAssertEqual(result.segments[1].end.y, 52.5, accuracy: acc)
        // Stems still reach the (outer) primary beam.
        XCTAssertEqual(result.stemTips, [45, 45])
    }

    func testDottedEighthSixteenthStubPointsLeft() {
        // Eighth then sixteenth: the lone sixteenth (index 1, not first) gets a partial stub
        // pointing LEFT (toward the eighth it belongs with).
        let result = layout([note(stemX: 0, headY: 80, beams: 1), note(stemX: 45, headY: 80, beams: 2)], stemUp: true)
        XCTAssertEqual(result.segments.count, 2)
        let stub = result.segments[1]
        XCTAssertEqual(stub.start.x, 45, accuracy: acc)
        XCTAssertEqual(stub.end.x, 35, accuracy: acc) // 45 − 10 (one space), leftward
        XCTAssertEqual(stub.start.y, 52.5, accuracy: acc)
    }

    func testFirstNoteStubPointsRight() {
        // Sixteenth then eighth: the lone sixteenth is the first note → stub points RIGHT.
        let result = layout([note(stemX: 0, headY: 80, beams: 2), note(stemX: 45, headY: 80, beams: 1)], stemUp: true)
        let stub = result.segments[1]
        XCTAssertEqual(stub.start.x, 0, accuracy: acc)
        XCTAssertEqual(stub.end.x, 10, accuracy: acc) // 0 + 10, rightward
    }

    // MARK: Direction

    func testStemDownBeamSitsBelowNoteheads() {
        // High notes, stem down: beam is 35 pt BELOW the heads (larger y).
        let result = layout([note(stemX: 0, headY: 40), note(stemX: 90, headY: 40)], stemUp: false)
        XCTAssertEqual(result.segments[0].start.y, 75, accuracy: acc)
        XCTAssertEqual(result.stemTips, [75, 75])
    }
}
