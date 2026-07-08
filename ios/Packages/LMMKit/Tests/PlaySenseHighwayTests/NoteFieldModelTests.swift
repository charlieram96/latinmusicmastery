// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import PlaySenseCore
import XCTest

@testable import PlaySenseHighway

/// Golden values for the uniform-fall `y(t)` and a scripted timeline exercising the
/// crossed / auto-missed set transitions.
final class NoteFieldModelTests: XCTestCase {

    // MARK: - y(t)

    func testNoteYGoldenValues() {
        let hitY = 800.0, approach = 1.7
        // At the timestamp (timeToHit 0) the note sits exactly on the hit line.
        XCTAssertEqual(noteY(timeToHit: 0, hitY: hitY, approachSec: approach), 800, accuracy: 1e-9)
        // A full approach before → top edge (y == 0).
        XCTAssertEqual(noteY(timeToHit: approach, hitY: hitY, approachSec: approach), 0, accuracy: 1e-9)
        // Half an approach before → halfway down.
        XCTAssertEqual(noteY(timeToHit: approach / 2, hitY: hitY, approachSec: approach), 400, accuracy: 1e-9)
        // Past the line → below it.
        XCTAssertEqual(noteY(timeToHit: -0.5, hitY: hitY, approachSec: approach),
                       800 + 0.5 * (800 / 1.7), accuracy: 1e-9)
    }

    private func expected(_ timestamps: [Double]) -> [ExpectedEvent] {
        timestamps.enumerated().map { ExpectedEvent(eventIndex: $0.offset, timestamp: $0.element) }
    }

    // MARK: - Visibility window

    func testApproachingNoteIsVisibleWithinWindow() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([2.0]))
        // 1s before its timestamp, within a 1.7s approach → visible, approaching.
        let frame = model.frame(elapsedSec: 1.0, hitY: 800, approachSec: 1.7)
        XCTAssertEqual(frame.visible.count, 1)
        XCTAssertFalse(frame.visible[0].isMissed)
        XCTAssertEqual(frame.visible[0].timeToHit, 1.0, accuracy: 1e-9)
        XCTAssertTrue(frame.autoMissed.isEmpty)
        XCTAssertTrue(frame.crossed.isEmpty)
    }

    func testFarFutureNoteNotYetVisible() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([10.0]))
        let frame = model.frame(elapsedSec: 0, hitY: 800, approachSec: 1.7)
        XCTAssertTrue(frame.visible.isEmpty)
    }

    // MARK: - Miss / cross transitions

    func testUnjudgedNoteAutoMissesThenCrossesOnce() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([1.0]))

        // Just past the line (0.1s past): auto-miss fires and it crosses this same frame.
        let f1 = model.frame(elapsedSec: 1.1, hitY: 800, approachSec: 1.7)
        XCTAssertEqual(f1.autoMissed, [0])
        XCTAssertEqual(f1.crossed, [0])
        XCTAssertEqual(f1.visible.count, 1)
        XCTAssertTrue(f1.visible[0].isMissed)

        // Next frame further past: neither auto-miss nor cross fires again (idempotent).
        let f2 = model.frame(elapsedSec: 1.3, hitY: 800, approachSec: 1.7)
        XCTAssertTrue(f2.autoMissed.isEmpty)
        XCTAssertTrue(f2.crossed.isEmpty)
        XCTAssertTrue(f2.visible[0].isMissed)

        // After the miss lifetime it disappears.
        let f3 = model.frame(elapsedSec: 1.0 + missLifeSec + 0.1, hitY: 800, approachSec: 1.7)
        XCTAssertTrue(f3.visible.isEmpty)
    }

    func testMarkedHitNoteIsNeverVisibleOrMissed() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([1.0]))
        model.markHit(0)
        // Even well past the line, a hit note is gone and never auto-misses.
        let frame = model.frame(elapsedSec: 1.2, hitY: 800, approachSec: 1.7)
        XCTAssertTrue(frame.visible.isEmpty)
        XCTAssertTrue(frame.autoMissed.isEmpty)
        XCTAssertFalse(model.isMissed(0))
    }

    func testExternallyMarkedMissDoesNotAutoMissButStillCrosses() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([1.0]))
        model.markMissed(0) // e.g. the coordinator graded it a miss before it visually crossed
        let frame = model.frame(elapsedSec: 1.1, hitY: 800, approachSec: 1.7)
        XCTAssertTrue(frame.autoMissed.isEmpty, "already-missed note should not re-report an auto-miss")
        XCTAssertEqual(frame.crossed, [0])
        XCTAssertTrue(frame.visible[0].isMissed)
    }

    // MARK: - Closest event

    func testClosestEventIgnoresJudged() {
        let model = NoteFieldModel()
        model.setExpectedEvents(expected([1.0, 2.0, 3.0]))
        XCTAssertEqual(model.closestEventIndex(elapsedSec: 1.9), 1)
        model.markHit(1)
        XCTAssertEqual(model.closestEventIndex(elapsedSec: 1.9), 0)
        model.markMissed(0)
        XCTAssertEqual(model.closestEventIndex(elapsedSec: 1.9), 2)
    }
}

// swiftlint:enable identifier_name
