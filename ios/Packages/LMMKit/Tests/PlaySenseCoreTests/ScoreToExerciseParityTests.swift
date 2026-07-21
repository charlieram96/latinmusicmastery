import Foundation
import ScoreModel
import XCTest

@testable import PlaySenseCore

/// Golden parity for `score-to-exercise.ts`: the vitest fixtures, option variations, and
/// every track of all 14 production corpus documents (embedded in the fixture by the
/// generator). Each case also checks the chained `generateExpectedTimestamps` output of
/// the produced definition, pinning the full score → highway/grading pipeline.
final class ScoreToExerciseParityTests: XCTestCase {
    func testScoreToExerciseDefinitionParity() throws {
        let fixture = try FixtureLoader.decode(ScoreToExerciseFixture.self, from: "score_to_exercise.json")
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 25, "expected vitest + corpus totality cases")

        var failures: [String] = []
        for testCase in fixture.cases {
            let definition = scoreToExerciseDefinition(testCase.input.score, options: testCase.input.options)
            if definition != testCase.output {
                failures.append(
                    "\(testCase.name): definition diverged\n  got  \(definition)\n  want \(testCase.output)"
                )
                continue
            }
            let timestamps = generateExpectedTimestamps(definition)
            if timestamps != testCase.expectedTimestamps {
                failures.append("\(testCase.name): expectedTimestamps diverged")
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "scoreToExerciseDefinition")
    }
}

/// One row of `score_documents_corpus.json` (id/title + the parsed score itself).
private struct CorpusRow: Decodable {
    let id: String
    let title: String
    let parsedScore: ScoreDocument

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case parsedScore = "parsed_score"
    }
}

/// The corpus-totality mandate, run against the production corpus committed for C12 (in
/// `ScoreModelTests/Fixtures`) rather than the generator's embedded copies: every track of
/// every real `score_documents.parsed_score` row must convert without trapping, and the
/// Son Montuno doc is spot-asserted against hand-computed timings.
final class ScoreToExerciseCorpusTests: XCTestCase {
    func testEveryCorpusTrackConvertsToAnExerciseDefinition() throws {
        let data = try FixtureLoader.scoreModelFixtureData("score_documents_corpus.json")
        let rows = try JSONDecoder().decode([CorpusRow].self, from: data)
        XCTAssertGreaterThanOrEqual(rows.count, 10, "expected the full production corpus")

        var trackCount = 0
        for row in rows {
            for trackIndex in row.parsedScore.tracks.indices {
                let definition = scoreToExerciseDefinition(
                    row.parsedScore,
                    options: ScoreToExerciseOptions(trackIndex: trackIndex)
                )
                trackCount += 1
                XCTAssertEqual(
                    definition.measures,
                    row.parsedScore.tracks[trackIndex].measures.count,
                    "\(row.title) track \(trackIndex)"
                )
                XCTAssertEqual(definition.bpm, row.parsedScore.initialTempo, "\(row.title) track \(trackIndex)")
                // Every produced event must sit inside the track's measure range.
                for event in definition.events {
                    XCTAssertGreaterThanOrEqual(event.measure, 1)
                    XCTAssertLessThanOrEqual(event.measure, definition.measures)
                    XCTAssertGreaterThanOrEqual(event.beat, 1)
                }
            }
        }
        XCTAssertGreaterThanOrEqual(trackCount, 14, "every corpus doc contributes at least one track")
    }

    func testSonMontunoTresTrackSpotCheck() throws {
        let data = try FixtureLoader.scoreModelFixtureData("score_documents_corpus.json")
        let rows = try JSONDecoder().decode([CorpusRow].self, from: data)
        let sonMontuno = try XCTUnwrap(rows.first { $0.title.hasPrefix("Son Montuno") })

        let definition = scoreToExerciseDefinition(sonMontuno.parsedScore)
        // Tres track: 2 chords of 3 notes per bar x 4 bars.
        XCTAssertEqual(definition.instrument, .tres)
        XCTAssertEqual(definition.events.count, 24)
        XCTAssertEqual(definition.bpm, 96)
        XCTAssertEqual(Set(definition.events.map(\.chordId)).count, 8)

        // Fixed-BPM timeline at 96 BPM (beat = 0.625 s), tempo change at bar 3 deliberately
        // ignored (the exercise runs at the score's initialTempo — the D19 brief's
        // "fixed-BPM derived at runtime" rule): chords on beats 1 and 4 of each 4-beat bar.
        let timestamps = generateExpectedTimestamps(definition).map(\.timestamp)
        let beat = 0.625
        let barStarts: [Double] = (0..<4).map { Double($0) * 4 * beat }
        var expected: [Double] = []
        for start in barStarts {
            let chordOnBeat4 = start + 3 * beat
            expected += [start, start, start, chordOnBeat4, chordOnBeat4, chordOnBeat4]
        }
        XCTAssertEqual(timestamps, expected)
    }
}
