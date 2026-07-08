import CoreGraphics
import Foundation
import ScoreModel

/// A glyph placed at a canvas-space origin (y-down, top-left convention — the same one
/// `StaffGeometry` and `drawStaffSample` use). The origin is the glyph's SMuFL origin, so a
/// notehead's origin sits exactly on its staff line/space.
public struct PositionedGlyph: Equatable, Sendable {
    public let glyph: Glyph
    public let origin: CGPoint

    public init(glyph: Glyph, origin: CGPoint) {
        self.glyph = glyph
        self.origin = origin
    }
}

/// A straight stroke (stem, ledger line, barline) in canvas points.
public struct LineSegment: Equatable, Sendable {
    public let start: CGPoint
    public let end: CGPoint
    public let thickness: CGFloat

    public init(start: CGPoint, end: CGPoint, thickness: CGFloat) {
        self.start = start
        self.end = end
        self.thickness = thickness
    }
}

/// Per-event anchor for cursor placement / hit-testing: the event's cumulative QN plus the
/// canvas-space rectangle of its notehead column (or rest glyph).
public struct NoteAnchor: Equatable, Sendable {
    public let qnStart: Double
    public let frame: CGRect

    public init(qnStart: Double, frame: CGRect) {
        self.qnStart = qnStart
        self.frame = frame
    }
}

/// Everything needed to draw one measure. Pure geometry (CoreGraphics value types only) — no
/// font, no context, no beaming/ties (C15) and no system breaks (C16). Flags are emitted as
/// standalone elements so C15 can drop the ones it beams without touching stems.
public struct MeasureFrame: Equatable, Sendable {
    /// Total measure width in points (from the ported spacing model), measured from `originX`.
    public let width: CGFloat
    /// The staff geometry the elements were placed against (origin, top line, staff space).
    public let originX: CGFloat
    public let topLineY: CGFloat
    public let staffSpace: CGFloat

    public let clef: PositionedGlyph?
    public let timeSignature: [PositionedGlyph]
    public let noteheads: [PositionedGlyph]
    public let rests: [PositionedGlyph]
    public let accidentals: [PositionedGlyph]
    public let augmentationDots: [PositionedGlyph]
    public let flags: [PositionedGlyph]
    public let stems: [LineSegment]
    public let ledgerLines: [LineSegment]
    public let barline: LineSegment
    public let noteAnchors: [NoteAnchor]

    /// The `StaffGeometry` these elements were laid out against (rebuilt from the stored
    /// origin/space + width) — convenience for a renderer that wants to draw the 5 lines.
    public var staffGeometry: StaffGeometry {
        StaffGeometry(originX: originX, topLineY: topLineY, width: width, staffSpace: staffSpace)
    }
}

/// Context a measure needs beyond its events: which clef, the time signature, and whether to
/// draw the clef / time-sig lead-in (the web renderer draws both only on the first measure of
/// a system — `showHeader = i === 0`).
public struct MeasureContext: Equatable, Sendable {
    public let clef: Clef
    public let timeSignature: TimeSignature
    public let showClef: Bool
    public let showTimeSignature: Bool

    public init(clef: Clef, timeSignature: TimeSignature, showClef: Bool, showTimeSignature: Bool) {
        self.clef = clef
        self.timeSignature = timeSignature
        self.showClef = showClef
        self.showTimeSignature = showTimeSignature
    }

    /// True when a clef or time signature is drawn — drives the wider lead-in.
    var showsHeader: Bool { showClef || showTimeSignature }
}

