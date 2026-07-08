import CoreGraphics
import Foundation
import ScoreModel

/// The two full-score layout modes, ported from `staff-renderer.tsx`'s `StaffLayoutMode`.
public enum StaffLayoutMode: String, Equatable, Sendable {
    /// Rows of measures stacked as systems (a page of sheet music); the view scrolls vertically.
    case wrapped
    /// One horizontal staff strip; all measures in a single row, scrolled horizontally.
    case scroll
}

/// A score-level cursor/hit-test anchor: an event's cumulative QN, its start time in
/// milliseconds (from a ``ScoreTime`` tempo walk supplied by the caller), the canvas-space
/// rectangle of its notehead column, and which system (row) it lives on. This is the
/// system-aware superset of ``NoteAnchor`` (which carries only qn + frame per measure).
public struct ScoreNoteAnchor: Equatable, Sendable {
    /// Cumulative quarter notes from the start of the track at the START of this event.
    public let qnStart: Double
    /// Score-relative milliseconds at the start of this event (tempo-walked).
    public let startMs: Double
    /// Canvas-space rectangle of the event's notehead column / rest glyph (global coords).
    public let frame: CGRect
    /// Index of the ``SystemFrame`` this anchor lives on (`0` in scroll mode).
    public let systemIndex: Int

    public init(qnStart: Double, startMs: Double, frame: CGRect, systemIndex: Int) {
        self.qnStart = qnStart
        self.startMs = startMs
        self.frame = frame
        self.systemIndex = systemIndex
    }
}

/// One system (row of measures) placed in the full-score canvas. Its `measures` are fully
/// laid-out ``MeasureFrame``s in *global* canvas coordinates; `frame` is the vertical band the
/// system occupies, used by the renderer to window drawing by visibility.
public struct SystemFrame: Equatable, Sendable {
    /// 0-based system index, top to bottom (wrapped) — always the single row `0` in scroll mode.
    public let index: Int
    /// Canvas y of this system's top staff line.
    public let topLineY: CGFloat
    /// Canvas x of the leftmost measure's staff origin.
    public let originX: CGFloat
    /// Total width spanned by the row's measures (last measure's right edge − `originX`).
    public let width: CGFloat
    /// Points per staff space this system was laid out at.
    public let staffSpace: CGFloat
    /// The vertical band this system occupies in the canvas, with headroom for stems/ledgers
    /// above and below — the renderer's per-system CALayer frame + visibility rect.
    public let frame: CGRect
    /// The row's measures, positioned in global canvas coordinates.
    public let measures: [MeasureFrame]

    public init(
        index: Int,
        topLineY: CGFloat,
        originX: CGFloat,
        width: CGFloat,
        staffSpace: CGFloat,
        frame: CGRect,
        measures: [MeasureFrame]
    ) {
        self.index = index
        self.topLineY = topLineY
        self.originX = originX
        self.width = width
        self.staffSpace = staffSpace
        self.frame = frame
        self.measures = measures
    }

    /// Staff geometry for the whole row's 5 lines (spanning every measure in the system).
    public var staffGeometry: StaffGeometry {
        StaffGeometry(originX: originX, topLineY: topLineY, width: width, staffSpace: staffSpace)
    }
}

/// A whole ``ScoreDocument`` track laid out for display: its systems, a flat list of
/// score-level note anchors (for the C18 cursor / hit-testing), the total scrollable canvas
/// size, and which mode produced it.
public struct ScoreLayout: Equatable, Sendable {
    public let systems: [SystemFrame]
    public let noteAnchors: [ScoreNoteAnchor]
    public let totalSize: CGSize
    public let mode: StaffLayoutMode

    public init(systems: [SystemFrame], noteAnchors: [ScoreNoteAnchor], totalSize: CGSize, mode: StaffLayoutMode) {
        self.systems = systems
        self.noteAnchors = noteAnchors
        self.totalSize = totalSize
        self.mode = mode
    }
}

/// The vertical/horizontal system-spacing constants, ported from `staff-renderer.tsx` and
/// expressed in staff spaces (the web works in "model units" of 10 px per staff space — every
/// px constant is therefore divided by 10 to land here, exactly as `MeasureLayoutMetrics` does
/// for the horizontal ones).
///
/// Provenance:
///   - `STAVE_TOP(40) + STAFF_LINE_TOP(40) = 80` px  → `8.0` spaces of headroom above the first
///     system's top staff line.
///   - `STAFF_LINE_SPAN(40) + WRAP_ROW_GAP(44) = 84` px → `8.4` spaces of system pitch.
///   - `STAFF_LINE_SPAN(40)` px → `4.0` spaces of staff height.
///   - derived bottom pad (`STAVE_HEIGHT + 20 − STAFF_LINE_TOP − STAFF_LINE_SPAN = 40` px)
///     → `4.0` spaces below the last system's bottom line.
///   - `SYSTEM_PADDING_X(12)` px → `1.2` spaces of left/right inset.
public enum SystemLayoutMetrics {
    public static let topMarginSpaces: StaffSpaces = 8.0
    public static let systemPitchSpaces: StaffSpaces = 8.4
    public static let staffHeightSpaces: StaffSpaces = 4.0
    public static let bottomMarginSpaces: StaffSpaces = 4.0
    public static let horizontalPaddingSpaces: StaffSpaces = 1.2
    /// Headroom above / footroom below a system's staff for the visibility band + stems/ledgers.
    public static let systemHeadroomSpaces: StaffSpaces = 4.0
}

