import NotationEngraving
import ScoreModel
import UIKit
import XCTest

@testable import NotationUI

/// Behavior tests for the UIKit `NotationView`: it lays a loaded score into per-system tiles and
/// windows drawing to the visible rect (+ one screen) — tiles far outside release their drawn
/// `contents`, and scrolling shifts which tiles are drawn.
final class NotationViewTests: XCTestCase {
    /// A tall wrapped document: many single-measure systems on a narrow view so most fall
    /// outside the window.
    private func tallDocument(measureCount: Int) -> ScoreDocument {
        let bar: [MusicalEvent] = [60, 64, 67, 72].map { .note(Note(durationQN: 1, midi: $0)) }
        let measures = (1...measureCount).map { Measure(number: $0, voices: [Voice(number: 1, events: bar)]) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "Guitar", tuning: nil,
            stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: measures
        )
        return ScoreDocument(
            title: "Tall", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0, tracks: [track]
        )
    }

    private func makeView(measureCount: Int) -> NotationView {
        // Narrow width forces 1 measure per system → `measureCount` systems; short height forces
        // windowing.
        let view = NotationView(frame: CGRect(x: 0, y: 0, width: 320, height: 400))
        view.load(score: tallDocument(measureCount: measureCount), trackIndex: 0, mode: .wrapped)
        view.layoutIfNeeded()
        view.updateVisibleSystems()
        return view
    }

    func testLoadsOneSystemPerMeasureAtNarrowWidth() {
        let view = makeView(measureCount: 12)
        XCTAssertEqual(view.scoreLayout?.systems.count, 12, "narrow width should wrap to one measure per row")
    }

    func testWindowsDrawingToVisibleRectPlusOneScreen() {
        let view = makeView(measureCount: 30)
        let rendered = view.renderedSystemIndices
        let total = view.scoreLayout?.systems.count ?? 0
        XCTAssertGreaterThan(total, rendered.count, "far-offscreen systems must not all be drawn")
        XCTAssertFalse(rendered.isEmpty, "the top systems must be drawn at rest")
        // At rest (offset 0) the window is [−400, 800]; only the top band of systems draws — the
        // last system (deep offscreen) is released.
        XCTAssertTrue(rendered.contains(0))
        XCTAssertFalse(rendered.contains(total - 1))
    }

    func testScrollingShiftsTheDrawnWindow() {
        let view = makeView(measureCount: 30)
        let topRendered = view.renderedSystemIndices
        let total = view.scoreLayout?.systems.count ?? 0

        // Scroll to the bottom of the content.
        let contentHeight = view.scoreLayout?.totalSize.height ?? 0
        view.setContentOffset(CGPoint(x: 0, y: max(0, contentHeight - 400)), animated: false)
        view.updateVisibleSystems()
        let bottomRendered = view.renderedSystemIndices

        XCTAssertTrue(bottomRendered.contains(total - 1), "the last system should draw once scrolled to it")
        XCTAssertFalse(bottomRendered.contains(0), "the top system should release once far above the window")
        XCTAssertNotEqual(topRendered, bottomRendered, "the drawn window should move with the scroll")
    }

    func testScrollModeIsSingleSystem() {
        let view = NotationView(frame: CGRect(x: 0, y: 0, width: 320, height: 400))
        view.load(score: tallDocument(measureCount: 6), trackIndex: 0, mode: .scroll)
        view.layoutIfNeeded()
        XCTAssertEqual(view.scoreLayout?.systems.count, 1)
        XCTAssertGreaterThan(view.scoreLayout?.totalSize.width ?? 0, view.bounds.width, "scroll strip overflows width")
    }

    // MARK: Scroll-strip column tiling (C17)

