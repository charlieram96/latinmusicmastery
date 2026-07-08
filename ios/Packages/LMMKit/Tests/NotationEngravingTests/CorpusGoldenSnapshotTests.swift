import CoreGraphics
import Foundation
import ScoreModel
import SnapshotTesting
import UIKit
import XCTest

@testable import NotationEngraving

/// C17 golden-image corpus net: snapshot EVERY production corpus document (all 14) through the
/// full `SystemLayout` + engraving + drawing stack, in every layout the product ships —
/// a wrapped page at a phone width (390) and a small-tablet width (744), plus the first ~3
/// screens of the horizontal scroll strip. Light ink, base scale 1.3 (the web's `BASE_SCALE`,
/// i.e. 10 model-px/space × 1.3 ≈ 13 pt/space). This is the regression net every future notation
/// change is measured against, and the iOS side of the C17 side-by-side vs the web renderer.
///
/// Named per document `id` (its corpus slug) + variant so the 42 references stay stable and
/// individually diffable. Track 0 of each document (the lead/melody or first percussion voice)
/// is snapshotted — enough surface to catch spacing/glyph regressions without exploding the
/// reference set. Even the pathological over-filled bar (doc `1613b8d9`, 17 QN packed into a 4/4
/// measure) is snapshotted: it must render SOMETHING finite and sane, not trap or blow up.
final class CorpusGoldenSnapshotTests: XCTestCase {
    /// 10 model-px/space × the web `BASE_SCALE` of 1.3.
    private let scale = ScaleContext(staffSpacePoints: 13)
    private let phoneWidth: CGFloat = 390
    private let tabletWidth: CGFloat = 744
    /// Cap the horizontal strip render at ~3 phone screens so reference PNGs stay small.
    private var scrollCropWidth: CGFloat { phoneWidth * 3 }

    func testCorpusGoldenImages() throws {
        let rows = try loadCorpusRows()
        XCTAssertEqual(rows.count, 14, "the golden net must cover the full 14-document corpus")

        for (index, row) in rows.enumerated() {
            guard let parsed = row["parsed_score"] else {
                XCTFail("row \(index) has no parsed_score"); continue
            }
            let slug = String((row["id"] as? String ?? "\(index)").prefix(8))
            let document = try ScoreDocument.parse(JSONSerialization.data(withJSONObject: parsed))
            guard let track = document.tracks.first else {
                XCTFail("\(slug): no tracks"); continue
            }
            let measures = EventDescriptorBuilder.extractTrackEvents(
                track: track, initialTimeSignature: document.initialTimeSignature,
                keyFifths: document.initialKeyFifths
            )
            guard !measures.isEmpty else { continue }
            let name = "\(String(format: "%02d", index))-\(slug)"
            let msForQN: (Double) -> Double = { ScoreTime.qnToTrackMs(track: track, score: document, qn: $0) }

            func layout(_ mode: StaffLayoutMode, _ width: CGFloat) -> ScoreLayout {
                SystemLayout.layout(measures: measures, availableWidth: width, mode: mode, scale: scale,
                                    startMsForQN: msForQN)
            }
            snapshot(layout(.wrapped, phoneWidth), named: "\(name)-wrapped390")
            snapshot(layout(.wrapped, tabletWidth), named: "\(name)-wrapped744")
            snapshot(layout(.scroll, phoneWidth), named: "\(name)-scroll")
        }
    }

    // MARK: Helpers

    private func loadCorpusRows() throws -> [[String: Any]] {
        let data = try CorpusFixtureLoader.data("score_documents_corpus.json")
        return try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [[String: Any]],
            "expected the corpus fixture to be a JSON array of row objects"
        )
    }

    private func snapshot(
        _ layout: ScoreLayout,
        named: String,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        // Scroll strips are cropped to ~3 screens; wrapped pages render their full height.
        let canvasWidth = layout.mode == .scroll
            ? min(layout.totalSize.width, scrollCropWidth)
            : layout.totalSize.width
        let size = CGSize(width: max(canvasWidth, 1), height: max(layout.totalSize.height, 1))
        XCTAssertTrue(size.width.isFinite && size.height.isFinite && size.width > 0 && size.height > 0,
                      "\(named): non-sane canvas \(size)", file: file, line: line)

        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(UIColor.white.cgColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawScoreLayout(layout, in: ctx, size: layout.totalSize, notationColor: .lightDefault)
        }
        assertSnapshot(
            of: image, as: .image(precision: 0.98, perceptualPrecision: 0.97),
            named: named, file: file, testName: testName, line: line
        )
    }
}