/// Pure full-score layout: turns a track's `[MeasureDescriptor]` into a `ScoreLayout` for one
/// of the two modes. Total and deterministic — no font, no context, no I/O. Reuses
/// `MeasureLayoutEngine` per measure (threading the correct per-measure `MeasureContext`,
/// including `measureStartQN = cumulativeQN` so meter changes don't misplace downbeats).
public enum SystemLayout {
    /// Lay out `measures` for `mode` within `availableWidth` points at `scale`.
    ///
    /// - Parameters:
    ///   - measures: the track's per-measure descriptors, in order (from `extractTrackEvents`).
    ///   - availableWidth: total content width in points (the scroll view's bounds width). The
    ///     `horizontalPaddingSpaces` inset is applied inside, on both edges.
    ///   - mode: wrapped (rows stacked vertically) or scroll (one horizontal strip).
    ///   - scale: staff-space → point conversion (already folds in the user zoom).
    ///   - startMsForQN: maps an event's cumulative `qnStart` to score-relative milliseconds —
    ///     the caller builds this from `ScoreTime.qnToTrackMs(track:score:qn:)`. Defaults to
    ///     identity (geometry-only; real ms REQUIRES the tempo walk).
    public static func layout(
        measures: [MeasureDescriptor],
        availableWidth: CGFloat,
        mode: StaffLayoutMode,
        scale: ScaleContext,
        startMsForQN: (Double) -> Double = { $0 }
    ) -> ScoreLayout {
        guard !measures.isEmpty else {
            return ScoreLayout(systems: [], noteAnchors: [], totalSize: .zero, mode: mode)
        }
        // Web parity: every bar shares the widest measure's content-derived width so the staff
        // reads evenly (scroll: uniform; wrapped: the per-row justified width is >= this floor).
        let naturalWidthSpaces = measures
            .map { MeasureLayoutEngine.naturalWidthSpaces(
                eventCount: $0.events.count, measureQN: ScoreTime.measureLengthInQN($0.timeSignature)
            ) }
            .max() ?? MeasureLayoutMetrics.minNoteAreaSpaces

        switch mode {
        case .scroll:
            return layoutScroll(
                measures, naturalWidthSpaces: naturalWidthSpaces, scale: scale, startMsForQN: startMsForQN
            )
        case .wrapped:
            return layoutWrapped(
                measures, availableWidth: availableWidth, naturalWidthSpaces: naturalWidthSpaces,
                scale: scale, startMsForQN: startMsForQN
            )
        }
    }

    // MARK: Scroll — one horizontal strip, uniform-width bars, cumulative x

    private static func layoutScroll(
        _ measures: [MeasureDescriptor],
        naturalWidthSpaces: StaffSpaces,
        scale: ScaleContext,
        startMsForQN: (Double) -> Double
    ) -> ScoreLayout {
        let leftPad = scale.points(SystemLayoutMetrics.horizontalPaddingSpaces)
        let topLineY = scale.points(SystemLayoutMetrics.topMarginSpaces)
        let measureWidth = scale.points(naturalWidthSpaces)

        var frames: [MeasureFrame] = []
        var anchors: [ScoreNoteAnchor] = []
        var cursorX = leftPad
        for (index, descriptor) in measures.enumerated() {
            let context = measureContext(descriptor, showHeader: index == 0)
            let frame = MeasureLayoutEngine.layout(
                events: descriptor.events, context: context,
                origin: CGPoint(x: cursorX, y: topLineY), scale: scale,
                targetWidthSpaces: naturalWidthSpaces
            )
            frames.append(frame)
            anchors.append(contentsOf: scoreAnchors(frame, systemIndex: 0, startMsForQN: startMsForQN))
            cursorX += measureWidth
        }

        let contentWidth = cursorX - leftPad
        let system = SystemFrame(
            index: 0, topLineY: topLineY, originX: leftPad, width: contentWidth,
            staffSpace: scale.staffSpacePoints,
            frame: systemBand(topLineY: topLineY, width: cursorX + leftPad, scale: scale),
            measures: frames
        )
        let height = scale.points(
            SystemLayoutMetrics.topMarginSpaces
            + SystemLayoutMetrics.staffHeightSpaces
            + SystemLayoutMetrics.bottomMarginSpaces
        )
        return ScoreLayout(
            systems: [system], noteAnchors: anchors,
            totalSize: CGSize(width: cursorX + leftPad, height: height), mode: .scroll
        )
    }

    // MARK: Wrapped — rows of measures stacked vertically, each row justified to fill the width

