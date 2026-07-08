import XCTest

@testable import LMMData

/// Unit tests for ``ABLoop`` — the pure A–B loop policy mirroring the web transport clock.
final class ABLoopTests: XCTestCase {
    func testSingleEndpointIsNeitherValidNorLooping() {
        var loop = ABLoop()
        loop.setA(10)
        XCTAssertFalse(loop.isValid)
        XCTAssertNil(loop.loopTarget(currentSeconds: 100))
    }

    func testSettingAThenBEnablesAndValidates() {
        var loop = ABLoop()
        loop.setA(10)
        loop.setB(20)
        XCTAssertTrue(loop.isValid)
        XCTAssertTrue(loop.isEnabled)
    }

    func testBBeforeAIsInvalidAndDoesNotAutoEnable() {
        var loop = ABLoop()
        loop.setA(20)
        loop.setB(10) // B <= A
        XCTAssertFalse(loop.isValid)
        XCTAssertFalse(loop.isEnabled)
        XCTAssertNil(loop.loopTarget(currentSeconds: 30))
    }

    func testLoopTargetWrapsToAOnceBReached() {
        var loop = ABLoop()
        loop.setA(10)
        loop.setB(20)
        XCTAssertNil(loop.loopTarget(currentSeconds: 15)) // before B
        XCTAssertEqual(loop.loopTarget(currentSeconds: 20), 10) // at B
        XCTAssertEqual(loop.loopTarget(currentSeconds: 25), 10) // past B
    }

    func testDisabledLoopNeverWraps() {
        var loop = ABLoop()
        loop.setA(10)
        loop.setB(20)
        loop.setEnabled(false)
        XCTAssertNil(loop.loopTarget(currentSeconds: 25))
    }

    func testClearResetsEverything() {
        var loop = ABLoop(pointA: 10, pointB: 20, isEnabled: true)
        loop.clear()
        XCTAssertNil(loop.pointA)
        XCTAssertNil(loop.pointB)
        XCTAssertFalse(loop.isEnabled)
        XCTAssertFalse(loop.isValid)
    }
}
