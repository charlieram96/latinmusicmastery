import Foundation
import PlaySenseCore
import XCTest

@testable import LMMData

/// Pins ``AttemptInsertRow``/``AttemptEventInsertRow`` (the exact wire shape `LiveAttemptRepository
/// .insertAttempt`/`.insertEvents` send) against the live DB's column names — verified directly
/// against `information_schema.columns` for `play_sense_attempts`/`play_sense_attempt_events` and
/// against the web's `saveAttempt` action's insert objects (`app/actions/play-sense.ts`) — and pins
/// ``PlaySenseAttempt``'s decode against a captured-shape fixture (A2's convention).
final class AttemptRowCodingTests: XCTestCase {

    private static let sampleStats = AttemptStats(
        score: 88.5, accuracy: 91.25, perfectCount: 9, goodCount: 4, okCount: 2, missCount: 1,
        extraHits: 0, maxCombo: 7, maxStreak: 7, avgOffsetMs: 12.34, tempoDriftMs: 3.1,
        durationSeconds: 4.8, pitchAccuracy: 63.5 // must NOT appear on the wire — see below
    )

    // MARK: - AttemptInsertRow

    func testAttemptInsertRowKeysMatchLiveSchemaExactly() throws {
        let row = AttemptInsertRow(userId: UUID(), exerciseId: UUID(), stats: Self.sampleStats)
        let json = try encodeToDictionary(row)

        let expectedKeys: Set<String> = [
            "user_id", "exercise_id", "score", "accuracy", "perfect_count", "good_count",
            "ok_count", "miss_count", "extra_hits", "max_combo", "max_streak",
            "avg_offset_ms", "tempo_drift_ms", "duration_seconds"
        ]
        XCTAssertEqual(Set(json.keys), expectedKeys)
        XCTAssertNil(json["id"], "id is server-generated — never sent on insert")
        XCTAssertNil(json["created_at"], "created_at is server-defaulted — never sent on insert")
        XCTAssertNil(json["pitch_accuracy"], "no such column exists; AttemptStats.pitchAccuracy must never be sent")
    }

    func testAttemptInsertRowValuesMatchStats() throws {
        let userId = UUID()
        let exerciseId = UUID()
        let row = AttemptInsertRow(userId: userId, exerciseId: exerciseId, stats: Self.sampleStats)
        let json = try encodeToDictionary(row)

        XCTAssertEqual(json["user_id"] as? String, userId.uuidString)
        XCTAssertEqual(json["exercise_id"] as? String, exerciseId.uuidString)
        XCTAssertEqual(json["score"] as? Double, 88.5)
        XCTAssertEqual(json["accuracy"] as? Double, 91.25)
        XCTAssertEqual(json["perfect_count"] as? Int, 9)
        XCTAssertEqual(json["good_count"] as? Int, 4)
        XCTAssertEqual(json["ok_count"] as? Int, 2)
        XCTAssertEqual(json["miss_count"] as? Int, 1)
        XCTAssertEqual(json["extra_hits"] as? Int, 0)
        XCTAssertEqual(json["max_combo"] as? Int, 7)
        XCTAssertEqual(json["max_streak"] as? Int, 7)
        XCTAssertEqual(json["avg_offset_ms"] as? Double, 12.34)
        XCTAssertEqual(json["tempo_drift_ms"] as? Double, 3.1)
        XCTAssertEqual(json["duration_seconds"] as? Double, 4.8)
    }

    // MARK: - AttemptEventInsertRow

    func testAttemptEventInsertRowKeysMatchLiveSchemaExactly() throws {
        let attemptId = UUID()
        let event = EventResult(eventIndex: 3, grade: .perfect, offsetMs: 8.2, timing: .onTime, onsetEnergy: 0.9)
        let row = AttemptEventInsertRow(attemptId: attemptId, event: event)
        let json = try encodeToDictionary(row)

        let expectedKeys: Set<String> = ["attempt_id", "event_index", "grade", "offset_ms", "timing", "onset_energy"]
        XCTAssertEqual(Set(json.keys), expectedKeys)
        XCTAssertNil(json["id"])
        XCTAssertNil(json["created_at"])
        XCTAssertNil(json["detected_pitch"], "iOS-only EventResult fields have no column and must never be sent")
        XCTAssertNil(json["surface_correct"], "iOS-only EventResult fields have no column and must never be sent")
    }

