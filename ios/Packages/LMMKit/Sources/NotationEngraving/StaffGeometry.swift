import CoreGraphics

/// Pure geometry for a 5-line staff — no font, no metadata, no rendering. Everything is in
/// points (already scaled — see `ScaleContext` for staff-space → point conversion) and uses
/// a top-left-origin, y-increases-downward coordinate convention (matching `UIGraphicsImageRenderer`
/// / SwiftUI `Canvas` — the same convention `drawStaffSample(in:size:scale:notationColor:)`
/// expects of its caller).
///
/// Staff position convention: `0` is the bottom line, each `+1` moves up by one
/// half-staff-space, so the 5 lines fall on the even positions `0, 2, 4, 6, 8` (bottom to
/// top) and the 4 spaces fall on the odd positions `1, 3, 5, 7`. Positions `< 0` or `> 8` are
/// off-staff and may require ledger lines — this is the same convention used throughout
/// engraving literature and by every mainstream notation engine (VexFlow, Verovio, etc.),
/// and is independent of clef or pitch: mapping a MIDI pitch to a position for a given clef
/// is layout-level work that lands in a later task (C14), not here.
public struct StaffGeometry: Equatable {
    /// x-coordinate of the staff's left edge, in points.
    public let originX: CGFloat
    /// y-coordinate of the top staff line (line 5, position 8), in points.
    public let topLineY: CGFloat
    /// Width of the staff, in points.
    public let width: CGFloat
    /// Size of one staff space, in points.
    public let staffSpace: CGFloat

    public init(originX: CGFloat, topLineY: CGFloat, width: CGFloat, staffSpace: CGFloat) {
        self.originX = originX
        self.topLineY = topLineY
        self.width = width
        self.staffSpace = staffSpace
    }

    /// y-coordinates of the 5 staff lines, top to bottom.
    public var lineYPositions: [CGFloat] {
        (0..<5).map { topLineY + CGFloat($0) * staffSpace }
    }

    /// y-coordinate (points) for a given staff position — see the position convention
    /// documented on the type itself. Extrapolates linearly for off-staff positions.
    public func y(forPosition position: Int) -> CGFloat {
        let halfSpace = staffSpace / 2
        let bottomLineY = topLineY + 4 * staffSpace
        return bottomLineY - CGFloat(position) * halfSpace
    }

    /// Staff positions (not points — see `ledgerLineYPositions`) of the ledger lines a note
    /// at `position` needs, empty for any in-staff position. A note sitting in a space beyond
    /// the staff needs every ledger line between the staff and (but not including) its own
    /// position; a note sitting on a ledger line needs that line too.
    public func ledgerLinePositions(forPosition position: Int) -> [Int] {
        if position < 0 {
            var positions: [Int] = []
            var candidate = -2
            while candidate >= position {
                positions.append(candidate)
                candidate -= 2
            }
            return positions
        } else if position > 8 {
            var positions: [Int] = []
            var candidate = 10
            while candidate <= position {
                positions.append(candidate)
                candidate += 2
            }
            return positions
        }
        return []
    }

    /// `ledgerLinePositions(forPosition:)` converted to y-coordinates (points).
    public func ledgerLineYPositions(forPosition position: Int) -> [CGFloat] {
        ledgerLinePositions(forPosition: position).map { y(forPosition: $0) }
    }
}