/// The horizontal-spacing constants, ported from `staff-renderer.tsx` and expressed in staff
/// spaces so the whole model is scale-independent.
///
/// Provenance: the web renderer works in "model units" where the 5-line staff spans
/// `STAFF_LINE_SPAN = 40` across 4 spaces, i.e. **10 px per staff space**. Every px constant in
/// `staff-renderer.tsx` is therefore divided by 10 to land here:
///   - `QN_WIDTH = 90`             → `9.0` spaces per quarter note
///   - `PER_NOTE_MIN_WIDTH = 22`   → `2.2` spaces per note (dense-bar floor)
///   - `FIRST_MEASURE_EXTRA_WIDTH = 80` → `8.0` spaces of clef+time-sig lead-in
///   - the formatter's `- 20` right inset → `2.0` spaces of trailing pad before the barline
public enum MeasureLayoutMetrics {
    public static let quarterNoteWidthSpaces: StaffSpaces = 9.0
    public static let perNoteMinWidthSpaces: StaffSpaces = 2.2
    public static let headerLeadInSpaces: StaffSpaces = 8.0
    public static let bareLeadInSpaces: StaffSpaces = 1.0
    public static let trailingPadSpaces: StaffSpaces = 2.0
    /// Floor on the note area, mirroring the web `Math.max(40, justify)` (40 px = 4 spaces).
    public static let minNoteAreaSpaces: StaffSpaces = 4.0

    /// Default stem length (SMuFL / engraving convention).
    public static let stemLengthSpaces: StaffSpaces = 3.5
    /// Gap between a notehead's right edge and its augmentation dot.
    public static let dotGapSpaces: StaffSpaces = 0.3
    /// Gap between an accidental's right edge and the notehead it modifies.
    public static let accidentalGapSpaces: StaffSpaces = 0.28

    /// Notehead advance width used for ledger extents / dot placement when metadata is
    /// unavailable — Bravura's `noteheadBlack` bbox width. Kept as a named fallback (rather
    /// than a bare literal) and documented here + in `StaffSample`: it is only ever hit if the
    /// bundled metadata is missing the glyph, which `GlyphMetricsTests` proves never happens.
    public static let noteheadWidthFallback: StaffSpaces = 1.18

    /// Staff position of the middle line (treble B4) — the stem-direction pivot.
    public static let middleLinePosition = 4
}

/// Shared, per-measure layout inputs, bundled so the element helpers each take a couple of
/// arguments rather than a long parameter list.
struct LayoutEnv {
    let geometry: StaffGeometry
    let scale: ScaleContext
    let metrics: GlyphMetrics
    let defaults: EngravingDefaults
    let noteheadWidthSpaces: StaffSpaces

    /// Notehead advance width in points.
    var noteheadWidth: CGFloat { scale.points(noteheadWidthSpaces) }
    func yPosition(_ position: Int) -> CGFloat { geometry.y(forPosition: position) }
    func points(_ spaces: StaffSpaces) -> CGFloat { scale.points(spaces) }
}

/// Turns a measure's `[EventDescriptor]` into a positioned `MeasureFrame`. Total and pure: no
/// throwing past the (already-decoded) inputs, deterministic geometry, no I/O. The element
/// helpers live in `MeasureLayout+Elements.swift`.
public enum MeasureLayoutEngine {
    /// Lay out `events` for one measure.
    ///
    /// - Parameters:
    ///   - events: the measure's voice-1 events (from `EventDescriptorBuilder`).
    ///   - context: clef + time signature + whether to draw the lead-in.
    ///   - origin: top-left staff anchor — `x` is the staff's left edge, `y` is the **top**
    ///     staff line (matching `StaffGeometry.topLineY`).
    ///   - scale: staff-space → point conversion.
    public static func layout(
        events: [EventDescriptor],
        context: MeasureContext,
        origin: CGPoint,
        scale: ScaleContext
    ) -> MeasureFrame {
        let metrics = GlyphMetrics.shared
        let measureQN = measureLength(context.timeSignature)
        let plan = widthPlan(
            eventCount: events.count,
            measureQN: measureQN,
            context: context,
            scale: scale,
            originX: origin.x
        )

        let geometry = StaffGeometry(
            originX: origin.x,
            topLineY: origin.y,
            width: plan.totalWidth,
            staffSpace: scale.staffSpacePoints
        )
        let noteheadWidthSpaces = metrics.boundingBox(for: .noteheadBlack)?.width
            ?? MeasureLayoutMetrics.noteheadWidthFallback
        let env = LayoutEnv(
            geometry: geometry,
            scale: scale,
            metrics: metrics,
            defaults: metrics.engravingDefaults,
            noteheadWidthSpaces: noteheadWidthSpaces
        )

        var elements = ElementBucket()
        for event in events {
            let fraction = min(max(qnInMeasure(event, measureQN: measureQN), 0), 1)
            let eventX = plan.noteStartX + scale.points(fraction * plan.noteAreaSpaces)
            if event.isRest {
                appendRest(event, x: eventX, env: env, into: &elements)
            } else {
                appendPitchedEvent(event, x: eventX, env: env, into: &elements)
            }
        }

        return assemble(elements, context: context, env: env, plan: plan)
    }