    func testAttemptEventInsertRowValuesAndGradeRawValues() throws {
        let attemptId = UUID()
        let event = EventResult(eventIndex: 5, grade: .miss, offsetMs: nil, timing: nil, onsetEnergy: nil)
        let row = AttemptEventInsertRow(attemptId: attemptId, event: event)
        let json = try encodeToDictionary(row)

        XCTAssertEqual(json["attempt_id"] as? String, attemptId.uuidString)
        XCTAssertEqual(json["event_index"] as? Int, 5)
        XCTAssertEqual(json["grade"] as? String, "miss")
        // A miss carries no offset/timing — must encode as explicit JSON null (key present, value
        // null), not be omitted, matching the web's event row shape exactly.
        XCTAssertTrue(json.keys.contains("offset_ms"))
        XCTAssertTrue(json["offset_ms"] is NSNull)
        XCTAssertTrue(json.keys.contains("timing"))
        XCTAssertTrue(json["timing"] is NSNull)
        XCTAssertTrue(json.keys.contains("onset_energy"))
        XCTAssertTrue(json["onset_energy"] is NSNull)
    }

    func testAttemptEventInsertRowTimingRawValues() throws {
        for (timing, expected) in [(TimingFeedback.early, "early"), (.onTime, "on_time"), (.late, "late")] {
            let row = AttemptEventInsertRow(
                attemptId: UUID(),
                event: EventResult(eventIndex: 0, grade: .good, offsetMs: 1, timing: timing, onsetEnergy: 1)
            )
            let json = try encodeToDictionary(row)
            XCTAssertEqual(json["timing"] as? String, expected)
        }
    }

    // MARK: - PlaySenseAttempt decode (A2-style fixture)

    func testDecodesPlaySenseAttemptFromLiveShapedFixture() throws {
        let attempt = try DataFixtureLoader.decode(PlaySenseAttempt.self, from: "play_sense_attempt.json")

        XCTAssertEqual(attempt.id, UUID(uuidString: "9c9a2e5e-9c1a-4b1a-8b0a-6b8f2a9d0e11"))
        XCTAssertEqual(attempt.userId, UUID(uuidString: "3f2a1b4c-5d6e-4f70-8a91-1c2d3e4f5061"))
        XCTAssertEqual(attempt.exerciseId, UUID(uuidString: "7a8b9c0d-1e2f-4031-9a4b-5c6d7e8f9012"))
        XCTAssertEqual(attempt.score, 88.5)
        XCTAssertEqual(attempt.accuracy, 91.25)
        XCTAssertEqual(attempt.perfectCount, 9)
        XCTAssertEqual(attempt.goodCount, 4)
        XCTAssertEqual(attempt.okCount, 2)
        XCTAssertEqual(attempt.missCount, 1)
        XCTAssertEqual(attempt.extraHits, 0)
        XCTAssertEqual(attempt.maxCombo, 7)
        XCTAssertEqual(attempt.maxStreak, 7)
        XCTAssertEqual(attempt.avgOffsetMs, 12.34)
        XCTAssertEqual(attempt.tempoDriftMs, 3.1)
        XCTAssertEqual(attempt.durationSeconds, 4.8)
        XCTAssertNotNil(attempt.createdAt)
    }

    func testDecodesPlaySenseAttemptWithNullableColumnsAsNil() throws {
        let attempt = try DataFixtureLoader.decode(PlaySenseAttempt.self, from: "play_sense_attempt_nulls.json")

        XCTAssertNil(attempt.avgOffsetMs)
        XCTAssertNil(attempt.tempoDriftMs)
        XCTAssertNil(attempt.durationSeconds)
        XCTAssertNil(attempt.createdAt)
    }

    // MARK: - Helpers

    private func encodeToDictionary(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        return try XCTUnwrap(object as? [String: Any])
    }
}
