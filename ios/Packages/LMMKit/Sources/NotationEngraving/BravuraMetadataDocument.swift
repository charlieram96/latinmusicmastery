import Foundation

/// A direct mirror of the top-level shape of Bravura's `bravura_metadata.json` (the SMuFL
/// metadata file from github.com/steinbergmedia/bravura) — only the fields `GlyphMetrics`
/// currently reads. `JSONDecoder` ignores JSON keys with no matching property, so the file's
/// other top-level fields (`glyphAdvanceWidths`, `glyphsWithAlternates`, `ligatures`,
/// `optionalGlyphs`, `sets`) are simply skipped rather than declared here.
struct BravuraMetadataDocument: Decodable {
    let fontName: String
    /// The real file stores this as a bare JSON number (`"fontVersion":1.392`), not a
    /// string — despite the misleading "Version" name, so it's decoded as `Double`.
    let fontVersion: Double
    let engravingDefaults: EngravingDefaultsDocument
    /// Only the entries for `Glyph` catalog glyphs — see the custom `init(from:)`.
    let glyphBBoxes: [String: GlyphBBoxDocument]
    /// Only the entries for `Glyph` catalog glyphs — see the custom `init(from:)`.
    let glyphsWithAnchors: [String: [String: [Double]]]

    private enum CodingKeys: String, CodingKey {
        case fontName
        case fontVersion
        case engravingDefaults
        case glyphBBoxes
        case glyphsWithAnchors
    }

    /// Dynamic key for the per-glyph maps, so individual entries can be pulled by SMuFL name.
    private struct GlyphNameKey: CodingKey {
        let stringValue: String
        init(stringValue: String) { self.stringValue = stringValue }
        var intValue: Int? { nil }
        init?(intValue: Int) { nil }
    }

    /// Decodes the whole document, but scopes the two large per-glyph maps
    /// (`glyphBBoxes` ~3k entries, `glyphsWithAnchors` ~1k) to just the ~40 glyphs the `Glyph`
    /// catalog draws — and decodes each of those entries *permissively*: a single malformed
    /// entry is skipped rather than failing the whole document. This keeps NotationEngraving
    /// robust to unrelated churn or corruption elsewhere in `bravura_metadata.json` and avoids
    /// materializing thousands of dictionary entries it never reads.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        fontName = try container.decode(String.self, forKey: .fontName)
        fontVersion = try container.decode(Double.self, forKey: .fontVersion)
        engravingDefaults = try container.decode(EngravingDefaultsDocument.self, forKey: .engravingDefaults)

        let catalogNames = Glyph.allCases.map(\.smuflName)

        var boxes: [String: GlyphBBoxDocument] = [:]
        if let bboxes = try? container.nestedContainer(keyedBy: GlyphNameKey.self, forKey: .glyphBBoxes) {
            for name in catalogNames {
                let key = GlyphNameKey(stringValue: name)
                if let box = try? bboxes.decode(GlyphBBoxDocument.self, forKey: key) {
                    boxes[name] = box
                }
            }
        }
        glyphBBoxes = boxes

        var anchors: [String: [String: [Double]]] = [:]
        if let anchorMap = try? container.nestedContainer(keyedBy: GlyphNameKey.self, forKey: .glyphsWithAnchors) {
            for name in catalogNames {
                let key = GlyphNameKey(stringValue: name)
                if let entry = try? anchorMap.decode([String: [Double]].self, forKey: key) {
                    anchors[name] = entry
                }
            }
        }
        glyphsWithAnchors = anchors
    }
}

/// Mirrors `engravingDefaults`. Only the numeric fields `EngravingDefaults` exposes are
/// declared — `textFontFamily` (a `[String]`, the one non-numeric field in the real file) is
/// intentionally omitted rather than declared and ignored, so it can never trip up decoding.
struct EngravingDefaultsDocument: Decodable {
    let staffLineThickness: Double
    let stemThickness: Double
    let beamThickness: Double
    let legerLineThickness: Double
    let legerLineExtension: Double
    let thinBarlineThickness: Double

    var engravingDefaults: EngravingDefaults {
        EngravingDefaults(
            staffLineThickness: staffLineThickness,
            stemThickness: stemThickness,
            beamThickness: beamThickness,
            legerLineThickness: legerLineThickness,
            legerLineExtension: legerLineExtension,
            thinBarlineThickness: thinBarlineThickness
        )
    }
}

/// Mirrors one entry of `glyphBBoxes`: `{"bBoxNE": [x, y], "bBoxSW": [x, y]}`.
struct GlyphBBoxDocument: Decodable {
    let bBoxNE: [Double]
    let bBoxSW: [Double]

    /// `nil` if either array isn't the expected 2-element `[x, y]` pair — defensive against a
    /// malformed upstream file rather than a case we expect to hit in practice.
    var boundingBox: GlyphBoundingBox? {
        guard bBoxNE.count == 2, bBoxSW.count == 2 else { return nil }
        return GlyphBoundingBox(neX: bBoxNE[0], neY: bBoxNE[1], swX: bBoxSW[0], swY: bBoxSW[1])
    }
}