    // MARK: Width plan (ported spacing model)

    /// The horizontal plan for a measure: total width plus where the note area starts / spans.
    struct WidthPlan {
        let totalWidth: CGFloat
        let noteStartX: CGFloat
        let noteAreaSpaces: StaffSpaces
    }

    private static func measureLength(_ timeSignature: TimeSignature) -> Double {
        max(4.0 * Double(timeSignature.numerator) / Double(timeSignature.denominator), 1e-9)
    }

    private static func widthPlan(
        eventCount: Int,
        measureQN: Double,
        context: MeasureContext,
        scale: ScaleContext,
        originX: CGFloat
    ) -> WidthPlan {
        let count = max(eventCount, 1)
        let measureWidthSpaces = max(
            measureQN * MeasureLayoutMetrics.quarterNoteWidthSpaces,
            Double(count) * MeasureLayoutMetrics.perNoteMinWidthSpaces
        )
        let leadInSpaces = context.showsHeader
            ? MeasureLayoutMetrics.headerLeadInSpaces
            : MeasureLayoutMetrics.bareLeadInSpaces
        let noteAreaSpaces = max(
            measureWidthSpaces - leadInSpaces - MeasureLayoutMetrics.trailingPadSpaces,
            MeasureLayoutMetrics.minNoteAreaSpaces
        )
        return WidthPlan(
            totalWidth: scale.points(measureWidthSpaces),
            noteStartX: originX + scale.points(leadInSpaces),
            noteAreaSpaces: noteAreaSpaces
        )
    }

    /// Fraction of the measure this event starts at, from its qnStart relative to the measure.
    /// `qnStart` is track-cumulative; the remainder against the measure length recovers the
    /// within-measure offset (measures are whole multiples of `measureQN` for the corpus, and
    /// layout is called per measure anyway).
    private static func qnInMeasure(_ event: EventDescriptor, measureQN: Double) -> Double {
        let offset = event.qnStart.truncatingRemainder(dividingBy: measureQN)
        let normalized = offset < 0 ? offset + measureQN : offset
        return normalized / measureQN
    }

    // MARK: Assembly

    /// Accumulates positioned elements as events are laid out.
    struct ElementBucket {
        var noteheads: [PositionedGlyph] = []
        var rests: [PositionedGlyph] = []
        var accidentals: [PositionedGlyph] = []
        var dots: [PositionedGlyph] = []
        var flags: [PositionedGlyph] = []
        var stems: [LineSegment] = []
        var ledgerLines: [LineSegment] = []
        var anchors: [NoteAnchor] = []
    }

    private static func assemble(
        _ elements: ElementBucket,
        context: MeasureContext,
        env: LayoutEnv,
        plan: WidthPlan
    ) -> MeasureFrame {
        let clef = context.showClef ? clefGlyph(context: context, env: env) : nil
        let timeSignature = context.showTimeSignature
            ? timeSignatureGlyphs(context.timeSignature, env: env)
            : []

        let barlineX = env.geometry.originX + plan.totalWidth
        let barline = LineSegment(
            start: CGPoint(x: barlineX, y: env.yPosition(8)),
            end: CGPoint(x: barlineX, y: env.yPosition(0)),
            thickness: env.points(env.defaults.thinBarlineThickness)
        )

        return MeasureFrame(
            width: plan.totalWidth,
            originX: env.geometry.originX,
            topLineY: env.geometry.topLineY,
            staffSpace: env.scale.staffSpacePoints,
            clef: clef,
            timeSignature: timeSignature,
            noteheads: elements.noteheads,
            rests: elements.rests,
            accidentals: elements.accidentals,
            augmentationDots: elements.dots,
            flags: elements.flags,
            stems: elements.stems,
            ledgerLines: elements.ledgerLines,
            barline: barline,
            noteAnchors: elements.anchors
        )
    }
}
