import CoreGraphics
import CoreText
import Foundation
import os

/// Shared CoreGraphics/CoreText drawing primitives for the notation debug renderers
/// (`drawStaffSample`, `drawMeasureFrame`). Internal — these are proof/debug helpers, not a
/// public rendering API (that lands with the real view layer in a later task).

/// Bundles what every drawing helper needs, so none of them takes more than a couple of
/// parameters on top of it.
struct RenderContext {
    let ctx: CGContext
    let canvasHeight: CGFloat
    let scale: ScaleContext
    let metrics = GlyphMetrics.shared
    let font = BravuraFont.shared
}

/// Log channel for engraving draw paths — currently only the "glyph didn't resolve in the
/// font" case, which should never fire for a catalog glyph (asserted in `GlyphCatalogTests`)
/// but is logged rather than silently swallowed so a font/packaging regression is diagnosable.
private let engravingLog = Logger(subsystem: "com.latinmusicmastery.notation", category: "engraving")

/// Draws one glyph with its origin at `origin` (canvas-space, y-down).
///
/// Core Text glyph painting (`CTFontDrawGlyphs`) always expects a Quartz-native (y-up,
/// origin-bottom-left) transform, regardless of how the incoming context is flipped, so this
/// temporarily cancels the caller's y-down flip — scoped to just this glyph draw via
/// save/restore — around the call.
func drawGlyph(_ glyph: Glyph, origin: CGPoint, render: RenderContext) {
    guard let glyphIndex = render.font.glyphIndex(for: glyph.codepoint) else {
        // Should be unreachable for a catalog glyph; log (don't crash, don't silently no-op)
        // so a font regression that drops a glyph is diagnosable from a debug build.
        let name = glyph.smuflName
        let codepoint = String(glyph.codepoint.value, radix: 16, uppercase: true)
        engravingLog.debug("Unresolved glyph \(name, privacy: .public) (U+\(codepoint, privacy: .public)) — skipped")
        return
    }
    let ctFont = render.font.ctFont(size: render.scale.fontPointSize)
    let canvasHeight = render.canvasHeight
    let ctx = render.ctx

    ctx.saveGState()
    ctx.textMatrix = .identity
    ctx.translateBy(x: 0, y: canvasHeight)
    ctx.scaleBy(x: 1, y: -1)

    var cgGlyph = glyphIndex
    var position = CGPoint(x: origin.x, y: canvasHeight - origin.y)
    withUnsafePointer(to: &cgGlyph) { glyphPointer in
        withUnsafePointer(to: &position) { positionPointer in
            CTFontDrawGlyphs(ctFont, glyphPointer, positionPointer, 1, ctx)
        }
    }

    ctx.restoreGState()
}

/// Strokes a single line segment (stem, ledger line, barline) with its own line width.
func strokeSegment(_ segment: LineSegment, render: RenderContext) {
    let ctx = render.ctx
    ctx.saveGState()
    ctx.setLineWidth(segment.thickness)
    ctx.move(to: segment.start)
    ctx.addLine(to: segment.end)
    ctx.strokePath()
    ctx.restoreGState()
}

/// Fills one beam bar as a parallelogram: the `start`/`end` center-line offset vertically by
/// half the thickness on each side. (Beams are filled shapes, not strokes.)
func fillBeam(_ segment: BeamSegment, render: RenderContext) {
    let ctx = render.ctx
    let half = segment.thickness / 2
    ctx.saveGState()
    ctx.beginPath()
    ctx.move(to: CGPoint(x: segment.start.x, y: segment.start.y - half))
    ctx.addLine(to: CGPoint(x: segment.end.x, y: segment.end.y - half))
    ctx.addLine(to: CGPoint(x: segment.end.x, y: segment.end.y + half))
    ctx.addLine(to: CGPoint(x: segment.start.x, y: segment.start.y + half))
    ctx.closePath()
    ctx.fillPath()
    ctx.restoreGState()
}

/// Strokes a tie/slur cubic as a round-capped curve at its midpoint thickness — a faithful arc
/// for the debug renderer (a production tie would be a tapered filled lens).
func strokeTie(_ tie: TieShape, render: RenderContext) {
    let ctx = render.ctx
    ctx.saveGState()
    ctx.setLineWidth(tie.thickness)
    ctx.setLineCap(.round)
    ctx.move(to: tie.start)
    ctx.addCurve(to: tie.end, control1: tie.control1, control2: tie.control2)
    ctx.strokePath()
    ctx.restoreGState()
}

/// Draws the 5 staff lines of `geometry`.
func drawStaffLines(geometry: StaffGeometry, render: RenderContext) {
    let ctx = render.ctx
    ctx.saveGState()
    ctx.setLineWidth(render.scale.points(render.metrics.engravingDefaults.staffLineThickness))
    for lineY in geometry.lineYPositions {
        ctx.move(to: CGPoint(x: geometry.originX, y: lineY))
        ctx.addLine(to: CGPoint(x: geometry.originX + geometry.width, y: lineY))
    }
    ctx.strokePath()
    ctx.restoreGState()
}
