import CoreGraphics
import Foundation
import ScoreModel
import XCTest

@testable import NotationEngraving

/// Totality mandate (task C14): running `EventDescriptorBuilder` + `MeasureLayoutEngine` over
/// EVERY measure of EVERY one of the 14 real production corpus documents must never throw, and
/// every duration must resolve to a `DurationCode` with finite geometry. A layout function that
/// can trap on real data is a bug to fix, not a case to skip.
final class MeasureCorpusTotalityTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 12)

    func testEveryCorpusMeasureLaysOutWithFiniteGeometry() throws {
        let data = try CorpusFixtureLoader.data("score_documents_corpus.json")
        let rows = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [[String: Any]],
            "expected the corpus fixture to be a JSON array of row objects"
        )
        XCTAssertGreaterThanOrEqual(rows.count, 10, "expected the real ~14-row production corpus")

        var tally = Tally()
        var failures: [String] = []
        var beamsByTitle: [String: Int] = [:]
        for row in rows {
            processRow(row, tally: &tally, beamsByTitle: &beamsByTitle, failures: &failures)
        }

        XCTAssertTrue(failures.isEmpty, "Corpus totality failures:\n" + failures.joined(separator: "\n"))
        XCTAssertGreaterThan(tally.measures, 0)
        XCTAssertGreaterThan(tally.events, 0)
        print("C15 corpus totality: \(rows.count) documents, \(tally.measures) measures, "
            + "\(tally.events) events, \(tally.beamedGroups) beamed groups, \(tally.ties) ties.")
        for title in beamsByTitle.keys.sorted() {
            print("  beamed groups [\(title)] = \(beamsByTitle[title] ?? 0)")
        }
    }

    private struct Tally {
        var measures = 0
        var events = 0
        var beamedGroups = 0
        var ties = 0
    }

    private func processRow(
        _ row: [String: Any],
        tally: inout Tally,
        beamsByTitle: inout [String: Int],
        failures: inout [String]
    ) {
        let id = (row["id"] as? String) ?? "<unknown>"
        let title = (row["title"] as? String) ?? "<unknown>"
        guard let parsed = row["parsed_score"] else {
            failures.append("\(id) (\(title)): missing parsed_score")
            return
        }
        do {
            let document = try ScoreDocument.parse(JSONSerialization.data(withJSONObject: parsed))
            for track in document.tracks {
                let measures = EventDescriptorBuilder.extractTrackEvents(
                    track: track,
                    initialTimeSignature: document.initialTimeSignature,
                    keyFifths: document.initialKeyFifths
                )
                for (index, descriptor) in measures.enumerated() {
                    tally.measures += 1
                    tally.events += descriptor.events.count
                    // Exact beamed-group count straight from the grouper.
                    let groups = BeamGrouper.beamGroups(
                        events: descriptor.events, timeSignature: descriptor.timeSignature
                    )
                    tally.beamedGroups += groups.count
                    beamsByTitle[title, default: 0] += groups.count
                    let label = "\(title) track \(track.index) measure \(index)"
                    let frame = checkMeasure(descriptor, isFirst: index == 0, label: label, failures: &failures)
                    tally.ties += frame.ties.count
                }
            }
        } catch {
            failures.append("\(id) (\(title)): \(error)")
        }
    }

    @discardableResult
    private func checkMeasure(
        _ descriptor: MeasureDescriptor,
        isFirst: Bool,
        label: String,
        failures: inout [String]
    ) -> MeasureFrame {
        // Every qnStart is finite and monotonic within the measure.
        var previousQN = -Double.greatestFiniteMagnitude
        for event in descriptor.events {
            XCTAssertTrue(event.qnStart.isFinite)
            XCTAssertGreaterThanOrEqual(event.qnStart, previousQN)
            previousQN = event.qnStart
        }

        let context = MeasureContext(
            clef: descriptor.clef,
            timeSignature: descriptor.timeSignature,
            showClef: isFirst,
            showTimeSignature: isFirst,
            measureStartQN: descriptor.cumulativeQN
        )
        let frame = MeasureLayoutEngine.layout(
            events: descriptor.events,
            context: context,
            origin: CGPoint(x: 0, y: 48),
            scale: scale
        )
        assertFiniteGeometry(frame, label: label, failures: &failures)
        return frame
    }

    private func assertFiniteGeometry(_ frame: MeasureFrame, label: String, failures: inout [String]) {
        guard frame.width.isFinite, frame.width > 0 else {
            failures.append("\(label): non-finite/zero width \(frame.width)")
            return
        }
        let origins = frame.noteheads.map(\.origin) + frame.rests.map(\.origin)
            + frame.accidentals.map(\.origin) + frame.augmentationDots.map(\.origin)
            + frame.flags.map(\.origin)
        for point in origins where !(point.x.isFinite && point.y.isFinite) {
            failures.append("\(label): non-finite glyph origin \(point)")
            return
        }
        for stem in frame.stems where !(stem.start.x.isFinite && stem.end.y.isFinite) {
            failures.append("\(label): non-finite stem")
            return
        }
        for beam in frame.beams where !(beam.start.x.isFinite && beam.start.y.isFinite
            && beam.end.x.isFinite && beam.end.y.isFinite && beam.thickness.isFinite) {
            failures.append("\(label): non-finite beam \(beam)")
            return
        }
        for tie in frame.ties where !(tie.start.x.isFinite && tie.start.y.isFinite
            && tie.end.x.isFinite && tie.end.y.isFinite) {
            failures.append("\(label): non-finite tie")
            return
        }
        for tuplet in frame.tuplets where !(tuplet.digit.origin.x.isFinite && tuplet.digit.origin.y.isFinite) {
            failures.append("\(label): non-finite tuplet digit")
            return
        }
    }
}
