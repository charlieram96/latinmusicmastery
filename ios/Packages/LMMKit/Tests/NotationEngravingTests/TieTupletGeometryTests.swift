import CoreGraphics
import XCTest

@testable import NotationEngraving

/// Golden-value coverage for `TieGeometry` and `TupletBracket` at 10 pt/space.
final class TieTupletGeometryTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 10)
    private let defaults = GlyphMetrics.shared.engravingDefaults
    private let acc: CGFloat = 1e-6

    // MARK: Ties

    func testTieEndpointsInsetAndArcBelowForStemUp() {
        // From notehead at (10,80) to (100,80), width 11.8. Stem up → tie below (arc toward +y).
        let tie = TieGeometry.tie(
            endpoints: TieGeometry.Endpoints(
                fromCenter: CGPoint(x: 10, y: 80), toCenter: CGPoint(x: 100, y: 80),
                noteheadWidth: 11.8, stemUp: true
            ),
            scale: scale, defaults: defaults
        )
        // start = right edge (10 + 11.8) + inset(2), y = 80 + offset(4).
        XCTAssertEqual(tie.start, CGPoint(x: 23.8, y: 84))
        // end = 100 − inset(2), y = 84.
        XCTAssertEqual(tie.end, CGPoint(x: 98, y: 84))
        // Controls bulge DOWN (below the endpoints) by the 9 pt arc height.
        XCTAssertEqual(tie.control1.y, 93, accuracy: acc)
        XCTAssertEqual(tie.control2.y, 93, accuracy: acc)
        XCTAssertEqual(tie.thickness, scale.points(defaults.tieMidpointThickness), accuracy: acc)
    }

    func testTieArcFlipsAboveForStemDown() {
        let tie = TieGeometry.tie(
            endpoints: TieGeometry.Endpoints(
                fromCenter: CGPoint(x: 10, y: 40), toCenter: CGPoint(x: 100, y: 40),
                noteheadWidth: 11.8, stemUp: false
            ),
            scale: scale, defaults: defaults
        )
        // Stem down → tie above: endpoints offset up (y 36), controls further up (y 27).
        XCTAssertEqual(tie.start.y, 36, accuracy: acc)
        XCTAssertEqual(tie.control1.y, 27, accuracy: acc)
    }

    // MARK: Tuplets

    func testFullyBeamedTripletIsDigitOnlyCentered() {
        let bbox = GlyphMetrics.shared.boundingBox(for: .tuplet3)
        let shape = TupletBracket.tuplet(
            run: TupletBracket.Run(stemXs: [0, 45, 90], referenceYs: [45, 45, 45], stemUp: true, fullyBeamed: true),
            digitGlyph: .tuplet3, digitBBox: bbox, scale: scale, defaults: defaults
        )
        let unwrapped = try? XCTUnwrap(shape)
        XCTAssertNotNil(unwrapped)
        XCTAssertTrue(unwrapped?.bracket.isEmpty ?? false, "fully-beamed tuplet shows the digit only")
        // Digit horizontally centered over the run midpoint (x 45).
        let digitWidth = scale.points(bbox?.width ?? 1)
        XCTAssertEqual(unwrapped?.digit.origin.x ?? -1, 45 - digitWidth / 2, accuracy: acc)
        XCTAssertEqual(unwrapped?.digit.glyph, .tuplet3)
    }

    func testUnbeamedTripletDrawsBracketWithHooks() {
        let shape = TupletBracket.tuplet(
            run: TupletBracket.Run(stemXs: [0, 45, 90], referenceYs: [45, 45, 45], stemUp: true, fullyBeamed: false),
            digitGlyph: .tuplet3, digitBBox: GlyphMetrics.shared.boundingBox(for: .tuplet3),
            scale: scale, defaults: defaults
        )
        guard let shape else { return XCTFail("expected a tuplet shape") }
        XCTAssertFalse(shape.bracket.isEmpty, "an unbeamed tuplet draws a bracket")
        // Bracket sits above the beam reference (stem up): bracketY = min tip (45) − gap (12) = 33.
        let hookXs = Set(shape.bracket.map { $0.start.x })
        XCTAssertTrue(hookXs.contains(0) && hookXs.contains(90), "hooks at the run's first + last stems")
        XCTAssertTrue(shape.bracket.contains { $0.start.y == 33 || $0.end.y == 33 }, "bracket line at y 33")
    }

    func testTupletBelowForStemDown() {
        let shape = TupletBracket.tuplet(
            run: TupletBracket.Run(stemXs: [0, 90], referenceYs: [75, 75], stemUp: false, fullyBeamed: false),
            digitGlyph: .tuplet3, digitBBox: GlyphMetrics.shared.boundingBox(for: .tuplet3),
            scale: scale, defaults: defaults
        )
        guard let shape else { return XCTFail("expected a tuplet shape") }
        // Stem down → below: bracketY = max tip (75) + gap (12) = 87.
        XCTAssertTrue(shape.bracket.contains { $0.start.y == 87 || $0.end.y == 87 })
    }
}