    /// A long single-system scroll strip must be split into multiple bounded column tiles rather
    /// than one gigantic bitmap. At a large staff space (≈ zoom 2.6) a 44-measure strip is well
    /// over 16k px wide — every column tile must still render under the CGImage/Metal 8192 px
    /// texture limit on both axes.
    func testScrollStripSplitsIntoBoundedColumnTiles() {
        let view = NotationView(frame: CGRect(x: 0, y: 0, width: 390, height: 400))
        view.baseStaffSpacePoints = 26 // 10 base × ~2.6 zoom — a very wide strip
        view.load(score: tallDocument(measureCount: 44), trackIndex: 0, mode: .scroll)
        view.layoutIfNeeded()

        XCTAssertEqual(view.scoreLayout?.systems.count, 1, "scroll is one logical system")
        let stripWidth = view.scoreLayout?.totalSize.width ?? 0
        XCTAssertGreaterThan(stripWidth, 8192, "the raw strip must exceed a single texture's width")
        XCTAssertGreaterThan(view.tileColumns.count, 1, "the wide strip must split into >1 column tile")

        for size in view.tilePixelSizes {
            XCTAssertLessThan(size.width, 8192, "tile pixel width \(size.width) must stay under the texture limit")
            XCTAssertLessThan(size.height, 8192, "tile pixel height \(size.height) must stay under the texture limit")
        }
        // The tiles must tile the whole strip with no gaps (last tile reaches the strip's end).
        let maxTileRight = view.tileColumns.map(\.maxX).max() ?? 0
        XCTAssertGreaterThanOrEqual(maxTileRight, stripWidth - 1, "tiles must cover the full strip width")
    }

    /// Horizontal windowing: at rest only the left column tiles draw; scrolling far right draws
    /// the right tiles and releases the far-left ones (the scroll analogue of vertical windowing).
    func testHorizontalScrollingShiftsTheDrawnTileWindow() {
        let view = NotationView(frame: CGRect(x: 0, y: 0, width: 390, height: 400))
        view.baseStaffSpacePoints = 26
        view.load(score: tallDocument(measureCount: 44), trackIndex: 0, mode: .scroll)
        view.layoutIfNeeded()
        view.updateVisibleSystems()

        let leftRendered = view.renderedTileColumns
        XCTAssertFalse(leftRendered.isEmpty, "left tiles draw at rest")
        let stripWidth = view.scoreLayout?.totalSize.width ?? 0
        // At rest (offset 0) no tile near the far right edge should be drawn.
        XCTAssertFalse(
            leftRendered.contains { $0.minX > stripWidth * 0.6 },
            "far-right tiles must not draw while scrolled to the left"
        )

        // Scroll to the far right.
        view.setContentOffset(CGPoint(x: max(0, stripWidth - 390), y: 0), animated: false)
        view.updateVisibleSystems()
        let rightRendered = view.renderedTileColumns

        XCTAssertTrue(
            rightRendered.contains { $0.maxX >= stripWidth - 1 },
            "the rightmost tile draws once scrolled to it"
        )
        XCTAssertFalse(
            rightRendered.contains { $0.maxX < stripWidth * 0.3 },
            "the far-left tiles release once scrolled far right"
        )
    }

    /// Wrapped mode is unaffected by the tiling change: each system remains a single tile (its
    /// width is one screen, well under any texture limit).
    func testWrappedSystemsRemainSingleTiles() {
        let view = makeView(measureCount: 12)
        XCTAssertEqual(view.tileColumns.count, view.scoreLayout?.systems.count,
                       "wrapped mode keeps one column tile per system")
    }

    func testEmptyScoreLoadsWithoutCrashing() {
        let empty = ScoreDocument(
            title: "Empty", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0,
            tracks: [Track(
                index: 0, instrument: .guitar, displayName: "G", tuning: nil,
                stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: []
            )]
        )
        let view = NotationView(frame: CGRect(x: 0, y: 0, width: 320, height: 400))
        view.load(score: empty, trackIndex: 0, mode: .wrapped)
        view.layoutIfNeeded()
        XCTAssertTrue(view.renderedSystemIndices.isEmpty)
    }
}
