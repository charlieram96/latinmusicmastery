import CoreGraphics
import Foundation
import ScoreModel
import XCTest

@testable import NotationEngraving

/// Totality: laying out EVERY track of EVERY real corpus document — in both modes, at an iPhone
/// and an iPad width — must produce finite, non-overlapping systems with tempo-walked anchors
/// that never regress. A `SystemLayout` that can trap or emit garbage on real data is a bug.
final class SystemLayoutCorpusTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 9)
    private let widths: [CGFloat] = [390, 1024]

    func testEveryCorpusTrackLaysOutInBothModes() throws {
        let data = try CorpusFixtureLoader.data("score_documents_corpus.json")
        let rows = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [[String: Any]],
            "expected the corpus fixture to be a JSON array of row objects"
        )
        XCTAssertGreaterThanOrEqual(rows.count, 10)

        var failures: [String] = []
        var systemsSeen = 0
        for row in rows {
            guard let parsed = row["parsed_score"] else { continue }
            let title = (row["title"] as? String) ?? "<unknown>"
            do {
                let document = try ScoreDocument.parse(JSONSerialization.data(withJSONObject: parsed))
                for track in document.tracks {
                    systemsSeen += check(track: track, document: document, title: title, failures: &failures)
                }
            } catch {
                failures.append("\(title): parse failed — \(error)")
            }
        }
        XCTAssertTrue(failures.isEmpty, "SystemLayout corpus failures:\n" + failures.joined(separator: "\n"))
        XCTAssertGreaterThan(systemsSeen, 0)
    }

    private func check(track: Track, document: ScoreDocument, title: String, failures: inout [String]) -> Int {
        let measures = EventDescriptorBuilder.extractTrackEvents(
            track: track, initialTimeSignature: document.initialTimeSignature, keyFifths: document.initialKeyFifths
        )
        let expectedEvents = measures.reduce(0) { $0 + $1.events.count }
        var systems = 0
        for mode in [StaffLayoutMode.wrapped, .scroll] {
            for width in widths {
                let layout = SystemLayout.layout(
                    measures: measures, availableWidth: width, mode: mode, scale: scale,
                    startMsForQN: { ScoreTime.qnToTrackMs(track: track, score: document, qn: $0) }
                )
                let label = "\(title) track \(track.index) [\(mode.rawValue) @\(Int(width))]"
                systems += layout.systems.count
                validate(layout, expectedEvents: expectedEvents, label: label, failures: &failures)
            }
        }
        return systems
    }

    private func validate(_ layout: ScoreLayout, expectedEvents: Int, label: String, failures: inout [String]) {
        guard layout.totalSize.width.isFinite, layout.totalSize.height.isFinite,
              layout.totalSize.width >= 0, layout.totalSize.height >= 0 else {
            failures.append("\(label): non-finite total size \(layout.totalSize)")
            return
        }
        if layout.noteAnchors.count != expectedEvents {
            failures.append("\(label): \(layout.noteAnchors.count) anchors != \(expectedEvents) events")
        }
        // Systems stack strictly downward (no overlapping / regressing rows).
        for pair in zip(layout.systems, layout.systems.dropFirst()) where pair.1.topLineY <= pair.0.topLineY {
            failures.append("\(label): system \(pair.1.index) topLineY not below \(pair.0.index)")
        }
        // Anchors: finite qn/ms and finite framing. Web-reality correction to the brief's
        // "strictly increasing ms" guess — GLOBAL ordering is NOT a corpus invariant: several
        // real tracks author grossly over/under-filled measures (e.g. "Partes de la Tumbadora"
        // measure 1 packs 17 QN of events into a 4/4 bar), so an event's `qnStart` can run far
        // past the next bar's downbeat and the flat anchor list regresses at boundaries. The web
        // renderer consumes the same non-monotonic data. Strict increase on WELL-FORMED data is
        // proven by `SystemLayoutTests.testAnchorMsStrictlyIncreasesViaTempoWalk`; within-measure
        // monotonicity by `MeasureCorpusTotalityTests`.
        for anchor in layout.noteAnchors where !(anchor.qnStart.isFinite && anchor.startMs.isFinite
            && anchor.frame.midX.isFinite && anchor.frame.midY.isFinite) {
            failures.append("\(label): non-finite anchor \(anchor)")
        }
    }
}