    private static func layoutWrapped(
        _ measures: [MeasureDescriptor],
        availableWidth: CGFloat,
        naturalWidthSpaces: StaffSpaces,
        scale: ScaleContext,
        startMsForQN: (Double) -> Double
    ) -> ScoreLayout {
        let leftPad = scale.points(SystemLayoutMetrics.horizontalPaddingSpaces)
        // Web `avail = clientWidth/scale − pad*2`: a lone bar is stretched (or shrunk) to whatever
        // width is actually available — NOT floored to its natural width — so a narrow phone pane
        // still shows one measure filling the row rather than overflowing horizontally.
        let usableWidth = max(availableWidth - 2 * leftPad, 1)
        let naturalWidth = max(scale.points(naturalWidthSpaces), 1)
        // Web `avail >= measureWidth * 2 ? 2 : 1`, generalized: as many bars as fit at natural
        // width (uncapped so wide iPads pack more than the web's hardcoded 2). See the report's
        // web-reality note — a phone-width pane yields 1, matching the web's real behavior there.
        let perRow = max(1, Int((usableWidth / naturalWidth).rounded(.down)))
        let pitch = scale.points(SystemLayoutMetrics.systemPitchSpaces)
        let firstTopLineY = scale.points(SystemLayoutMetrics.topMarginSpaces)

        var systems: [SystemFrame] = []
        var anchors: [ScoreNoteAnchor] = []
        var index = 0
        var systemIndex = 0
        while index < measures.count {
            let rowCount = min(perRow, measures.count - index)
            let colWidth = usableWidth / CGFloat(rowCount)
            let topLineY = firstTopLineY + CGFloat(systemIndex) * pitch

            var frames: [MeasureFrame] = []
            for col in 0..<rowCount {
                let descriptor = measures[index + col]
                let originX = leftPad + CGFloat(col) * colWidth
                let context = measureContext(descriptor, showHeader: index + col == 0)
                let frame = MeasureLayoutEngine.layout(
                    events: descriptor.events, context: context,
                    origin: CGPoint(x: originX, y: topLineY), scale: scale,
                    targetWidthSpaces: colWidth / scale.staffSpacePoints
                )
                frames.append(frame)
                anchors.append(contentsOf: scoreAnchors(frame, systemIndex: systemIndex, startMsForQN: startMsForQN))
            }
            systems.append(SystemFrame(
                index: systemIndex, topLineY: topLineY, originX: leftPad, width: usableWidth,
                staffSpace: scale.staffSpacePoints,
                frame: systemBand(topLineY: topLineY, width: availableWidth, scale: scale),
                measures: frames
            ))
            index += rowCount
            systemIndex += 1
        }

        let height = firstTopLineY
            + CGFloat(systems.count - 1) * pitch
            + scale.points(SystemLayoutMetrics.staffHeightSpaces + SystemLayoutMetrics.bottomMarginSpaces)
        return ScoreLayout(
            systems: systems, noteAnchors: anchors,
            totalSize: CGSize(width: availableWidth, height: height), mode: .wrapped
        )
    }

    // MARK: Shared helpers

    /// Per-measure context: clef + time signature from the descriptor, header (clef+time-sig
    /// lead-in) only on the first measure of the score (web `showHeader = i === 0`), and the
    /// `measureStartQN = cumulativeQN` anchor so within-measure fractions survive meter changes.
    private static func measureContext(_ descriptor: MeasureDescriptor, showHeader: Bool) -> MeasureContext {
        MeasureContext(
            clef: descriptor.clef,
            timeSignature: descriptor.timeSignature,
            showClef: showHeader,
            showTimeSignature: showHeader,
            measureStartQN: descriptor.cumulativeQN
        )
    }

    /// Promote a measure's `[NoteAnchor]` (qn + global frame) to `[ScoreNoteAnchor]`, adding the
    /// tempo-walked start ms and the owning system index.
    private static func scoreAnchors(
        _ frame: MeasureFrame,
        systemIndex: Int,
        startMsForQN: (Double) -> Double
    ) -> [ScoreNoteAnchor] {
        frame.noteAnchors.map {
            ScoreNoteAnchor(
                qnStart: $0.qnStart, startMs: startMsForQN($0.qnStart),
                frame: $0.frame, systemIndex: systemIndex
            )
        }
    }

    /// The vertical band (CALayer frame + visibility rect) for a system whose top staff line is
    /// at `topLineY`, with headroom above and footroom below for stems/ledgers/beams.
    private static func systemBand(topLineY: CGFloat, width: CGFloat, scale: ScaleContext) -> CGRect {
        let headroom = scale.points(SystemLayoutMetrics.systemHeadroomSpaces)
        let bandHeight = scale.points(
            SystemLayoutMetrics.systemHeadroomSpaces
            + SystemLayoutMetrics.staffHeightSpaces
            + SystemLayoutMetrics.systemHeadroomSpaces
        )
        return CGRect(x: 0, y: max(0, topLineY - headroom), width: width, height: bandHeight)
    }
}
