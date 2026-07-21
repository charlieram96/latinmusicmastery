import Foundation
import XCTest

@testable import PlaySenseCore

/// Golden parity for `scoring.ts` — every case in these fixtures was produced by executing
/// the REAL TypeScript under Node (see Fixtures/README.md). All arithmetic paths must match
/// exactly (same IEEE-754 double ops in the same order); no tolerances.
final class ScoringParityTests: XCTestCase {
    func testGradeSingleOnsetParity() throws {
        let fixture = try FixtureLoader.decode(GradeSingleOnsetFixture.self, from: "grade_single_onset.json")
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 500, "expected the full property-case corpus")

        var failures: [String] = []
        for testCase in fixture.cases {
            let input = testCase.input
            var matched = Set(input.matchedIndices)
            let result = gradeSingleOnset(
                onsetTimestamp: input.onsetTimestamp,
                onsetEnergy: input.onsetEnergy,
                expectedEvents: input.expectedEvents,
                matchedIndices: &matched,
                difficulty: input.difficulty,
                calibrationOffsetSec: input.calibrationOffsetSec,
                widenMs: input.widenMs,
                instrumentCategory: input.instrumentCategory,
                detectedMidiNote: input.detectedMidiNote,
                detectedFrequency: input.detectedFrequency,
                detectedSurface: input.detectedSurface
            )
            if result != testCase.output.result {
                failures.append(
                    "\(testCase.name):\n  got  \(String(describing: result))"
                        + "\n  want \(String(describing: testCase.output.result))"
                )
            }
            if matched.sorted() != testCase.output.matchedIndices {
                failures.append(
                    "\(testCase.name): matchedIndices \(matched.sorted()) != \(testCase.output.matchedIndices)"
                )
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "gradeSingleOnset")
    }

    func testGradeChordOnsetParity() throws {
        let fixture = try FixtureLoader.decode(GradeChordOnsetFixture.self, from: "grade_chord_onset.json")
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 500, "expected the full property-case corpus")

        var failures: [String] = []
        for testCase in fixture.cases {
            let input = testCase.input
            var matched = Set(input.matchedIndices)
            let results = gradeChordOnset(
                onsetTimestamp: input.onsetTimestamp,
                onsetEnergy: input.onsetEnergy,
                expectedEvents: input.expectedEvents,
                matchedIndices: &matched,
                chordId: input.chordId,
                difficulty: input.difficulty,
                calibrationOffsetSec: input.calibrationOffsetSec,
                widenMs: input.widenMs,
                chroma: input.chroma
            )
            if results != testCase.output.results {
                failures.append("\(testCase.name):\n  got  \(results)\n  want \(testCase.output.results)")
            }
            if matched.sorted() != testCase.output.matchedIndices {
                failures.append(
                    "\(testCase.name): matchedIndices \(matched.sorted()) != \(testCase.output.matchedIndices)"
                )
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "gradeChordOnset")
    }

    func testGreedyMatchParity() throws {
        let fixture = try FixtureLoader.decode(GreedyMatchFixture.self, from: "greedy_match.json")
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 500, "expected the full property-case corpus")

        var failures: [String] = []
        for testCase in fixture.cases {
            let input = testCase.input
            let results = greedyMatch(
                expectedEvents: input.expectedEvents,
                detectedOnsets: input.detectedOnsets,
                difficulty: input.difficulty,
                calibrationOffsetSec: input.calibrationOffsetSec,
                widenMs: input.widenMs
            )
            if results != testCase.output.results {
                failures.append("\(testCase.name):\n  got  \(results)\n  want \(testCase.output.results)")
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "greedyMatch")
    }

    func testMatchOnsetToExpectedParity() throws {
        let fixture = try FixtureLoader.decode(
            MatchOnsetToExpectedFixture.self, from: "match_onset_to_expected.json"
        )
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 250, "expected the full property-case corpus")

        var failures: [String] = []
        for testCase in fixture.cases {
            let input = testCase.input
            let matchedBefore = Set(input.matchedIndices)
            let result = matchOnsetToExpected(
                onsetTimestamp: input.onsetTimestamp,
                expectedEvents: input.expectedEvents,
                matchedIndices: matchedBefore,
                difficulty: input.difficulty,
                calibrationOffsetSec: input.calibrationOffsetSec,
                widenMs: input.widenMs
            )
            if result?.eventIndex != testCase.output.matchedEventIndex {
                failures.append(
                    "\(testCase.name): \(String(describing: result?.eventIndex))"
                        + " != \(String(describing: testCase.output.matchedEventIndex))"
                )
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "matchOnsetToExpected")
    }

    func testComputeStatsParity() throws {
        let fixture = try FixtureLoader.decode(ComputeStatsFixture.self, from: "compute_stats.json")
        XCTAssertGreaterThanOrEqual(fixture.cases.count, 500, "expected the full property-case corpus")

        var failures: [String] = []
        for testCase in fixture.cases {
            let stats = computeStats(
                results: testCase.input.results,
                extraHits: testCase.input.extraHits,
                durationSeconds: testCase.input.durationSeconds
            )
            if stats != testCase.output {
                failures.append("\(testCase.name):\n  got  \(stats)\n  want \(testCase.output)")
            }
        }
        reportParity(failures, total: fixture.cases.count, function: "computeStats")
    }
}

/// Shared failure reporting: fail with the first few diffs + the total count, so a parity
/// regression names concrete cases without drowning the log.
func reportParity(
    _ failures: [String],
    total: Int,
    function: String,
    file: StaticString = #filePath,
    line: UInt = #line
) {
    XCTAssertTrue(
        failures.isEmpty,
        "\(function): \(failures.count)/\(total) golden cases diverged:\n"
            + failures.prefix(5).joined(separator: "\n"),
        file: file,
        line: line
    )
}
