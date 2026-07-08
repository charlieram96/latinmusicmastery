import Foundation
import XCTest

@testable import NotationEngraving

/// Coverage for the C13 carry-forwards done in C14: `BravuraFont(data:)` malformed-input
/// handling, and `GlyphMetrics(data:)`'s now-scoped, per-entry-permissive glyph-map decode.
final class BravuraFontParsingTests: XCTestCase {
    // MARK: BravuraFont(data:) malformed data

    func testBravuraFontThrowsOnNonFontData() {
        XCTAssertThrowsError(try BravuraFont(data: Data("this is not a font".utf8))) { error in
            XCTAssertEqual(error as? BravuraFontError, .descriptorCreationFailed)
        }
    }

    func testBravuraFontThrowsOnEmptyData() {
        XCTAssertThrowsError(try BravuraFont(data: Data()))
    }

    // MARK: GlyphMetrics(data:) — catalog-scoped, per-entry-permissive decode

    /// A single malformed catalog-glyph entry (bad bbox shape) is skipped, not fatal: the
    /// document still decodes and its other, well-formed catalog entries survive.
    func testMalformedSingleGlyphEntryIsSkippedNotFatal() throws {
        let json = """
        {
          "fontName": "Bravura",
          "fontVersion": 1.392,
          "engravingDefaults": {
            "staffLineThickness": 0.13, "stemThickness": 0.12, "beamThickness": 0.5,
            "legerLineThickness": 0.16, "legerLineExtension": 0.4, "thinBarlineThickness": 0.16
          },
          "glyphBBoxes": {
            "noteheadBlack": { "bBoxNE": [1.18, 0.5], "bBoxSW": [0.0, -0.5] },
            "gClef": { "bBoxNE": [2.684], "bBoxSW": [0.0, -2.632] }
          },
          "glyphsWithAnchors": {
            "noteheadBlack": { "stemUpSE": [1.18, 0.168] }
          }
        }
        """
        let metrics = try GlyphMetrics(data: Data(json.utf8))
        // Well-formed catalog glyph survived.
        XCTAssertEqual(metrics.boundingBox(for: .noteheadBlack)?.neX, 1.18)
        // Malformed gClef entry (bBoxNE has 1 element) is skipped → nil, no throw.
        XCTAssertNil(metrics.boundingBox(for: .gClef))
        XCTAssertEqual(metrics.stemUpSE(for: .noteheadBlack)?.y, 0.168)
    }

    /// Entries for non-catalog glyphs are simply not materialized (scoping), and a catalog
    /// glyph absent from the file resolves to nil without failing the whole document.
    func testNonCatalogGlyphsAreScopedOutAndMissingCatalogGlyphIsNil() throws {
        let json = """
        {
          "fontName": "Bravura",
          "fontVersion": 1.392,
          "engravingDefaults": {
            "staffLineThickness": 0.13, "stemThickness": 0.12, "beamThickness": 0.5,
            "legerLineThickness": 0.16, "legerLineExtension": 0.4, "thinBarlineThickness": 0.16
          },
          "glyphBBoxes": {
            "noteheadBlack": { "bBoxNE": [1.18, 0.5], "bBoxSW": [0.0, -0.5] },
            "someGlyphWeDoNotDraw": { "bBoxNE": [9.9, 9.9], "bBoxSW": [0.0, 0.0] }
          },
          "glyphsWithAnchors": {}
        }
        """
        let metrics = try GlyphMetrics(data: Data(json.utf8))
        XCTAssertNotNil(metrics.boundingBox(for: .noteheadBlack))
        // A catalog glyph not present in the file is nil (not a decode failure).
        XCTAssertNil(metrics.boundingBox(for: .restQuarter))
    }
}
