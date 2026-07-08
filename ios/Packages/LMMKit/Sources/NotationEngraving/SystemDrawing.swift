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
public func drawSystem(
    _ system: SystemFrame,
    in ctx: CGContext,
    contentHeight: CGFloat,
    notationColor: NotationColor = .lightDefault
) {
    ctx.saveGState()
    ctx.translateBy(x: 0, y: -system.frame.origin.y)
    let size = CGSize(width: system.frame.width, height: contentHeight)
    for measure in system.measures {
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
