import Foundation
import XCTest

@testable import PlaySenseCore

/// The second numeric trap from the D19 brief: TS `pitchCorrect` is a TRI-state —
/// `undefined` (not a pitched slot at all, excluded from the pitchAccuracy denominator)
/// vs `null` (pitched slot, pitch unknown, counted in the denominator) vs true/false.
/// Swift models it as `PitchJudgment`; `computeStats` must honor the distinction.
final class PitchJudgmentTests: XCTestCase {
    private func result(_ grade: HitGrade, _ pitch: PitchJudgment, offsetMs: Double? = 0) -> EventResult {
        EventResult(
            eventIndex: 0,
            grade: grade,
            offsetMs: offsetMs,
            timing: .onTime,
            onsetEnergy: 1,
            pitchCorrect: pitch
        )
    }

    func testNotApplicableIsExcludedFromThePitchAccuracyDenominator() {
        // 1 correct out of (correct + wrong) = 50%; the .notApplicable row must not dilute it.
        let stats = computeStats(
            results: [
                result(.perfect, .correct),
                result(.good, .wrong),
                result(.perfect, .notApplicable)
            ],
            extraHits: 0,
            durationSeconds: 10
        )
        XCTAssertEqual(stats.pitchAccuracy, 50)
    }

    func testUnknownCountsInTheDenominatorButNotTheNumerator() {
        // TS: `null` passes the `!== undefined` filter but fails `=== true` — 1 of 2 = 50%.
        let stats = computeStats(
            results: [
                result(.perfect, .correct),
                result(.perfect, .unknown)
            ],
            extraHits: 0,
            durationSeconds: 10
        )
        XCTAssertEqual(stats.pitchAccuracy, 50)
    }

    func testAllNotApplicableYieldsNilPitchAccuracy() {
        let stats = computeStats(
            results: [result(.perfect, .notApplicable), result(.miss, .notApplicable, offsetMs: nil)],
            extraHits: 0,
            durationSeconds: 10
        )
        XCTAssertNil(stats.pitchAccuracy)
    }

    func testAllUnknownYieldsZeroPitchAccuracyNotNil() {
        // The surprising-but-real TS consequence: percussion results produced by
        // gradeSingleOnset carry `pitchCorrect: null`, so an all-percussion attempt graded
        // through that path reports pitchAccuracy 0 — NOT null. Fixtures pin this too.
        let stats = computeStats(
            results: [result(.perfect, .unknown), result(.good, .unknown)],
            extraHits: 0,
            durationSeconds: 10
        )
        XCTAssertEqual(stats.pitchAccuracy, 0)
    }

    // MARK: JSON round-trip of the tri-state (absent vs null vs bool)

    func testDecodingDistinguishesAbsentFromNullFromBool() throws {
        let json = """
        [
            {"eventIndex": 0, "grade": "perfect", "offsetMs": 0, "timing": "on_time", "onsetEnergy": 1},
            {"eventIndex": 1, "grade": "perfect", "offsetMs": 0, "timing": "on_time", "onsetEnergy": 1,
             "pitchCorrect": null},
            {"eventIndex": 2, "grade": "perfect", "offsetMs": 0, "timing": "on_time", "onsetEnergy": 1,
             "pitchCorrect": true},
            {"eventIndex": 3, "grade": "perfect", "offsetMs": 0, "timing": "on_time", "onsetEnergy": 1,
             "pitchCorrect": false}
        ]
        """
        let results = try JSONDecoder().decode([EventResult].self, from: Data(json.utf8))
        XCTAssertEqual(results.map(\.pitchCorrect), [.notApplicable, .unknown, .correct, .wrong])
    }

    func testEncodingMirrorsTheTypeScriptWireShape() throws {
        let results = [
            result(.perfect, .notApplicable),
            result(.perfect, .unknown),
            result(.perfect, .correct),
            result(.perfect, .wrong)
        ]
        let data = try JSONEncoder().encode(results)
        let objects = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [[String: Any]])
        // undefined → key absent
        XCTAssertNil(objects[0]["pitchCorrect"])
        // null → NSNull
        XCTAssertTrue(objects[1]["pitchCorrect"] is NSNull)
        XCTAssertEqual(objects[2]["pitchCorrect"] as? Bool, true)
        XCTAssertEqual(objects[3]["pitchCorrect"] as? Bool, false)
    }
}
