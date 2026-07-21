import Foundation
import XCTest

@testable import PlaySenseCore

/// Port of `lib/play-sense/__tests__/scoring.test.ts`, case-for-case. The golden fixtures
/// are the parity proof; these are the human-readable documentation of the contract.
final class ScoringVitestTests: XCTestCase {
    // MIDI 69 = A4 = 440 Hz.
    private let a4Hz = 440.0
    private let a4Midi = 69

    /// Frequency `cents` away from `baseHz`.
    private func freqOffByCents(_ baseHz: Double, _ cents: Double) -> Double {
        baseHz * pow(2, cents / 1200)
    }

    /// A single pitched event at t=1.000s expecting A4.
    private func pitchedEvent() -> [ExpectedEvent] {
        [ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: a4Midi)]
    }

    private func grade(
        _ detectedFrequency: Double?,
        difficulty: Difficulty = .beginner,
        onsetTimestamp: Double = 1.0
    ) -> EventResult? {
        var matched = Set<Int>()
        return gradeSingleOnset(
            onsetTimestamp: onsetTimestamp,
            onsetEnergy: 1.0,
            expectedEvents: pitchedEvent(),
            matchedIndices: &matched,
            difficulty: difficulty,
            calibrationOffsetSec: 0,
            widenMs: 0,
            instrumentCategory: .pitched,
            detectedMidiNote: detectedFrequency.map { Int(jsRound(69 + 12 * log2($0 / 440))) },
            detectedFrequency: detectedFrequency
        )
    }

    // MARK: gradeSingleOnset — tolerant pitch scoring

    func testAnInTuneOnTimeNoteIsAPerfectHit() throws {
        let result = try XCTUnwrap(grade(a4Hz))
        XCTAssertEqual(result.pitchCorrect, .correct)
        XCTAssertEqual(result.grade, .perfect)
    }

    func testASlightlyFlatNoteWithinToleranceKeepsFullCredit() throws {
        // -40 cents, inside the 80-cent beginner window.
        let result = try XCTUnwrap(grade(freqOffByCents(a4Hz, -40)))
        XCTAssertEqual(result.pitchCorrect, .correct)
        XCTAssertEqual(result.grade, .perfect)
        XCTAssertEqual(result.pitchCents, -40)
    }

    func testAnOctaveErrorCountsAsCorrectForBeginner() throws {
        let result = try XCTUnwrap(grade(a4Hz * 2)) // A5
        XCTAssertEqual(result.pitchCorrect, .correct)
        XCTAssertEqual(result.grade, .perfect)
    }

    func testAnOctaveErrorIsDowngradedNotZeroedForAdvanced() throws {
        let result = try XCTUnwrap(grade(a4Hz * 2, difficulty: .advanced))
        XCTAssertEqual(result.pitchCorrect, .wrong)
        // On-time perfect timing downgraded one level rather than forced to miss.
        XCTAssertEqual(result.grade, .good)
    }

    func testAClearlyWrongPitchDowngradesOneLevelRatherThanInstantMiss() throws {
        // Tritone above A4 (+600 cents) — well outside any tolerance.
        let result = try XCTUnwrap(grade(freqOffByCents(a4Hz, 600)))
        XCTAssertEqual(result.pitchCorrect, .wrong)
        XCTAssertEqual(result.grade, .good) // perfect → good
    }

    func testAnExpectedPitchWithNoDetectedPitchIsAMiss() throws {
        let result = try XCTUnwrap(grade(nil))
        XCTAssertEqual(result.pitchCorrect, .wrong)
        XCTAssertEqual(result.grade, .miss)
    }

    // MARK: gradeSingleOnset — percussion ignores pitch

    func testGradesOnTimingAloneForPercussion() throws {
        var matched = Set<Int>()
        let result = try XCTUnwrap(gradeSingleOnset(
            onsetTimestamp: 1.0,
            onsetEnergy: 1.0,
            expectedEvents: [ExpectedEvent(eventIndex: 0, timestamp: 1.0)],
            matchedIndices: &matched,
            difficulty: .beginner,
            calibrationOffsetSec: 0,
            widenMs: 0,
            instrumentCategory: .percussion
        ))
        XCTAssertEqual(result.grade, .perfect)
        // TS `pitchCorrect` is `null` here (pitched-but-unknown tri-state slot), NOT
        // undefined — so it still lands in computeStats' pitchAccuracy denominator.
        XCTAssertEqual(result.pitchCorrect, .unknown)
    }
}
