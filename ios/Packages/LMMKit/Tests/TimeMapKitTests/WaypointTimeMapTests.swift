import XCTest

@testable import TimeMapKit

/// Case-for-case port of
/// `components/playsense-studio/shared/__tests__/time-map.test.ts`. Test names mirror the
/// `it(...)` descriptions from that file.
final class WaypointTimeMapTests: XCTestCase {
    private func wp(_ position: Double, _ time: Double, _ measure: Int? = nil, _ beat: Double? = nil) -> Waypoint {
        Waypoint(musicalPositionQN: position, videoTimeSeconds: time, measureNumber: measure, beatInMeasure: beat)
    }

    // MARK: - WaypointTimeMap construction

    func testRejectsFewerThanTwoWaypoints() {
        XCTAssertThrowsError(try WaypointTimeMap(id: "id", method: .tap, waypoints: []))
        XCTAssertThrowsError(try WaypointTimeMap(id: "id", method: .tap, waypoints: [wp(0, 0)]))
    }

    func testRejectsDuplicateMusicalPositions() {
        XCTAssertThrowsError(
            try WaypointTimeMap(id: "id", method: .tap, waypoints: [wp(0, 0), wp(0, 1), wp(2, 2)])
        )
    }

    func testRejectsNonStrictlyIncreasingVideoTime() {
        XCTAssertThrowsError(
            try WaypointTimeMap(id: "id", method: .tap, waypoints: [wp(0, 0), wp(1, 0), wp(2, 1)])
        )
        XCTAssertThrowsError(
            try WaypointTimeMap(id: "id", method: .tap, waypoints: [wp(0, 1), wp(1, 0.5)])
        )
    }

    func testSortsUnsortedInput() throws {
        let map = try WaypointTimeMap(id: "id", method: .tap, waypoints: [wp(4, 2), wp(0, 0), wp(2, 1)])
        XCTAssertEqual(map.totalQN, 4)
        XCTAssertEqual(map.videoStart, 0)
        XCTAssertEqual(map.videoEnd, 2)
    }

    // MARK: - WaypointTimeMap interpolation

    /// Linear: 4 QN over 2 seconds, so 1 QN = 0.5 sec.
    private func makeLinear() throws -> WaypointTimeMap {
        try WaypointTimeMap(id: "linear", method: .tempo, waypoints: [wp(0, 0), wp(4, 2)])
    }

    func testToVideoTimeMapsEndpoints() throws {
        let linear = try makeLinear()
        XCTAssertEqual(linear.toVideoTime(0), 0)
        XCTAssertEqual(linear.toVideoTime(4), 2)
    }

    func testToVideoTimeInterpolatesTheMidpoint() throws {
        let linear = try makeLinear()
        XCTAssertEqual(linear.toVideoTime(2), 1)
    }

    func testToMusicalPositionIsTheInverse() throws {
        let linear = try makeLinear()
        XCTAssertEqual(linear.toMusicalPosition(0), 0)
        XCTAssertEqual(linear.toMusicalPosition(2), 4)
        XCTAssertEqual(linear.toMusicalPosition(1), 2)
    }

    func testExtrapolatesBeforeTheFirstWaypointUsingTheFirstSlope() throws {
        let linear = try makeLinear()
        XCTAssertEqual(linear.toVideoTime(-2), -1)
        XCTAssertEqual(linear.toMusicalPosition(-1), -2)
    }

    func testExtrapolatesAfterTheLastWaypointUsingTheLastSlope() throws {
        let linear = try makeLinear()
        XCTAssertEqual(linear.toVideoTime(8), 4)
        XCTAssertEqual(linear.toMusicalPosition(4), 8)
    }

    // MARK: - WaypointTimeMap with tempo change (piecewise linear)

    /// Bar 1-2 at 120 BPM (1 QN = 0.5 sec), bar 3+ at 60 BPM (1 QN = 1 sec).
    /// Waypoints: qn=0 -> t=0, qn=8 -> t=4, qn=12 -> t=8.
    private func makePiecewise() throws -> WaypointTimeMap {
        try WaypointTimeMap(
            id: "piecewise",
            method: .tap,
            waypoints: [wp(0, 0, 1, 1), wp(8, 4, 3, 1), wp(12, 8, 4, 1)]
        )
    }

    func testHonorsSlowSegmentAfterTempoChange() throws {
        let piecewise = try makePiecewise()
        XCTAssertEqual(piecewise.toVideoTime(8), 4)
        XCTAssertEqual(piecewise.toVideoTime(10), 6) // halfway through second segment
        XCTAssertEqual(piecewise.toVideoTime(12), 8)
    }

    func testHonorsFastSegmentBeforeTempoChange() throws {
        let piecewise = try makePiecewise()
        XCTAssertEqual(piecewise.toVideoTime(0), 0)
        XCTAssertEqual(piecewise.toVideoTime(4), 2)
        XCTAssertEqual(piecewise.toVideoTime(8), 4)
    }

    // MARK: - WaypointTimeMap.locate

    private func makeLocateFixture() throws -> WaypointTimeMap {
        try WaypointTimeMap(
            id: "m",
            method: .drag,
            waypoints: [wp(0, 0, 1, 1), wp(4, 2, 2, 1), wp(8, 4, 3, 1)]
        )
    }

    func testReturnsTheFirstWaypointAtOrBeforeVideoStart() throws {
        let map = try makeLocateFixture()
        XCTAssertEqual(map.locate(0), TimeMapLocation(measure: 1, beat: 1))
        XCTAssertEqual(map.locate(-5), TimeMapLocation(measure: 1, beat: 1))
    }

    func testReturnsTheLastWaypointAtOrAfterVideoEnd() throws {
        let map = try makeLocateFixture()
        XCTAssertEqual(map.locate(4), TimeMapLocation(measure: 3, beat: 1))
        XCTAssertEqual(map.locate(9), TimeMapLocation(measure: 3, beat: 1))
    }

    func testSnapsToNearerSideMidSegment() throws {
        let map = try makeLocateFixture()
        XCTAssertEqual(map.locate(0.5), TimeMapLocation(measure: 1, beat: 1))
        XCTAssertEqual(map.locate(1.5), TimeMapLocation(measure: 2, beat: 1))
        XCTAssertEqual(map.locate(2.5), TimeMapLocation(measure: 2, beat: 1))
        XCTAssertEqual(map.locate(3.5), TimeMapLocation(measure: 3, beat: 1))
    }
}
