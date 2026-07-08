import XCTest

@testable import NotationEngraving

/// Pure parsing coverage for `GlyphMetrics` — feeds a small hand-written JSON fixture
/// (mirroring the real `bravura_metadata.json` shape) directly to `GlyphMetrics(data:)`, with
/// no `Bundle` / font / CoreText involved. `GlyphMetricsTests` (a different file) covers the
/// real bundled Bravura metadata end-to-end.
final class GlyphMetricsParsingTests: XCTestCase {
    private let fixtureJSON = """
    {
      "fontName": "Bravura",
      "fontVersion": 1.392,
      "engravingDefaults": {
        "staffLineThickness": 0.13,
        "stemThickness": 0.12,
        "beamThickness": 0.5,
        "legerLineThickness": 0.16,
        "legerLineExtension": 0.4,
        "thinBarlineThickness": 0.16,
        "textFontFamily": ["Academico", "Edwin", "serif"]
      },
      "glyphBBoxes": {
        "noteheadBlack": { "bBoxNE": [1.18, 0.5], "bBoxSW": [0.0, -0.5] },
        "gClef": { "bBoxNE": [2.684, 4.392], "bBoxSW": [0.0, -2.632] }
      },
      "glyphsWithAnchors": {
        "noteheadBlack": {
          "stemUpSE": [1.18, 0.168],
          "stemDownNW": [0.0, -0.168]
        }
      },
      "glyphAdvanceWidths": {
        "noteheadBlack": 1.3
      }
    }
    """

    private func makeMetrics() throws -> GlyphMetrics {
        try GlyphMetrics(data: Data(fixtureJSON.utf8))
    }

    func testParsesFontVersion() throws {
        let metrics = try makeMetrics()
        XCTAssertEqual(metrics.fontVersion, 1.392)
    }

    func testParsesEngravingDefaults() throws {
        let metrics = try makeMetrics()
        XCTAssertEqual(metrics.engravingDefaults.staffLineThickness, 0.13)
        XCTAssertEqual(metrics.engravingDefaults.stemThickness, 0.12)
        XCTAssertEqual(metrics.engravingDefaults.beamThickness, 0.5)
        XCTAssertEqual(metrics.engravingDefaults.legerLineThickness, 0.16)
        XCTAssertEqual(metrics.engravingDefaults.legerLineExtension, 0.4)
        XCTAssertEqual(metrics.engravingDefaults.thinBarlineThickness, 0.16)
    }

    func testIgnoresNonNumericEngravingDefaultsFields() throws {
        // textFontFamily (a [String]) must not break decoding of the numeric fields above.
        XCTAssertNoThrow(try makeMetrics())
    }

    func testParsesBoundingBoxForKnownGlyph() throws {
        let metrics = try makeMetrics()
        let bbox = try XCTUnwrap(metrics.boundingBox(for: .noteheadBlack))
        XCTAssertEqual(bbox.neX, 1.18)
        XCTAssertEqual(bbox.neY, 0.5)
        XCTAssertEqual(bbox.swX, 0.0)
        XCTAssertEqual(bbox.swY, -0.5)
    }

    func testBoundingBoxWidthAndHeight() throws {
        let metrics = try makeMetrics()
        let bbox = try XCTUnwrap(metrics.boundingBox(for: .gClef))
        XCTAssertEqual(bbox.width, 2.684, accuracy: 1e-9)
        XCTAssertEqual(bbox.height, 4.392 - (-2.632), accuracy: 1e-9)
    }

    func testBoundingBoxIsNilForGlyphMissingFromMetadata() throws {
        let metrics = try makeMetrics()
        XCTAssertNil(metrics.boundingBox(for: .restQuarter))
    }

    func testParsesStemAnchorsForKnownGlyph() throws {
        let metrics = try makeMetrics()
        let stemUpSE = try XCTUnwrap(metrics.stemUpSE(for: .noteheadBlack))
        XCTAssertEqual(stemUpSE.x, 1.18)
        XCTAssertEqual(stemUpSE.y, 0.168)

        let stemDownNW = try XCTUnwrap(metrics.stemDownNW(for: .noteheadBlack))
        XCTAssertEqual(stemDownNW.x, 0.0)
        XCTAssertEqual(stemDownNW.y, -0.168)
    }

    func testStemAnchorsAreNilForGlyphWithNoAnchors() throws {
        let metrics = try makeMetrics()
        XCTAssertNil(metrics.stemUpSE(for: .gClef))
        XCTAssertNil(metrics.stemDownNW(for: .gClef))
    }

    func testThrowsOnMalformedJSON() {
        XCTAssertThrowsError(try GlyphMetrics(data: Data("not json".utf8)))
    }
}
