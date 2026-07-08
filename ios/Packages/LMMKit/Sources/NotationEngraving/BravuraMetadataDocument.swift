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
    let glyphBBoxes: [String: GlyphBBoxDocument]
    let glyphsWithAnchors: [String: [String: [Double]]]
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
