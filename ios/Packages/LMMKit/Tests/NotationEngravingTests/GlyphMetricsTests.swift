import XCTest

@testable import NotationEngraving

/// End-to-end coverage against the *real*, bundled `bravura_metadata.json` (Bravura 1.392,
/// from github.com/steinbergmedia/bravura — see the task report for exact provenance/commit).
/// `GlyphMetricsParsingTests` covers the pure decode logic against a hand-written fixture;
/// this file proves the actual shipped file parses and that the catalog lines up with it.
final class GlyphMetricsTests: XCTestCase {
    private lazy var metrics = GlyphMetrics.shared

    func testLoadsRealBundledMetadata() {
        XCTAssertEqual(metrics.fontName, "Bravura")
        XCTAssertEqual(metrics.fontVersion, 1.392)
    }

    func testEngravingDefaultsParsedFromRealFile() {
        // Spot-checked against redist/bravura_metadata.json directly (task report has the
        // full dump). These are Bravura's shipped values, not made up.
        XCTAssertEqual(metrics.engravingDefaults.staffLineThickness, 0.13)
        XCTAssertEqual(metrics.engravingDefaults.stemThickness, 0.12)
        XCTAssertEqual(metrics.engravingDefaults.beamThickness, 0.5)
        XCTAssertEqual(metrics.engravingDefaults.legerLineThickness, 0.16)
        XCTAssertEqual(metrics.engravingDefaults.legerLineExtension, 0.4)
        XCTAssertEqual(metrics.engravingDefaults.thinBarlineThickness, 0.16)
    }

    /// Every catalog glyph must resolve to a bounding box in the real metadata — a glyph
    /// added to `Glyph` with a typo'd `smuflName`, or one Bravura doesn't actually define,
    /// would fail here.
    func testEveryCatalogGlyphHasABoundingBoxInRealMetadata() {
        for glyph in Glyph.allCases {
            let codepoint = String(glyph.codepoint.value, radix: 16, uppercase: true)
            XCTAssertNotNil(
                metrics.boundingBox(for: glyph),
                "\(glyph.smuflName) (U+\(codepoint)) has no bbox in bravura_metadata.json"
            )
        }
    }

    // MARK: Spot-checks — 3 known bbox values, read directly from bravura_metadata.json.

    func testSpotCheckNoteheadBlackBoundingBox() throws {
        let bbox = try XCTUnwrap(metrics.boundingBox(for: .noteheadBlack))
        XCTAssertEqual(bbox.neX, 1.18)
        XCTAssertEqual(bbox.neY, 0.5)
        XCTAssertEqual(bbox.swX, 0.0)
        XCTAssertEqual(bbox.swY, -0.5)
    }

    func testSpotCheckGClefBoundingBox() throws {
        let bbox = try XCTUnwrap(metrics.boundingBox(for: .gClef))
        XCTAssertEqual(bbox.neX, 2.684)
        XCTAssertEqual(bbox.neY, 4.392)
        XCTAssertEqual(bbox.swX, 0.0)
        XCTAssertEqual(bbox.swY, -2.632)
    }

    func testSpotCheckRestQuarterBoundingBox() throws {
        let bbox = try XCTUnwrap(metrics.boundingBox(for: .restQuarter))
        XCTAssertEqual(bbox.neX, 1.08)
        XCTAssertEqual(bbox.neY, 1.492)
        XCTAssertEqual(bbox.swX, 0.004)
        XCTAssertEqual(bbox.swY, -1.5)
    }

    // MARK: Anchors

    func testNoteheadBlackStemAnchorsFromRealMetadata() throws {
        let stemUpSE = try XCTUnwrap(metrics.stemUpSE(for: .noteheadBlack))
        XCTAssertEqual(stemUpSE.x, 1.18)
        XCTAssertEqual(stemUpSE.y, 0.168)

        let stemDownNW = try XCTUnwrap(metrics.stemDownNW(for: .noteheadBlack))
        XCTAssertEqual(stemDownNW.x, 0.0)
        XCTAssertEqual(stemDownNW.y, -0.168)
    }

    func testNoteheadXBlackStemAnchorsFromRealMetadata() throws {
        // A different notehead glyph, to confirm the anchor lookup isn't accidentally
        // hardcoded to noteheadBlack's values.
        let stemUpSE = try XCTUnwrap(metrics.stemUpSE(for: .noteheadXBlack))
        XCTAssertEqual(stemUpSE.x, 1.16)
        XCTAssertEqual(stemUpSE.y, 0.444)
    }

    func testWholeNoteHasNoStemAnchors() {
        // noteheadWhole never takes a stem — Bravura's metadata has no anchors for it.
        XCTAssertNil(metrics.stemUpSE(for: .noteheadWhole))
        XCTAssertNil(metrics.stemDownNW(for: .noteheadWhole))
    }
}
