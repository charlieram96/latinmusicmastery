import XCTest

@testable import NotationEngraving

/// Catalog-completeness coverage: every `Glyph` case resolves to an actual glyph in the
/// bundled Bravura font, codepoints don't collide, and the SMuFL names are the raw values
/// `GlyphMetrics` keys metadata lookups with.
final class GlyphCatalogTests: XCTestCase {
    private lazy var font = BravuraFont.shared

    func testCatalogCoversExpectedGlyphCount() {
        // 2 clefs + 10 time-sig digits + 5 noteheads + 10 flags + 8 rests + 3 accidentals
        // + 1 augmentation dot + 1 tuplet digit = 40 — see the brief's glyph inventory.
        XCTAssertEqual(Glyph.allCases.count, 40)
    }

    func testCodepointsAreUnique() {
        let codepoints = Glyph.allCases.map(\.codepoint.value)
        XCTAssertEqual(Set(codepoints).count, codepoints.count, "two catalog glyphs share a codepoint")
    }

    func testSmuflNameMatchesRawValue() {
        for glyph in Glyph.allCases {
            XCTAssertEqual(glyph.smuflName, glyph.rawValue)
        }
    }

    /// The core font-loading proof: every catalog codepoint must resolve to a real glyph
    /// (`CTFontGetGlyphsForCharacters` succeeds and returns a non-`.notdef` index) in the
    /// bundled Bravura.otf.
    func testEveryCatalogGlyphResolvesInBundledFont() {
        for glyph in Glyph.allCases {
            let index = font.glyphIndex(for: glyph.codepoint)
            let codepoint = String(glyph.codepoint.value, radix: 16, uppercase: true)
            XCTAssertNotNil(index, "\(glyph.smuflName) (U+\(codepoint)) has no glyph in Bravura.otf")
        }
    }

    func testDistinctGlyphsResolveToDistinctFontGlyphIndices() {
        let indices = Glyph.allCases.compactMap { font.glyphIndex(for: $0.codepoint) }
        XCTAssertEqual(Set(indices).count, indices.count, "two catalog glyphs resolved to the same font glyph index")
    }
}
