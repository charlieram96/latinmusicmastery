import Foundation

/// Errors thrown while loading Bravura's SMuFL metadata.
public enum GlyphMetricsError: Error, Equatable {
    /// `bravura_metadata.json` wasn't found in the NotationEngraving resource bundle.
    case resourceNotFound
}

/// Loads Bravura's `bravura_metadata.json` once and exposes the per-glyph metrics this
/// engraving engine needs — bounding boxes and (for noteheads) stem anchors, both in staff
/// spaces — plus the subset of `engravingDefaults` used for line thicknesses.
///
/// `GlyphMetrics(data:)` is the pure core (any JSON `Data`, no `Bundle`) — `GlyphMetricsParsingTests`
/// exercises it directly against a small hand-written fixture. `GlyphMetrics.shared` /
/// `init()` load the real bundled Bravura metadata.
public final class GlyphMetrics {
    /// Loads the real, bundled Bravura metadata once per process. Traps if the package's own
    /// resource is missing or malformed — that's a packaging defect, not a runtime condition
    /// any caller can recover from.
    public static let shared: GlyphMetrics = {
        do {
            return try GlyphMetrics()
        } catch {
            fatalError("Failed to load bundled bravura_metadata.json: \(error)")
        }
    }()

    public let fontName: String
    /// e.g. `1.392` — see `BravuraMetadataDocument.fontVersion` for why this is a `Double`,
    /// not a `String`.
    public let fontVersion: Double
    public let engravingDefaults: EngravingDefaults

    private let document: BravuraMetadataDocument

    /// Parses `data` as a Bravura-shaped SMuFL metadata document. Pure — no file I/O, no
    /// `Bundle` lookup — so it's directly testable against any fixture.
    public init(data: Data) throws {
        document = try JSONDecoder().decode(BravuraMetadataDocument.self, from: data)
        fontName = document.fontName
        fontVersion = document.fontVersion
        engravingDefaults = document.engravingDefaults.engravingDefaults
    }

    /// Loads `bravura_metadata.json` from the NotationEngraving resource bundle.
    public convenience init() throws {
        guard let url = Bundle.module.url(forResource: "bravura_metadata", withExtension: "json") else {
            throw GlyphMetricsError.resourceNotFound
        }
        try self.init(data: Data(contentsOf: url))
    }

    /// The glyph's bounding box, in staff spaces. `nil` if the glyph has no entry in
    /// `glyphBBoxes` — every catalog glyph is asserted to have one in `GlyphMetricsTests`, so
    /// in practice this is a "should never happen for a catalog glyph" case, not routine.
    public func boundingBox(for glyph: Glyph) -> GlyphBoundingBox? {
        document.glyphBBoxes[glyph.smuflName]?.boundingBox
    }

    /// A named anchor point on a glyph (SMuFL's `glyphsWithAnchors`), in staff spaces relative
    /// to the glyph's origin. `nil` if the glyph has no anchors at all, or none by this name.
    public func anchor(_ name: String, for glyph: Glyph) -> StaffPoint? {
        guard let point = document.glyphsWithAnchors[glyph.smuflName]?[name], point.count == 2 else {
            return nil
        }
        return StaffPoint(x: point[0], y: point[1])
    }

    /// Where an upward stem meets this glyph (its north-east corner, in SMuFL terms) — `nil`
    /// for glyphs with no stem (rests, clefs, whole notes).
    public func stemUpSE(for glyph: Glyph) -> StaffPoint? {
        anchor("stemUpSE", for: glyph)
    }

    /// Where a downward stem meets this glyph (its north-west corner, in SMuFL terms) — `nil`
    /// for glyphs with no stem.
    public func stemDownNW(for glyph: Glyph) -> StaffPoint? {
        anchor("stemDownNW", for: glyph)
    }
}
