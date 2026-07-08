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
/// font, no context, no system breaks (C16). Beam bars, ties, and tuplet indications (C15) are
/// their own element arrays; flags are only emitted for the notes C15 does NOT beam.
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
    /// Beam bars (primary + secondary/partial) for every beamed group. See `BeamGeometry`.
    public let beams: [BeamSegment]
    /// Tie arcs between same-pitch adjacent noteheads. See `TieGeometry`.
    public let ties: [TieShape]
    /// Tuplet numbers + (when not fully beamed) brackets. See `TupletBracket`.
    public let tuplets: [TupletShape]

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
    /// Cumulative QN at the START of this measure — `MeasureDescriptor.cumulativeQN` from the
    /// descriptor pipeline (`EventDescriptor+Extract.swift`). This is the anchor `qnInMeasure`
    /// subtracts before dividing by the measure length, so within-measure fraction is correct
    /// even when the measure doesn't start on a multiple of its own length (e.g. right after a
    /// 4/4 → 3/4 meter change). Defaults to `0` for the common case of laying out a single
    /// measure whose events are already measure-relative (`qnStart` starting at `0`).
    public let measureStartQN: Double

    public init(
        clef: Clef,
        timeSignature: TimeSignature,
        showClef: Bool,
        showTimeSignature: Bool,
        measureStartQN: Double = 0
    ) {
        self.clef = clef
        self.timeSignature = timeSignature
        self.showClef = showClef
        self.showTimeSignature = showTimeSignature
        self.measureStartQN = measureStartQN
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
    /// Non-header (bare) measure lead-in — **not** a web port. The web formatter gives a bare
    /// measure no left-side lead-in at all; it only ever subtracts the trailing `-20`px
    /// (`trailingPadSpaces`) inset before the barline, so its note area effectively starts at
    /// x=0. This 1-space value is a deliberate C14 addition: under the linear-taper width
    /// approximation (no real VexFlow formatter to derive spacing from), a bare measure's first
    /// notehead sitting flush against the previous barline reads as visually cramped, so a small
    /// fixed gap is inserted for breathing room. Documented in the C14 report.
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
    ///   - targetWidthSpaces: when non-`nil`, the measure is stretched (or, at minimum,
    ///     natural-note-area-clamped) to this total width instead of its own content-derived
    ///     width. `SystemLayout` supplies it so every measure in a wrapped row shares one width
    ///     (web `w = avail / itemsInRow`) and scroll-mode bars share the widest measure's width
    ///     (web uniform `measureWidth`). `nil` preserves the pre-C16 single-measure behavior.
    public static func layout(
        events: [EventDescriptor],
        context: MeasureContext,
        origin: CGPoint,
        scale: ScaleContext,
        targetWidthSpaces: StaffSpaces? = nil
    ) -> MeasureFrame {
        let metrics = GlyphMetrics.shared
        let measureQN = measureLength(context.timeSignature)
        // An OVER-FULL bar holds more content than the meter admits (e.g. 17 QN crammed into a 4/4
        // measure — corpus doc `1613b8d9`). Spacing it against the nominal `measureQN` would clamp
        // every event past the nominal barline onto fraction 1, piling them illegibly at the right
        // edge. The web does NOT: `staff-renderer.tsx` calls `voice.setStrict(false)` and VexFlow's
        // Formatter spaces proportionally by the ACTUAL accumulated ticks. We mirror that by widening
        // the layout denominator (and the natural width) to the actual content QN when it exceeds the
        // nominal length; a well-formed bar keeps its nominal denominator/width, so nothing changes.
        let contentQN = contentQN(events: events, measureStartQN: context.measureStartQN)
        let layoutDenominatorQN = contentQN > measureQN + overfullToleranceQN ? contentQN : measureQN
        let plan = widthPlan(
            naturalWidthSpaces: naturalWidthSpaces(
                eventCount: events.count, measureQN: measureQN, contentQN: contentQN
            ),
            context: context,
            scale: scale,
            originX: origin.x,
            targetWidthSpaces: targetWidthSpaces
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

        // Beam grouping decides, up front, which events share a beam (and therefore a single
        // unified stem direction) — everything else keys off this.
        let beamPlan = BeamPlan.make(events: events, timeSignature: context.timeSignature)

        // Pass 1: place noteheads/rests/accidentals/dots/ledgers, capturing each pitched event's
        // stem geometry (deferred so beamed stems can reach the beam and beamed notes lose flags).
        var elements = ElementBucket()
        var layouts: [Int: EventLayout] = [:]
        for (index, event) in events.enumerated() {
            let fraction = min(
                max(qnInMeasure(event, measureStartQN: context.measureStartQN, measureQN: layoutDenominatorQN), 0),
                1
            )
            let eventX = plan.noteStartX + scale.points(fraction * plan.noteAreaSpaces)
            if event.isRest {
                appendRest(event, x: eventX, env: env, into: &elements)
            } else if let layout = layoutPitchedEvent(
                event, x: eventX, forcedStemUp: beamPlan.forcedStemUp(forEvent: index), env: env, into: &elements
            ) {
                layouts[index] = layout
            }
        }

        // Passes 2–5: stems, beams, ties, tuplets.
        let rhythm = resolveRhythm(events: events, layouts: layouts, plan: beamPlan, env: env, into: &elements)
        return assemble(elements, context: context, env: env, plan: plan, rhythm: rhythm)
    }

    // MARK: Width plan (ported spacing model)

    /// The horizontal plan for a measure: total width plus where the note area starts / spans.
    struct WidthPlan {
        let totalWidth: CGFloat
        let noteStartX: CGFloat
        let noteAreaSpaces: StaffSpaces
    }

    /// QN slack below which a measure is NOT treated as over-full — guards the exact-full common
    /// case (`contentQN == measureQN`, and floating-point sums a hair over it) from being widened,
    /// which would spuriously perturb every well-formed golden. Only genuine over-fill (content
    /// meaningfully past the nominal length) triggers the proportional spread.
    static let overfullToleranceQN: Double = 1e-6

    private static func measureLength(_ timeSignature: TimeSignature) -> Double {
        max(4.0 * Double(timeSignature.numerator) / Double(timeSignature.denominator), 1e-9)
    }

    /// The measure's actual content length in QN — the furthest event end (measure-relative
    /// `qnStart` + `durationQN`) across its events, `0` for an empty measure. For a well-formed
    /// bar this is `<=` the nominal `measureLength`; for an OVER-FULL bar (e.g. 17 QN crammed into
    /// 4/4) it exceeds it, and callers widen both the layout denominator and the natural width to
    /// it so events spread proportionally. The web has no explicit analogue — VexFlow's Formatter
    /// simply spaces by the actual accumulated ticks (`setStrict(false)`), which this reconstructs.
    static func contentQN(events: [EventDescriptor], measureStartQN: Double) -> Double {
        events.reduce(0.0) { furthest, event in
            max(furthest, (event.qnStart - measureStartQN) + max(event.durationQN, 0))
        }
    }

    /// The measure's own content-derived width (widest of its beat- and note-count floors), in
    /// staff spaces — the same figure `SystemLayout` maxes across a row/score for uniform bars.
    /// An over-full bar (`contentQN` past the nominal `measureQN`) is scaled up by
    /// `contentQN / measureQN`, mirroring how the web Formatter spreads a bar wider when it holds
    /// more ticks; a well-formed bar (`contentQN <= measureQN`, or the default `0`) is unscaled.
    static func naturalWidthSpaces(eventCount: Int, measureQN: Double, contentQN: Double = 0) -> StaffSpaces {
        let count = max(eventCount, 1)
        let base = max(
            measureQN * MeasureLayoutMetrics.quarterNoteWidthSpaces,
            Double(count) * MeasureLayoutMetrics.perNoteMinWidthSpaces
        )
        let overfill = measureQN > 0 && contentQN > measureQN + overfullToleranceQN
            ? contentQN / measureQN
            : 1
        return base * overfill
    }

    private static func widthPlan(
        naturalWidthSpaces: StaffSpaces,
        context: MeasureContext,
        scale: ScaleContext,
        originX: CGFloat,
        targetWidthSpaces: StaffSpaces?
    ) -> WidthPlan {
        // A caller-supplied target (justification) overrides the content-derived width; the note
        // area still floors at `minNoteAreaSpaces`, so an over-tight target never collapses notes.
        let measureWidthSpaces = targetWidthSpaces ?? naturalWidthSpaces
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
    /// `qnStart` is track-cumulative; subtracting `measureStartQN` (the descriptor pipeline's
    /// `MeasureDescriptor.cumulativeQN` anchor, threaded through `MeasureContext`) recovers the
    /// within-measure offset directly.
    ///
    /// This used to take `qnStart.truncatingRemainder(dividingBy: measureQN)`, which silently
    /// assumed every measure starts on a whole multiple of its own length — true for a constant
    /// meter, but wrong the instant a measure doesn't (e.g. right after a 4/4 → 3/4 change: the
    /// 3/4 measure starts at cumulative QN 4, and `4 % 3 = 1` misplaces its downbeat at fraction
    /// 1/3 instead of 0). Subtracting the real anchor is correct in both cases.
    private static func qnInMeasure(_ event: EventDescriptor, measureStartQN: Double, measureQN: Double) -> Double {
        (event.qnStart - measureStartQN) / measureQN
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
        plan: WidthPlan,
        rhythm: RhythmElements
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
            noteAnchors: elements.anchors,
            beams: rhythm.beams,
            ties: rhythm.ties,
            tuplets: rhythm.tuplets
        )
    }
}
