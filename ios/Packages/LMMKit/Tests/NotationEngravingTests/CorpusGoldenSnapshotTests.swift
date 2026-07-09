import CoreGraphics
import Foundation
import LMMTestSupport
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
/// DEDUPE NOTE (C17 follow-up): the committed references reveal duplicate rows in the corpus —
/// docs 07/09/12 (`f8fdd313`/`3f000648`/`7d00d389`) are byte-identical across all three variants,
/// and docs 02/10/13 (`40f95aea`/`6614e939`/`c19358c9`) are likewise byte-identical to each other.
/// They render the same image because their track-0 content is the same. They are dedupe candidates
/// for a future corpus-trimming pass; per the C17 brief all 14 are retained here for now (the golden
/// net is meant to mirror the shipping corpus 1:1, and trimming is a separate, deliberate decision).
final class CorpusGoldenSnapshotTests: XCTestCase {
    /// 10 model-px/space × the web `BASE_SCALE` of 1.3.
    private let scale = ScaleContext(staffSpacePoints: 13)
    private let phoneWidth: CGFloat = 390
    private let tabletWidth: CGFloat = 744
    /// Cap the horizontal strip render at ~3 phone screens so reference PNGs stay small.
    private var scrollCropWidth: CGFloat { phoneWidth * 3 }

    /// The simulator OS the committed reference PNGs were recorded on. CoreText rasterization
    /// drifts subtly between OS versions, so a byte/perceptual snapshot recorded on one OS fails on
    /// another. This repo's own CI history REJECTED pinning runners to a fixed simulator OS, and CI
    /// selects 18.5 / 18.6 / 26.x while these goldens were recorded on 18.1 — so by default we skip
    /// this suite (with a visible message) rather than fail CI on unavoidable raster drift. It runs
    /// only when explicitly opted in (`RUN_NOTATION_GOLDENS=1` or `SIMCTL_CHILD_RUN_NOTATION_GOLDENS=1` —
    /// see `TestGates` for the D27 fix — the documented local invocation in `ios/README.md`) or when the
    /// live OS matches the recorded one. Do NOT delete the goldens — they are the intended regression net
    /// for a matched-OS local/record run.
    private static let recordedOSMajorMinor = "18.1"

    private func skipUnlessGoldensEnabled() throws {
        if TestGates.isEnabled("RUN_NOTATION_GOLDENS") { return }
        let version = ProcessInfo.processInfo.operatingSystemVersion
        let current = "\(version.majorVersion).\(version.minorVersion)"
        if current == Self.recordedOSMajorMinor { return }
        throw XCTSkip(
            "Notation goldens skipped: references were recorded on iOS \(Self.recordedOSMajorMinor), "
            + "running iOS \(current) — CoreText raster drift would fail the byte comparison. "
            + "Set RUN_NOTATION_GOLDENS=1 (or SIMCTL_CHILD_RUN_NOTATION_GOLDENS=1) to force them "
            + "(see ios/README.md)."
        )
    }

    func testCorpusGoldenImages() throws {
        try skipUnlessGoldensEnabled()
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
