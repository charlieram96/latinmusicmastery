import Foundation
import XCTest

@testable import PlaySenseCore

/// Port of `lib/play-sense/__tests__/chord-scoring.test.ts`, case-for-case.
final class ChordScoringVitestTests: XCTestCase {
    /// A C major triad at t=1.000s, expanded to one expected event per note, all sharing
    /// chordId "c0". MIDI 60=C(pc0), 64=E(pc4), 67=G(pc7).
    private func triad() -> [ExpectedEvent] {
        [
            ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: "c0"),
            ExpectedEvent(eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: "c0"),
            ExpectedEvent(eventIndex: 2, timestamp: 1.0, expectedPitch: 67, chordId: "c0")
        ]
    }

    /// Build a normalized 12-bin chroma with the given pitch classes "present" (=1).
    private func chromaWith(_ pitchClasses: [Int]) -> [Double] {
        var chroma = [Double](repeating: 0, count: 12)
        for pitchClass in pitchClasses { chroma[pitchClass] = 1 }
        return chroma
    }

    private func gradeTriad(_ chroma: [Double]?, difficulty: Difficulty = .beginner) -> [EventResult] {
        var matched = Set<Int>()
        return gradeChordOnset(
            onsetTimestamp: 1.0, // on-time onset
            onsetEnergy: 1.0,
            expectedEvents: triad(),
            matchedIndices: &matched,
            chordId: "c0",
            difficulty: difficulty,
            calibrationOffsetSec: 0,
            widenMs: 0,
            chroma: chroma
        )
    }

    // MARK: gradeChordOnset — chord-as-set scoring

    func testAFullTriadIsAPerfectHitForEveryNote() {
        let results = gradeTriad(chromaWith([0, 4, 7]))
        XCTAssertEqual(results.count, 3)
        XCTAssertTrue(results.allSatisfy { $0.grade == .perfect })
        XCTAssertTrue(results.allSatisfy { $0.pitchCorrect == .correct })
    }

    func testTwoOfThreePresentIsAHitAtBeginner() {
        let results = gradeTriad(chromaWith([0, 4])) // missing G
        XCTAssertTrue(results.allSatisfy { $0.grade == .perfect })
        // The absent note is flagged, but the chord still passes.
        XCTAssertEqual(results.first { $0.eventIndex == 2 }?.pitchCorrect, .wrong)
    }

    func testTwoOfThreePresentIsDowngradedAtAdvanced() {
        let results = gradeTriad(chromaWith([0, 4]), difficulty: .advanced)
        XCTAssertTrue(results.allSatisfy { $0.grade != .perfect })
        XCTAssertTrue(results.allSatisfy { $0.grade != .miss }) // downgraded, not zeroed
    }

    func testOneOfThreePresentIsHeavilyDowngradedTowardAMiss() {
        let results = gradeTriad(chromaWith([0]))
        XCTAssertTrue(results.allSatisfy { $0.grade == .miss })
    }

    func testExtraWrongPitchClassesDoNotPenalize() {
        let results = gradeTriad(chromaWith([0, 4, 7, 1, 6])) // triad + two wrong notes
        XCTAssertTrue(results.allSatisfy { $0.grade == .perfect })
    }

    func testRelativeThresholdAQuietBinBelow35PercentOfMaxIsNotPresent() {
        var chroma = chromaWith([0, 4]) // C and E loud
        chroma[7] = 0.2 // G present but only 20% of max → below threshold
        let results = gradeTriad(chroma, difficulty: .advanced)
        // Still effectively 2-of-3 → downgraded at advanced.
        XCTAssertTrue(results.allSatisfy { $0.grade != .perfect })
    }

    func testMissingChromaFallsBackToALenientTimingOnlyHit() {
        let results = gradeTriad(nil)
        XCTAssertTrue(results.allSatisfy { $0.grade == .perfect })
    }

    func testMarksEveryGroupEventAsMatched() {
        var matched = Set<Int>()
        _ = gradeChordOnset(
            onsetTimestamp: 1.0,
            onsetEnergy: 1.0,
            expectedEvents: triad(),
            matchedIndices: &matched,
            chordId: "c0",
            difficulty: .beginner,
            calibrationOffsetSec: 0,
            widenMs: 0,
            chroma: chromaWith([0, 4, 7])
        )
        XCTAssertTrue(matched.contains(0) && matched.contains(1) && matched.contains(2))
    }

    // MARK: matchOnsetToExpected — chord routing helper

    func testReturnsAChordGroupEventWhenAnOnsetLandsInTheTimingWindow() throws {
        let candidate = try XCTUnwrap(matchOnsetToExpected(
            onsetTimestamp: 1.0, expectedEvents: triad(), matchedIndices: [], difficulty: .beginner
        ))
        XCTAssertEqual(candidate.chordId, "c0")
    }

    func testReturnsNilWhenNoEventIsWithinTheOkWindow() {
        let candidate = matchOnsetToExpected(
            onsetTimestamp: 5.0, expectedEvents: triad(), matchedIndices: [], difficulty: .beginner
        )
        XCTAssertNil(candidate)
    }

    func testDoesNotConsumeTheMatchedEvent() {
        // Read-only by construction in Swift: `matchedIndices` is a non-inout value
        // parameter, so the compiler enforces what the TS test asserted at runtime.
        let matched = Set<Int>()
        _ = matchOnsetToExpected(
            onsetTimestamp: 1.0, expectedEvents: triad(), matchedIndices: matched, difficulty: .beginner
        )
        XCTAssertTrue(matched.isEmpty)
    }
}
