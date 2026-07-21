import Foundation
import XCTest

@testable import PlaySenseCore

/// Native coverage for the two `exercise-utils.ts` helpers the golden fixtures can't
/// pin directly: `groupEventsByMeasure` (the TS returns an insertion-ordered `Map`,
/// which JSON can't round-trip) and `getDifficultyColor` (trivial string table).
final class ExerciseUtilsNativeTests: XCTestCase {
    private func event(beat: Double, measure: Int) -> ExerciseEvent {
        ExerciseEvent(
            beat: beat,
            measure: measure,
            instrument: .conga,
            technique: .open,
            hand: .right,
            duration: 1,
            vexKey: "g/5",
            accent: false
        )
    }

    func testGroupEventsByMeasureBucketsAndSortsByBeat() {
        let events = [
            event(beat: 3, measure: 2),
            event(beat: 2, measure: 1),
            event(beat: 1, measure: 2),
            event(beat: 4, measure: 1),
            event(beat: 1, measure: 5) // out of range — dropped, like the TS Map.get miss
        ]
        let grouped = groupEventsByMeasure(events: events, measures: 3)

        XCTAssertEqual(Set(grouped.keys), [1, 2, 3])
        XCTAssertEqual(grouped[1]?.map(\.beat), [2, 4])
        XCTAssertEqual(grouped[2]?.map(\.beat), [1, 3])
        XCTAssertEqual(grouped[3], [])
    }

    func testGroupEventsByMeasureWithZeroMeasuresIsEmpty() {
        XCTAssertTrue(groupEventsByMeasure(events: [event(beat: 1, measure: 1)], measures: 0).isEmpty)
    }

    func testGetDifficultyColorTable() {
        XCTAssertEqual(getDifficultyColor("beginner"), "text-green-500")
        XCTAssertEqual(getDifficultyColor("intermediate"), "text-yellow-500")
        XCTAssertEqual(getDifficultyColor("advanced"), "text-red-500")
        XCTAssertEqual(getDifficultyColor("anything-else"), "text-muted-foreground")
    }
}
