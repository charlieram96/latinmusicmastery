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

    // MARK: Tile-boundary regression (C17 fix round)

    /// A measure straddling a column-tile boundary must render identically whether drawn as one
    /// wide tile or as two column tiles composited back together. This guards the scroll-strip
    /// tiling seam: the split draws the straddling measure (clipped) into BOTH neighbouring tiles,
    /// and — with the column boundary snapped to the device-pixel grid — the composite must be
    /// pixel-for-pixel the single-tile render, with no seam artifact.
    func testMultiTileRenderMatchesSingleTileAcrossColumnBoundary() {
        let scale = ScaleContext(staffSpacePoints: 13)
        let bar: [MusicalEvent] = [60, 64, 67, 72].map { .note(Note(durationQN: 1, midi: $0)) }
        let measures = (1...4).map { Measure(number: $0, voices: [Voice(number: 1, events: bar)]) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil,
            stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: measures
        )
        let descriptors = EventDescriptorBuilder.extractTrackEvents(
            track: track, initialTimeSignature: TimeSignature(numerator: 4, denominator: 4)
        )
        let layout = SystemLayout.layout(measures: descriptors, availableWidth: 390, mode: .scroll, scale: scale)
        guard let system = layout.systems.first, system.measures.count >= 2 else {
            return XCTFail("expected a multi-measure scroll strip")
        }
        let band = system.frame
        let contentHeight = layout.totalSize.height
        let displayScale: CGFloat = 2

        // A boundary in the MIDDLE of measure index 1 (not on a barline) so the bar straddles it,
        // snapped to the device-pixel grid exactly as `columnRects` does in production.
        let straddled = system.measures[1]
        let boundary = ((straddled.originX + straddled.width / 2) * displayScale).rounded() / displayScale

        let format = UIGraphicsImageRendererFormat.preferred()
        format.opaque = false
        format.scale = displayScale

        func render(_ column: CGRect) -> UIImage {
            UIGraphicsImageRenderer(size: column.size, format: format).image { ctx in
                drawSystem(system, in: ctx.cgContext, contentHeight: contentHeight,
                           column: column, notationColor: .lightDefault)
            }
        }

        let single = render(band)
        let colA = CGRect(x: band.minX, y: band.minY, width: boundary - band.minX, height: band.height)
        let colB = CGRect(x: boundary, y: band.minY, width: band.maxX - boundary, height: band.height)
        let tileA = render(colA)
        let tileB = render(colB)
        let composite = UIGraphicsImageRenderer(size: band.size, format: format).image { _ in
            tileA.draw(at: CGPoint(x: colA.minX - band.minX, y: 0))
            tileB.draw(at: CGPoint(x: colB.minX - band.minX, y: 0))
        }

        let diff = maxChannelDifference(single, composite)
        XCTAssertLessThanOrEqual(diff, 1, "two-tile composite diverges from single-tile at the seam (Δ \(diff))")
    }

    /// Max per-channel absolute difference between two images, normalized through a common
    /// device-RGB bitmap so scale/format metadata can't skew the comparison. `0` == pixel-equal.
    private func maxChannelDifference(_ first: UIImage, _ second: UIImage) -> Int {
        guard let cgFirst = first.cgImage, let cgSecond = second.cgImage else { return 255 }
        let width = min(cgFirst.width, cgSecond.width)
        let height = min(cgFirst.height, cgSecond.height)
        func bytes(_ image: CGImage) -> [UInt8] {
            var data = [UInt8](repeating: 0, count: width * height * 4)
            let context = CGContext(
                data: &data, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
            context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return data
        }
        return zip(bytes(cgFirst), bytes(cgSecond)).reduce(0) { max($0, abs(Int($1.0) - Int($1.1))) }
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
