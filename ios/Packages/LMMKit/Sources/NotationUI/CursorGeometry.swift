import CoreGraphics
import Foundation
import NotationEngraving

// `qn` / `ms` / `x` mirror the geometry vocabulary of the ported web renderer (`msToCursorPos` /
// `xToTimePosition`); keeping the names verbatim aids cross-referencing, same rationale as
// `ScoreTime`'s `qn`.
// swiftlint:disable identifier_name

/// Pure cursor / hit-test geometry derived from a ``ScoreLayout`` — the Swift port of
/// `staff-renderer.tsx`'s `msToCursorPos` (score-ms → cursor x + system) and `xToTimePosition`
/// (a tapped canvas point → musical position). It carries no UIKit; every method is a total
/// function of value inputs, so the whole sync math is unit-testable in isolation from the view.
///
/// Coordinate model: all `x`/`y` values are in the layout's GLOBAL canvas coordinates (the same
/// space `ScoreLayout.totalSize` spans and the tiles are placed in). The cursor's x for an event
/// is the mid-x of its notehead/rest frame; the same x is used for hit-testing so interpolation
/// stays self-consistent with placement.
public struct CursorGeometry: Equatable, Sendable {
    /// One cursor anchor: an event's onset in quarter notes + score-relative ms, its cursor x, and
    /// its system row.
    struct Anchor: Equatable, Sendable {
        let qn: Double
        let ms: Double
        let x: CGFloat
        let system: Int
    }

    /// One measure's highlight geometry: its canvas rect and the score-ms of its downbeat.
    struct MeasureGeom: Equatable, Sendable {
        let rect: CGRect
        let startMs: Double
    }

    /// Sorted ascending by `ms` (== ascending by qn — anchors are appended in score order).
    let anchors: [Anchor]
    /// Rightmost measure edge per system index — where the playhead sweeps to across a row break.
    let systemRowEndX: [CGFloat]
    /// Vertical [minY, maxY] of each system's anchor frames — hit-testing picks the system by
    /// anchor frames, NOT the (deliberately overlapping) system bands.
    let systemYRanges: [ClosedRange<CGFloat>]
    /// [start, end) anchor index range per system, for within-row hit-test interpolation.
    let systemAnchorRanges: [Range<Int>]
    let measureGeoms: [MeasureGeom]
    /// Score-ms of the first anchor and the true end of the piece (the cursor clamps to this span).
    let minMs: Double
    let maxMs: Double

    public var isEmpty: Bool { anchors.isEmpty }

    /// Build the geometry from a laid-out score. `totalDurationMs` is the track's full duration so
    /// the playhead can clamp past the last anchor to the true end (the layout's anchors stop at
    /// the last event's onset, which is before the piece actually ends).
    public init(layout: ScoreLayout, totalDurationMs: Double) {
        let systemCount = layout.systems.count

        var anchors: [Anchor] = []
        anchors.reserveCapacity(layout.noteAnchors.count)
        var yLo = [CGFloat](repeating: .greatestFiniteMagnitude, count: systemCount)
        var yHi = [CGFloat](repeating: -.greatestFiniteMagnitude, count: systemCount)
        var rangeStart = [Int](repeating: -1, count: systemCount)
        var rangeEnd = [Int](repeating: 0, count: systemCount)
        for (index, anchor) in layout.noteAnchors.enumerated() {
            anchors.append(
                Anchor(qn: anchor.qnStart, ms: anchor.startMs, x: anchor.frame.midX, system: anchor.systemIndex)
            )
            let system = anchor.systemIndex
            guard system >= 0, system < systemCount else { continue }
            yLo[system] = min(yLo[system], anchor.frame.minY)
            yHi[system] = max(yHi[system], anchor.frame.maxY)
            if rangeStart[system] < 0 { rangeStart[system] = index }
            rangeEnd[system] = index + 1
        }
        self.anchors = anchors

        var rowEnds = [CGFloat](repeating: 0, count: systemCount)
        for system in layout.systems where system.index >= 0 && system.index < systemCount {
            rowEnds[system.index] = system.originX + system.width
        }
        self.systemRowEndX = rowEnds

        self.systemYRanges = (0..<systemCount).map { system in
            yLo[system] <= yHi[system] ? yLo[system]...yHi[system] : (0...0)
        }
        self.systemAnchorRanges = (0..<systemCount).map { system in
            rangeStart[system] < 0 ? 0..<0 : rangeStart[system]..<rangeEnd[system]
        }

        self.measureGeoms = Self.buildMeasureGeoms(layout: layout)
        self.minMs = anchors.first?.ms ?? 0
        self.maxMs = max(totalDurationMs, anchors.last?.ms ?? 0)
    }

    /// Measure highlight geometry: a rect per ``MeasureFrame`` with its downbeat ms mapped from its
    /// first note anchor's qn via the flat score anchors (which carry both qn and ms).
    private static func buildMeasureGeoms(layout: ScoreLayout) -> [MeasureGeom] {
        var qnToMs: [Double: Double] = [:]
        for anchor in layout.noteAnchors { qnToMs[anchor.qnStart] = anchor.startMs }
        var geoms: [MeasureGeom] = []
        for system in layout.systems {
            for measure in system.measures {
                guard let firstQN = measure.noteAnchors.first?.qnStart,
                      let startMs = qnToMs[firstQN] else { continue }
                let rect = CGRect(
                    x: measure.originX,
                    y: measure.topLineY - measure.staffSpace,
                    width: measure.width,
                    height: measure.staffSpace * 6
                )
                geoms.append(MeasureGeom(rect: rect, startMs: startMs))
            }
        }
        return geoms.sorted { $0.startMs < $1.startMs }
    }

