import CoreGraphics

/// A distance expressed in staff spaces (the SMuFL/engraving unit: the gap between two
/// adjacent staff lines is exactly `1`). Every metric `GlyphMetrics` reports — bounding
/// boxes, anchors, `EngravingDefaults` — is in this unit; `ScaleContext` converts to points
/// for a concretely-sized staff.
public typealias StaffSpaces = Double

/// Converts staff-space measurements to points for one concrete staff size.
///
/// SMuFL fonts (Bravura included) are authored at 4 staff-spaces per em — the spec's
/// "Combining the standard music font layout with a text font" section fixes this so any
/// SMuFL-compliant font can be swapped in at a given staff size with no per-font tuning.
/// That makes the CTFont point size for a given staff space a fixed multiple: `staffSpacePoints * 4`.
public struct ScaleContext: Equatable {
    /// Points per staff space — the one knob that sizes an entire staff.
    public let staffSpacePoints: CGFloat

    public init(staffSpacePoints: CGFloat) {
        self.staffSpacePoints = staffSpacePoints
    }

    /// Converts a measurement in staff spaces to points at this scale.
    public func points(_ spaces: StaffSpaces) -> CGFloat {
        CGFloat(spaces) * staffSpacePoints
    }

    /// The CTFont point size to request when drawing Bravura glyphs at this scale.
    public var fontPointSize: CGFloat {
        staffSpacePoints * 4
    }
}
