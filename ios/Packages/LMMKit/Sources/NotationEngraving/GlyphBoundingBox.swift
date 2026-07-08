import Foundation

/// A glyph's bounding box, in staff spaces, relative to the glyph's origin (as SMuFL/Bravura
/// define it — for noteheads this origin sits at the notehead's vertical center, i.e. exactly
/// on the staff line/space it belongs on, so placing a notehead glyph needs no additional
/// vertical centering math).
public struct GlyphBoundingBox: Equatable {
    /// North-east (top-right) corner, x.
    public let neX: StaffSpaces
    /// North-east (top-right) corner, y.
    public let neY: StaffSpaces
    /// South-west (bottom-left) corner, x.
    public let swX: StaffSpaces
    /// South-west (bottom-left) corner, y.
    public let swY: StaffSpaces

    public init(neX: StaffSpaces, neY: StaffSpaces, swX: StaffSpaces, swY: StaffSpaces) {
        self.neX = neX
        self.neY = neY
        self.swX = swX
        self.swY = swY
    }

    public var width: StaffSpaces { neX - swX }
    public var height: StaffSpaces { neY - swY }
}

// swiftlint:disable identifier_name
/// A named anchor point on a glyph, in staff spaces relative to the glyph's origin — SMuFL's
/// `glyphsWithAnchors`. `GlyphMetrics.stemUpSE`/`stemDownNW` are the two this task needs
/// (where an up/down stem meets a notehead); more anchor names can be added as later tasks
/// need them (e.g. beaming, cut-outs for chord seconds). `x`/`y` mirror the SMuFL/Bravura
/// anchor coordinate names verbatim.
public struct StaffPoint: Equatable {
    public let x: StaffSpaces
    public let y: StaffSpaces

    public init(x: StaffSpaces, y: StaffSpaces) {
        self.x = x
        self.y = y
    }
}
// swiftlint:enable identifier_name
