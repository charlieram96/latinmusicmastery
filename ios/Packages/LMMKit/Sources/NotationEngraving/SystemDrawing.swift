import CoreGraphics
import Foundation

/// Draws one ``SystemFrame`` (a row of measures, positioned in GLOBAL canvas coordinates) into
/// a y-down, top-left-origin context — the convention `UIGraphicsImageRenderer` gives you and
/// that ``drawMeasureFrame(_:in:size:notationColor:)`` requires.
///
/// The system's measures carry global coordinates spanning `[0, contentHeight]`; to render just
/// this system's band into a smaller (band-sized) context, the context is translated up by the
/// band's top so the band lands at local y = 0, while `contentHeight` is passed unchanged as the
/// glyph-flip reference (both the directly-stroked staff/stem paths and the internally-flipped
/// glyph draws then shift by the same amount, staying registered). Ink only — no background
/// fill, so a renderer can composite systems over any backing color.
///
/// `column` (default: the whole system band) is the GLOBAL-coordinate rectangle this render
/// covers — a horizontal sub-strip of the system. It lets a wide scroll strip be rendered as
/// several fixed-width column tiles (each its own bounded bitmap) instead of one texture-limit-
/// busting image: the context is translated by the column's origin (so the column lands at local
/// 0,0) and only the measures overlapping the column's x-range are drawn (the rest are clipped by
/// the context bounds anyway — the filter is a perf skip, and a measure straddling a column edge
/// is drawn, partially clipped, in both neighbours so the seam is invisible).
public func drawSystem(
    _ system: SystemFrame,
    in ctx: CGContext,
    contentHeight: CGFloat,
    column: CGRect? = nil,
    notationColor: NotationColor = .lightDefault
) {
    let col = column ?? system.frame
    ctx.saveGState()
    ctx.translateBy(x: -col.origin.x, y: -col.origin.y)
    let size = CGSize(width: system.frame.width, height: contentHeight)
    let minX = col.minX
    let maxX = col.maxX
    for measure in system.measures where measure.originX + measure.width >= minX && measure.originX <= maxX {
        drawMeasureFrame(measure, in: ctx, size: size, notationColor: notationColor)
    }
    ctx.restoreGState()
}

/// Draws a whole ``ScoreLayout`` into one full-canvas context (`size == layout.totalSize`) —
/// the single-surface path used by the layout snapshot tests. The windowed, per-system CALayer
/// path in `NotationUI` uses ``drawSystem(_:in:contentHeight:notationColor:)`` band-by-band.
public func drawScoreLayout(
    _ layout: ScoreLayout,
    in ctx: CGContext,
    size: CGSize,
    notationColor: NotationColor = .lightDefault
) {
    for system in layout.systems {
        ctx.saveGState()
        for measure in system.measures {
            drawMeasureFrame(measure, in: ctx, size: size, notationColor: notationColor)
        }
        ctx.restoreGState()
    }
}
