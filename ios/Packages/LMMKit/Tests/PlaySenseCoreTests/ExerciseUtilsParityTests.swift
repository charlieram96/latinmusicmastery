import Foundation
import XCTest

@testable import PlaySenseCore

/// Golden parity for `exercise-utils.ts` + the pure pitch helpers in `scoring.ts` and the
/// `jsRound` (JS `Math.round`) trap. Exact equality throughout — every path is plain
/// IEEE-754 arithmetic except `frequencyToMidi` (log2), whose rounded integer output is
/// still compared exactly.
final class ExerciseUtilsParityTests: XCTestCase {
    private static let fixture: ExerciseUtilsFixture = {
        // swiftlint:disable:next force_try
        try! FixtureLoader.decode(ExerciseUtilsFixture.self, from: "exercise_utils.json")
    }()

    func testBeatToTimestampParity() {
        let cases = Self.fixture.beatToTimestamp
        XCTAssertGreaterThanOrEqual(cases.count, 300)
        var failures: [String] = []
        for testCase in cases {
            let input = testCase.input
            let got = beatToTimestamp(
                event: input.event,
                bpm: input.bpm,
                timeSignature: input.timeSignature,
                loopIndex: input.loopIndex,
                totalMeasures: input.totalMeasures,
                swing: input.swing
            )
            if got != testCase.output {
                failures.append("\(testCase.name): \(got) != \(testCase.output)")
            }
        }
        reportParity(failures, total: cases.count, function: "beatToTimestamp")
    }

    func testGenerateExpectedTimestampsParity() {
        let cases = Self.fixture.generateExpectedTimestamps
        XCTAssertGreaterThanOrEqual(cases.count, 100)
        var failures: [String] = []
        for testCase in cases where generateExpectedTimestamps(testCase.input) != testCase.output {
            failures.append("\(testCase.name): expected-event list diverged")
        }
        reportParity(failures, total: cases.count, function: "generateExpectedTimestamps")
    }

    func testGetExerciseDurationParity() {
        let cases = Self.fixture.getExerciseDuration
        var failures: [String] = []
        for testCase in cases where getExerciseDuration(testCase.input) != testCase.output {
            failures.append("\(testCase.name): \(getExerciseDuration(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "getExerciseDuration")
    }

    func testGetCountInDurationParity() {
        let cases = Self.fixture.getCountInDuration
        var failures: [String] = []
        for testCase in cases {
            let got = getCountInDuration(bpm: testCase.input.bpm, countInBeats: testCase.input.countInBeats)
            if got != testCase.output {
                failures.append("\(testCase.name): \(got) != \(testCase.output)")
            }
        }
        reportParity(failures, total: cases.count, function: "getCountInDuration")
    }

    func testGetLetterGradeParity() {
        let cases = Self.fixture.getLetterGrade
        XCTAssertGreaterThanOrEqual(cases.count, 200)
        var failures: [String] = []
        for testCase in cases where getLetterGrade(testCase.input) != testCase.output {
            failures.append("\(testCase.name): \(getLetterGrade(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "getLetterGrade")
    }

    func testBeatDurationToVexDurationParity() {
        let cases = Self.fixture.beatDurationToVexDuration
        var failures: [String] = []
        for testCase in cases where beatDurationToVexDuration(testCase.input) != testCase.output {
            failures.append("\(testCase.name): \(beatDurationToVexDuration(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "beatDurationToVexDuration")
    }

    func testFrequencyToMidiParity() {
        let cases = Self.fixture.frequencyToMidi
        var failures: [String] = []
        for testCase in cases where frequencyToMidi(testCase.input) != testCase.output {
            failures.append("\(testCase.name): \(frequencyToMidi(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "frequencyToMidi")
    }

    func testMidiToNoteNameParity() {
        let cases = Self.fixture.midiToNoteName
        XCTAssertGreaterThanOrEqual(cases.count, 128)
        var failures: [String] = []
        for testCase in cases where midiToNoteName(testCase.input) != testCase.output {
            failures.append("\(testCase.name): \(midiToNoteName(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "midiToNoteName")
    }

    /// The `Math.round` golden sweep — includes the half-toward-+∞ negatives and the
    /// famous `0.49999999999999994` case where a naive `floor(x + 0.5)` port goes wrong.
    func testJsRoundMatchesJavaScriptMathRound() {
        let cases = Self.fixture.jsRound
        XCTAssertGreaterThanOrEqual(cases.count, 100)
        var failures: [String] = []
        for testCase in cases where jsRound(testCase.input) != testCase.output {
            failures.append("jsRound(\(testCase.input)): \(jsRound(testCase.input)) != \(testCase.output)")
        }
        reportParity(failures, total: cases.count, function: "jsRound")
    }
}
