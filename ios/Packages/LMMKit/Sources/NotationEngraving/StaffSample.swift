import CoreGraphics
import CoreText

/// Horizontal layout constants for `drawStaffSample`, as multiples of the staff space. Pure
/// hardcoded placement for the proof — not a spacing algorithm (that's task C14).
public enum StaffSampleLayout {
    public static let leftMarginSpaces: StaffSpaces = 1.5
    public static let clefToTimeSigSpaces: StaffSpaces = 3.0
    public static let timeSigToFirstNoteSpaces: StaffSpaces = 3.0
    public static let noteSpacingSpaces: StaffSpaces = 3.5
}

/// Draws a small, statically-engraved staff sample: a 5-line staff, treble clef, a 4/4 time
/// signature, four hardcoded noteheads (whole, half, quarter-black, x-notehead) on specific
/// staff positions, and one note on a ledger line above the staff.
///
/// This is a *proof* that font loading + `GlyphMetrics` + `StaffGeometry` compose correctly
/// end to end (the goal of task C13) — it is deliberately NOT a layout engine: horizontal
/// spacing is fixed (`StaffSampleLayout`), there's no beaming/stems, and the staff positions
/// below are hardcoded demo values, not derived from any pitch/clef mapping (that mapping is
/// layout-level work for a later task).
///
/// - Parameter ctx: Must already be in top-left-origin, y-increases-downward convention — the
///   same convention `UIGraphicsImageRenderer` and SwiftUI `Canvas` give you. (A raw,
///   non-flipped `CGContext`, e.g. one created directly via `CGContext(data:...)`, will render
///   upside down — that contract is the caller's responsibility, same as `UIView.draw(_:)`.)
public func drawStaffSample(
    in ctx: CGContext,
    size: CGSize,
    scale: ScaleContext,
    notationColor: NotationColor = .lightDefault
) {
    let render = RenderContext(ctx: ctx, canvasHeight: size.height, scale: scale)

    let staffSpace = scale.staffSpacePoints
    let topLineY = staffSpace * 3.5
    let originX = scale.points(StaffSampleLayout.leftMarginSpaces)
    let width = size.width - originX - scale.points(1)
    let geometry = StaffGeometry(originX: originX, topLineY: topLineY, width: width, staffSpace: staffSpace)

    ctx.saveGState()
    ctx.setStrokeColor(notationColor.cgColor)
    ctx.setFillColor(notationColor.cgColor)

    drawStaffLines(geometry: geometry, render: render)

    var cursorX = geometry.originX

    // Clef — origin at the bottom line (SMuFL/engraving convention for a G clef on a
    // standard 5-line staff).
    let clefOrigin = CGPoint(x: cursorX, y: geometry.y(forPosition: 0))
    drawGlyph(.gClef, origin: clefOrigin, render: render)
    cursorX += scale.points(StaffSampleLayout.clefToTimeSigSpaces)

    // Time signature "4/4" — numerator centered on the staff's upper half (line 4, position
    // 6), denominator on the lower half (line 2, position 2) — the standard engraving
    // placement for a full (numerator + denominator) time signature.
    let numeratorOrigin = CGPoint(x: cursorX, y: geometry.y(forPosition: 6))
    let denominatorOrigin = CGPoint(x: cursorX, y: geometry.y(forPosition: 2))
    drawGlyph(.timeSig4, origin: numeratorOrigin, render: render)
    drawGlyph(.timeSig4, origin: denominatorOrigin, render: render)
    cursorX += scale.points(StaffSampleLayout.timeSigToFirstNoteSpaces)

    // Noteheads — SMuFL noteheads are bbox-symmetric around their origin, so the origin sits
    // directly on the target staff position with no extra vertical-centering math.
    let notes: [(glyph: Glyph, position: Int)] = [
        (.noteheadWhole, 2),  // line 2 (G4)
        (.noteheadHalf, 5),   // space 3 (C5)
        (.noteheadBlack, 8),  // top line (F5)
        (.noteheadXBlack, 4)  // middle line (B4) — the percussion slap/mute convention
    ]
    for note in notes {
        let origin = CGPoint(x: cursorX, y: geometry.y(forPosition: note.position))
        drawGlyph(note.glyph, origin: origin, render: render)
        cursorX += scale.points(StaffSampleLayout.noteSpacingSpaces)
    }

    // One ledger-line note, 2 ledger lines above the staff.
    let ledgerNotePosition = 12
    drawLedgerLines(centerX: cursorX, forPosition: ledgerNotePosition, geometry: geometry, render: render)
    let ledgerNoteOrigin = CGPoint(x: cursorX, y: geometry.y(forPosition: ledgerNotePosition))
    drawGlyph(.noteheadBlack, origin: ledgerNoteOrigin, render: render)

    ctx.restoreGState()
}

private func drawLedgerLines(
    centerX: CGFloat,
    forPosition position: Int,
    geometry: StaffGeometry,
    render: RenderContext
) {
    let scale = render.scale
    let defaults = render.metrics.engravingDefaults
    // `?? …fallback`: only reached if the bundled metadata is missing `noteheadBlack`'s bbox,
    // which `GlyphMetricsTests` proves never happens for a catalog glyph — it exists purely to
    // keep this function total. The magic number is the shared, named
    // `MeasureLayoutMetrics.noteheadWidthFallback` (Bravura's noteheadBlack advance, 1.18
    // staff spaces), not a bare literal.
    let noteheadWidth: StaffSpaces = render.metrics.boundingBox(for: .noteheadBlack)?.width
        ?? MeasureLayoutMetrics.noteheadWidthFallback
    let halfLength = scale.points(noteheadWidth) / 2 + scale.points(defaults.legerLineExtension)

    let ctx = render.ctx
    ctx.setLineWidth(scale.points(defaults.legerLineThickness))
    for ledgerY in geometry.ledgerLineYPositions(forPosition: position) {
        ctx.move(to: CGPoint(x: centerX - halfLength, y: ledgerY))
        ctx.addLine(to: CGPoint(x: centerX + halfLength, y: ledgerY))
    }
    ctx.strokePath()
}
