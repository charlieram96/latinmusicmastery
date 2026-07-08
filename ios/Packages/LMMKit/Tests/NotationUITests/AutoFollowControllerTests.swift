import XCTest

@testable import NotationUI

/// State-machine tests for auto-follow suspension: a user drag suspends following, an idle
/// interval or a seek resumes it, and the resume-flip is reported so the view can re-snap.
final class AutoFollowControllerTests: XCTestCase {
    func testStartsFollowing() {
        XCTAssertTrue(AutoFollowController().following)
    }

    func testUserInteractionSuspendsFollowing() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 10)
        XCTAssertFalse(controller.following)
    }

    func testStaysSuspendedBeforeIdleThreshold() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 10)
        XCTAssertFalse(controller.tick(now: 11.9), "still within the 2 s idle window")
        XCTAssertFalse(controller.following)
    }

    func testResumesAfterIdleThreshold() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 10)
        XCTAssertTrue(controller.tick(now: 12.0), "the resume flip should be reported")
        XCTAssertTrue(controller.following)
    }

    func testFurtherInteractionExtendsTheIdleWindow() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 10)
        _ = controller.tick(now: 11.5)
        controller.userInteracted(now: 11.5) // fresh interaction resets the clock
        XCTAssertFalse(controller.tick(now: 13.0), "2 s from the LATEST interaction, not the first")
        XCTAssertTrue(controller.tick(now: 13.5))
    }

    func testSeekResumesImmediately() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 10)
        controller.didSeek()
        XCTAssertTrue(controller.following, "a seek re-engages follow at once")
        XCTAssertFalse(controller.tick(now: 10.01), "already following → no resume flip")
    }

    func testTickWhileFollowingIsANoOp() {
        var controller = AutoFollowController()
        XCTAssertFalse(controller.tick(now: 100))
        XCTAssertTrue(controller.following)
    }

    func testResetReturnsToFollowing() {
        var controller = AutoFollowController()
        controller.userInteracted(now: 5)
        controller.reset()
        XCTAssertTrue(controller.following)
    }
}