    // MARK: - Cursor placement (port of msToCursorPos)

    /// Interpolate a score-ms into a cursor x + which system it lives on. `nil` when there are no
    /// anchors (nothing to place a cursor on). Ported line-for-line from `msToCursorPos`, minus the
    /// trailing-gap box (iOS hides the cursor in gaps — brief's web-parity v1).
    public func cursorPosition(scoreMs: Double) -> (x: CGFloat, system: Int)? {
        guard !anchors.isEmpty else { return nil }
        let clamped = max(minMs, min(scoreMs, maxMs))

        if clamped <= anchors[0].ms { return (anchors[0].x, anchors[0].system) }
        let lastIdx = anchors.count - 1
        let last = anchors[lastIdx]
        if clamped >= last.ms {
            if lastIdx >= 1 {
                let prev = anchors[lastIdx - 1]
                let slope = (last.x - prev.x) / CGFloat(max(last.ms - prev.ms, 1))
                // Extrapolation only makes sense within the last system's row.
                let x = prev.system == last.system ? last.x + CGFloat(clamped - last.ms) * slope : last.x
                return (x, last.system)
            }
            return (last.x, last.system)
        }

        var low = 0
        var high = lastIdx
        while high - low > 1 {
            let mid = (low + high) / 2
            if anchors[mid].ms <= clamped { low = mid } else { high = mid }
        }
        let lower = anchors[low]
        let upper = anchors[high]
        // Interval spanning a row break: sweep from the last note of the row to that row's right
        // edge, so the playhead glides to the barline then jumps down at the next downbeat.
        if lower.system != upper.system {
            let rowEnd = lower.system < systemRowEndX.count ? systemRowEndX[lower.system] : lower.x
            let frac = CGFloat((clamped - lower.ms) / max(upper.ms - lower.ms, 1))
            return (lower.x + frac * (rowEnd - lower.x), lower.system)
        }
        let frac = CGFloat((clamped - lower.ms) / max(upper.ms - lower.ms, 1))
        return (lower.x + frac * (upper.x - lower.x), lower.system)
    }

    /// The rightmost measure whose downbeat is at or before `scoreMs`, for the measure highlight.
    /// `nil` when no measure qualifies (before the first downbeat / no geometry).
    public func activeMeasure(scoreMs: Double) -> CGRect? {
        guard !measureGeoms.isEmpty else { return nil }
        if scoreMs < measureGeoms[0].startMs { return nil }
        var low = 0
        var high = measureGeoms.count - 1
        while high - low > 1 {
            let mid = (low + high) / 2
            if measureGeoms[mid].startMs <= scoreMs { low = mid } else { high = mid }
        }
        let idx = measureGeoms[high].startMs <= scoreMs ? high : low
        return measureGeoms[idx].rect
    }

    // MARK: - Hit-testing (port of xToTimePosition)

    /// Map a tapped canvas point to a musical position in quarter notes, for tap-to-seek. In a
    /// wrapped layout the system is picked from `point.y` (via anchor frames), then the qn is
    /// interpolated between the two nearest anchors in that row; a scroll layout is one row.
    /// `nil` when there are no anchors.
    public func quarterNote(at point: CGPoint, mode: StaffLayoutMode) -> Double? {
        guard !anchors.isEmpty else { return nil }
        var range = 0..<anchors.count
        if mode == .wrapped {
            let system = systemNearest(atY: point.y)
            if system >= 0, system < systemAnchorRanges.count, !systemAnchorRanges[system].isEmpty {
                range = systemAnchorRanges[system]
            }
        }
        return interpolateQN(atX: point.x, in: range)
    }

    /// Nearest system to a canvas y, chosen by anchor-frame y-ranges (bands overlap, so they are
    /// unreliable). Returns the containing system, else the one whose range is closest.
    private func systemNearest(atY yValue: CGFloat) -> Int {
        var best = -1
        var bestDistance = CGFloat.greatestFiniteMagnitude
        for (system, range) in systemYRanges.enumerated() where !systemAnchorRanges[system].isEmpty {
            if range.contains(yValue) { return system }
            let distance = yValue < range.lowerBound ? range.lowerBound - yValue : yValue - range.upperBound
            if distance < bestDistance {
                bestDistance = distance
                best = system
            }
        }
        return best
    }

    /// Interpolate a qn from an x within a half-open anchor index range (port of `interpInRange`).
    private func interpolateQN(atX xValue: CGFloat, in range: Range<Int>) -> Double {
        let loIdx = range.lowerBound
        let hiIdx = range.upperBound - 1
        guard hiIdx > loIdx else {
            return anchors[max(0, min(loIdx, anchors.count - 1))].qn
        }
        let first = anchors[loIdx]
        let last = anchors[hiIdx]
        if xValue <= first.x {
            let second = anchors[loIdx + 1]
            let frac = Double((xValue - first.x) / max(second.x - first.x, 1))
            return max(0, first.qn + frac * (second.qn - first.qn))
        }
        if xValue >= last.x {
            let prev = anchors[hiIdx - 1]
            let frac = Double((xValue - prev.x) / max(last.x - prev.x, 1))
            return prev.qn + frac * (last.qn - prev.qn)
        }
        var low = loIdx
        var high = hiIdx
        while high - low > 1 {
            let mid = (low + high) / 2
            if anchors[mid].x <= xValue { low = mid } else { high = mid }
        }
        let frac = Double((xValue - anchors[low].x) / max(anchors[high].x - anchors[low].x, 1))
        return anchors[low].qn + frac * (anchors[high].qn - anchors[low].qn)
    }
}

// swiftlint:enable identifier_name
