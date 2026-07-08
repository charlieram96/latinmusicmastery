import CoreGraphics
import Foundation

/// A tie/slur curve as a single cubic Bézier, with the SMuFL midpoint thickness. Endpoints and
/// controls are canvas points (y-down). Drawn as a thin filled/stroked arc between two
/// noteheads of the same pitch.
public struct TieShape: Equatable, Sendable {
    public let start: CGPoint
    public let control1: CGPoint
    public let control2: CGPoint
    public let end: CGPoint
    public let thickness: CGFloat

    public init(start: CGPoint, control1: CGPoint, control2: CGPoint, end: CGPoint, thickness: CGFloat) {
        self.start = start
        self.control1 = control1
        self.control2 = control2
        self.end = end
        self.thickness = thickness
    }
}

/// Pure tie geometry — a cubic arc between two same-pitch noteheads. The arc bulges on the side
/// **opposite** the stem (below the notes for a stem-up note, above for stem-down), the standard
/// engraving convention, so the tie never collides with the stem/beam. The web renderer computes
/// `tieToNext` but never draws it (see `score-to-vexflow.ts`); drawing it is a deliberate iOS
/// improvement the plan chose.
public enum TieGeometry {
    /// Arc bulge height at the tie's midpoint, in staff spaces.
    public static let arcHeightSpaces: StaffSpaces = 0.9
    /// Horizontal inset of each endpoint from the notehead edge, in staff spaces.
    public static let endpointInsetSpaces: StaffSpaces = 0.2
    /// Vertical offset of the endpoints from the notehead center toward the tie side, in spaces.
    public static let endpointOffsetSpaces: StaffSpaces = 0.4

    /// The two notehead centers a tie joins (same staff position), the notehead advance in
    /// points, and the group's stem direction.
    public struct Endpoints: Equatable, Sendable {
        public let fromCenter: CGPoint
        public let toCenter: CGPoint
        public let noteheadWidth: CGFloat
        public let stemUp: Bool

        public init(fromCenter: CGPoint, toCenter: CGPoint, noteheadWidth: CGFloat, stemUp: Bool) {
            self.fromCenter = fromCenter
            self.toCenter = toCenter
            self.noteheadWidth = noteheadWidth
            self.stemUp = stemUp
        }
    }

    /// A tie between two same-pitch noteheads. The arc starts just past the right edge of the
    /// first head and ends just before the left edge of the second; `stemUp` selects the side
    /// (below the notes when stems point up).
    public static func tie(
        endpoints: Endpoints,
        scale: ScaleContext,
        defaults: EngravingDefaults
    ) -> TieShape {
        let inset = scale.points(endpointInsetSpaces)
        let arc = scale.points(arcHeightSpaces)
        // Stem up → tie below the notes (bulge toward +y); stem down → above (−y).
        let side: CGFloat = endpoints.stemUp ? 1 : -1
        let offset = side * scale.points(endpointOffsetSpaces)

        let start = CGPoint(
            x: endpoints.fromCenter.x + endpoints.noteheadWidth + inset, y: endpoints.fromCenter.y + offset
        )
        let end = CGPoint(x: endpoints.toCenter.x - inset, y: endpoints.toCenter.y + offset)
        let deltaX = end.x - start.x
        let bulge = side * arc
        let control1 = CGPoint(x: start.x + deltaX / 3, y: start.y + bulge)
        let control2 = CGPoint(x: start.x + 2 * deltaX / 3, y: end.y + bulge)
        return TieShape(
            start: start, control1: control1, control2: control2, end: end,
            thickness: scale.points(defaults.tieMidpointThickness)
        )
    }
}
