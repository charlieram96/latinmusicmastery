import CoreGraphics
import CoreText
import Foundation

/// Draws a laid-out `MeasureFrame` into a y-down, top-left-origin context (the convention
/// `UIGraphicsImageRenderer` / SwiftUI `Canvas` give you — same contract as `drawStaffSample`).
///
/// This is the C14 proof that `EventDescriptorBuilder` + `MeasureLayoutEngine` +
/// `GlyphMetrics`/`BravuraFont` compose end to end into a real, engraved measure — deliberately
/// a debug renderer, not the product view layer.
public func drawMeasureFrame(
    _ frame: MeasureFrame,
    in ctx: CGContext,
    size: CGSize,
    notationColor: NotationColor = .lightDefault
) {
    let scale = ScaleContext(staffSpacePoints: frame.staffSpace)
    let render = RenderContext(ctx: ctx, canvasHeight: size.height, scale: scale)

    ctx.saveGState()
    ctx.setStrokeColor(notationColor.cgColor)
    ctx.setFillColor(notationColor.cgColor)

    // Staff lines first, then ledger lines, then glyphs + stems + barline on top.
    drawStaffLines(geometry: frame.staffGeometry, render: render)
    for ledger in frame.ledgerLines { strokeSegment(ledger, render: render) }

    if let clef = frame.clef { drawGlyph(clef.glyph, origin: clef.origin, render: render) }
    for glyph in frame.timeSignature { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }
    for glyph in frame.noteheads { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }
    for glyph in frame.accidentals { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }
    for glyph in frame.augmentationDots { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }
    for glyph in frame.flags { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }
    for glyph in frame.rests { drawGlyph(glyph.glyph, origin: glyph.origin, render: render) }

    for stem in frame.stems { strokeSegment(stem, render: render) }
    strokeSegment(frame.barline, render: render)

    ctx.restoreGState()
}

/// Lays out and draws a single measure's `events` — the convenience `drawStaffSample`'s C14
/// successor uses for previews. Places the staff with a small top margin so ledger lines /
/// stems above the staff have room.
public func drawMeasureSample(
    events: [EventDescriptor],
    context: MeasureContext,
    in ctx: CGContext,
    size: CGSize,
    scale: ScaleContext,
    notationColor: NotationColor = .lightDefault
) {
    // Leave ~4 staff spaces of headroom above the top line for ledger notes + stems.
    let topLineY = scale.points(4.0)
    let originX = scale.points(1.0)
    let frame = MeasureLayoutEngine.layout(
        events: events,
        context: context,
        origin: CGPoint(x: originX, y: topLineY),
        scale: scale
    )
    drawMeasureFrame(frame, in: ctx, size: size, notationColor: notationColor)
}
