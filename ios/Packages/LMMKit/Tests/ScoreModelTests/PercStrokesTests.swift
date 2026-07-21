import XCTest

@testable import ScoreModel

/// Spot-checks `PercStrokes` against `lib/playsense-studio/perc-strokes.ts` — that module
/// has no dedicated web test suite, so this is fixture-free coverage rather than a
/// case-for-case port.
final class PercStrokesTests: XCTestCase {
    func testIsPercussionMatchesThePercPrefixConvention() {
        XCTAssertTrue(PercStrokes.isPercussion(.percConga))
        XCTAssertTrue(PercStrokes.isPercussion(.percKit))
        XCTAssertFalse(PercStrokes.isPercussion(.guitar))
        XCTAssertFalse(PercStrokes.isPercussion(.piano))
    }

    func testPitchedInstrumentsHaveNoStrokePalette() {
        XCTAssertNil(PercStrokes.strokes(for: .guitar))
        XCTAssertNil(PercStrokes.strokes(for: .bass))
    }

    func testCongaStrokesMatchTheFixtureMidiValues() throws {
        let strokes = try XCTUnwrap(PercStrokes.strokes(for: .percConga))
        XCTAssertEqual(strokes.count, 5)

        // The conga fixture in score-fixtures.ts uses 62/63/64 for slap/open-low/open-high.
        XCTAssertEqual(PercStrokes.stroke(for: .percConga, midi: 64)?.id, "open-high")
        XCTAssertEqual(PercStrokes.stroke(for: .percConga, midi: 62)?.id, "slap")
        XCTAssertEqual(PercStrokes.stroke(for: .percConga, midi: 62)?.noteType, .xNotehead)
        XCTAssertEqual(PercStrokes.stroke(for: .percConga, midi: 63)?.id, "open-low")
        XCTAssertNil(PercStrokes.stroke(for: .percConga, midi: 63)?.noteType)
    }

    func testUnknownMidiResolvesToNilStroke() {
        XCTAssertNil(PercStrokes.stroke(for: .percConga, midi: 127))
    }

    func testClaveHasExactlyOneStroke() {
        let strokes = PercStrokes.strokes(for: .percClave)
        XCTAssertEqual(strokes?.count, 1)
        XCTAssertEqual(strokes?.first?.id, "stroke")
    }
}
