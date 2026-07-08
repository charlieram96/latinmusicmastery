import CoreGraphics
import NotationEngraving
import ScoreModel
import XCTest

@testable import NotationUI

/// Golden-value tests for the pure cursor geometry: score-ms → cursor x interpolation between note
/// anchors, clamping, row-break sweep, and tap-x → qn hit-testing (the tap-to-seek inverse).
final class CursorGeometryTests: XCTestCase {
    /// A pitched score of `bars` quarter-note bars at 120 BPM (1 QN = 500 ms).
    private func score(bars: Int) -> ScoreDocument {
        let bar: [MusicalEvent] = [60, 62, 64, 65].map { .note(Note(durationQN: 1, midi: $0)) }
        let measures = (1...bars).map { Measure(number: $0, voices: [Voice(number: 1, events: bar)]) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil,
            stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: measures
        )
        return ScoreDocument(
            title: "S", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4), initialKeyFifths: 0, tracks: [track]
        )
    }

    private func geometry(bars: Int, width: CGFloat, mode: StaffLayoutMode) -> CursorGeometry {
        let doc = score(bars: bars)
        let track = doc.tracks[0]
        let descriptors = EventDescriptorBuilder.extractTrackEvents(
            track: track, initialTimeSignature: doc.initialTimeSignature, keyFifths: doc.initialKeyFifths
        )
        let scale = ScaleContext(staffSpacePoints: 10)
        let scoreLayout = SystemLayout.layout(
            measures: descriptors, availableWidth: width, mode: mode, scale: scale,
            startMsForQN: { ScoreTime.qnToTrackMs(track: track, score: doc, qn: $0) }
        )
        let total = ScoreTime.trackDurationMs(track: track, score: doc)
        return CursorGeometry(layout: scoreLayout, totalDurationMs: total)
    }

    func testCursorSitsOnEachAnchorAtItsOnsetMs() {
        let geo = geometry(bars: 2, width: 4000, mode: .scroll) // wide → single system, no wrapping
        XCTAssertFalse(geo.isEmpty)
        for anchor in geo.anchors {
            let pos = geo.cursorPosition(scoreMs: anchor.ms)
            XCTAssertEqual(pos?.x ?? -1, anchor.x, accuracy: 0.5, "cursor should sit on the anchor at its onset")
            XCTAssertEqual(pos?.system, anchor.system)
        }
    }

    func testInterpolatesLinearlyBetweenTwoAnchors() {
        let geo = geometry(bars: 2, width: 4000, mode: .scroll)
        // Take the first two anchors and probe the temporal midpoint.
        let lower = geo.anchors[0]
        let upper = geo.anchors[1]
        let midMs = (lower.ms + upper.ms) / 2
        let pos = geo.cursorPosition(scoreMs: midMs)
        XCTAssertEqual(
            pos?.x ?? -1, (lower.x + upper.x) / 2, accuracy: 0.5, "midpoint ms → midpoint x within a system"
        )
    }

    func testClampsBeforeFirstAndAfterLastAnchor() {
        let geo = geometry(bars: 2, width: 4000, mode: .scroll)
        let first = geo.anchors.first!
        let before = geo.cursorPosition(scoreMs: -5000)
        XCTAssertEqual(before?.x ?? -1, first.x, accuracy: 0.5, "before the first onset clamps to the first anchor")
        // Well past the end still returns a finite x on the last system.
        let after = geo.cursorPosition(scoreMs: 1_000_000)
        XCTAssertNotNil(after)
        XCTAssertTrue(after!.x.isFinite)
        XCTAssertEqual(after!.system, geo.anchors.last!.system)
    }

    func testRowBreakSweepsToRowEnd() {
        // Narrow width forces one measure per system → row breaks between measures.
        let geo = geometry(bars: 4, width: 360, mode: .wrapped)
        XCTAssertGreaterThan(geo.systemRowEndX.count, 1, "expected multiple systems")
        // Find an adjacent anchor pair that spans a system boundary.
        guard let idx = (1..<geo.anchors.count).first(where: { geo.anchors[$0].system != geo.anchors[$0 - 1].system })
        else { return XCTFail("expected a system boundary between anchors") }
        let lower = geo.anchors[idx - 1]
        let upper = geo.anchors[idx]
        // Just before the next downbeat, the cursor should be swept toward `lower`'s row end,
        // staying on its system (not jumped to `upper` yet).
        let almostUpper = lower.ms + (upper.ms - lower.ms) * 0.99
        let pos = geo.cursorPosition(scoreMs: almostUpper)
        XCTAssertEqual(pos?.system, lower.system, "cursor stays on the ending row until the downbeat")
        XCTAssertGreaterThan(pos?.x ?? 0, lower.x, "cursor sweeps past the last note toward the row end")
        XCTAssertLessThanOrEqual(pos?.x ?? .greatestFiniteMagnitude, geo.systemRowEndX[lower.system] + 1)
    }

    func testTapOnAnchorXRecoversItsQuarterNote() {
        let geo = geometry(bars: 2, width: 4000, mode: .scroll)
        for anchor in geo.anchors {
            let point = CGPoint(x: anchor.x, y: 0)
            let quarter = geo.quarterNote(at: point, mode: .scroll)
            XCTAssertEqual(quarter ?? -1, anchor.qn, accuracy: 1e-6, "tapping an anchor's x recovers its qn")
        }
    }

    func testTapBetweenAnchorsInterpolatesQuarterNote() {
        let geo = geometry(bars: 2, width: 4000, mode: .scroll)
        let lower = geo.anchors[0]
        let upper = geo.anchors[1]
        let midX = (lower.x + upper.x) / 2
        let quarter = geo.quarterNote(at: CGPoint(x: midX, y: 0), mode: .scroll)
        XCTAssertEqual(quarter ?? -1, (lower.qn + upper.qn) / 2, accuracy: 1e-6, "midpoint x → midpoint qn")
    }

    func testTapPicksSystemByYInWrapped() {
        let geo = geometry(bars: 4, width: 360, mode: .wrapped)
        // A tap on the second system's y should recover a qn on that system's range.
        guard geo.systemAnchorRanges.count > 1, !geo.systemAnchorRanges[1].isEmpty else {
            return XCTFail("expected a populated second system")
        }
        let secondSystemAnchor = geo.anchors[geo.systemAnchorRanges[1].lowerBound]
        let tapY = geo.systemYRanges[1].lowerBound + 1
        let quarter = geo.quarterNote(at: CGPoint(x: secondSystemAnchor.x, y: tapY), mode: .wrapped)
        XCTAssertEqual(quarter ?? -1, secondSystemAnchor.qn, accuracy: 1e-6, "y selects the row, x the note")
    }

    func testEmptyGeometryYieldsNoCursor() {
        let scale = ScaleContext(staffSpacePoints: 10)
        let scoreLayout = SystemLayout.layout(measures: [], availableWidth: 400, mode: .scroll, scale: scale)
        let geo = CursorGeometry(layout: scoreLayout, totalDurationMs: 0)
        XCTAssertTrue(geo.isEmpty)
        XCTAssertNil(geo.cursorPosition(scoreMs: 100))
        XCTAssertNil(geo.quarterNote(at: .zero, mode: .scroll))
    }
}
