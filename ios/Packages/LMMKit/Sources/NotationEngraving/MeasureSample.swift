import CoreGraphics
import CoreText
import Foundation
import ScoreModel

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
    drawRhythmElements(frame, render: render)
    strokeSegment(frame.barline, render: render)

    ctx.restoreGState()
}

/// Draws the C15 rhythm layer (beams, ties, tuplet brackets + digits) of a laid-out measure.
private func drawRhythmElements(_ frame: MeasureFrame, render: RenderContext) {
    for beam in frame.beams { fillBeam(beam, render: render) }
    for tie in frame.ties { strokeTie(tie, render: render) }
    for tuplet in frame.tuplets {
        for stroke in tuplet.bracket { strokeSegment(stroke, render: render) }
        drawGlyph(tuplet.digit.glyph, origin: tuplet.digit.origin, render: render)
    }
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

/// A single rhythm-rich 4/4 measure that exercises the C15 layer end to end — mixed
/// eighth/sixteenth beam groups (with left- and right-pointing partial secondary stubs), an
/// eighth-note triplet (beam + `3` digit), a tie between two beamed eighths, and a full
/// four-sixteenth secondary beam (stem-down). Used by the debug preview and the C15 snapshots.
public func rhythmRichSampleEvents() -> [EventDescriptor] {
    /// One authored note of the rhythm sample.
    struct Spec {
        let durationQN: Double
        let code: DurationCode
        let pos: Int
        var triplet = false
        var tie = false
    }
    let third = 1.0 / 3.0
    let specs: [Spec] = [
        // Beat 1 — 16th / eighth / 16th: the two sixteenths get partial secondary stubs.
        Spec(durationQN: 0.25, code: .sixteenth, pos: 0),
        Spec(durationQN: 0.5, code: .eighth, pos: 1),
        Spec(durationQN: 0.25, code: .sixteenth, pos: 2),
        // Beat 2 — eighth-note triplet (digit over the beam).
        Spec(durationQN: third, code: .eighth, pos: 2, triplet: true),
        Spec(durationQN: third, code: .eighth, pos: 3, triplet: true),
        Spec(durationQN: third, code: .eighth, pos: 4, triplet: true),
        // Beat 3 — two beamed eighths on the same pitch, tied.
        Spec(durationQN: 0.5, code: .eighth, pos: 3, tie: true),
        Spec(durationQN: 0.5, code: .eighth, pos: 3),
        // Beat 4 — four sixteenths, high (stem-down), full secondary beam.
        Spec(durationQN: 0.25, code: .sixteenth, pos: 4),
        Spec(durationQN: 0.25, code: .sixteenth, pos: 5),
        Spec(durationQN: 0.25, code: .sixteenth, pos: 6),
        Spec(durationQN: 0.25, code: .sixteenth, pos: 7)
    ]
    var qnStart = 0.0
    return specs.map { spec in
        let head = NoteDescriptor(
            staffPosition: spec.pos, accidental: nil, midi: 64, isCross: false, keyString: "e/4"
        )
        let event = EventDescriptor(
            kind: .note, qnStart: qnStart, durationQN: spec.durationQN, beatInMeasure: qnStart + 1,
            durationCode: spec.code, isRest: false, dotted: false, notes: [head], midi: 64,
            triplet: spec.triplet, tieToNext: spec.tie, articulation: nil
        )
        qnStart += spec.durationQN
        return event
    }
}
