import XCTest

@testable import LMMData

/// Unit tests for ``VideoProgressTracker`` — the pure heartbeat-throttle + fire-once-completion
/// policy behind the lesson player's persistence.
final class VideoProgressTrackerTests: XCTestCase {
    func testFirstTickWritesBaselineWhenNoResumePoint() {
        var tracker = VideoProgressTracker()
        let decision = tracker.tick(currentSeconds: 3, durationSeconds: 100)
        XCTAssertEqual(decision.writePosition, 3)
        XCTAssertFalse(decision.markComplete)
    }

    func testResumePointSuppressesRedundantFirstWrite() {
        var tracker = VideoProgressTracker(resumeSecond: 40)
        // We resumed at 40; a tick at 42 hasn't advanced a full heartbeat yet.
        XCTAssertNil(tracker.tick(currentSeconds: 42, durationSeconds: 100).writePosition)
    }

    func testHeartbeatThrottlesToEveryTenSeconds() {
        var tracker = VideoProgressTracker(resumeSecond: 0)
        XCTAssertNil(tracker.tick(currentSeconds: 5, durationSeconds: 100).writePosition)
        XCTAssertEqual(tracker.tick(currentSeconds: 10, durationSeconds: 100).writePosition, 10)
        XCTAssertNil(tracker.tick(currentSeconds: 14, durationSeconds: 100).writePosition)
        XCTAssertEqual(tracker.tick(currentSeconds: 20, durationSeconds: 100).writePosition, 20)
    }

    func testFlushAlwaysWritesCurrentPositionUnlessUnchanged() {
        var tracker = VideoProgressTracker(resumeSecond: 0)
        // Not a full heartbeat, but a flush (pause) must still persist.
        XCTAssertEqual(tracker.flush(currentSeconds: 4, durationSeconds: 100).writePosition, 4)
        // A second flush at the same whole-second is a no-op write.
        XCTAssertNil(tracker.flush(currentSeconds: 4.9, durationSeconds: 100).writePosition)
    }

    func testCompletionFiresOnceAtThreshold() {
        var tracker = VideoProgressTracker(resumeSecond: 0)
        XCTAssertFalse(tracker.tick(currentSeconds: 80, durationSeconds: 100).markComplete)
        XCTAssertTrue(tracker.tick(currentSeconds: 90, durationSeconds: 100).markComplete)
        // Must not fire a second time.
        XCTAssertFalse(tracker.tick(currentSeconds: 95, durationSeconds: 100).markComplete)
    }

    func testEndFiresCompletionEvenIfThresholdNeverHit() {
        var tracker = VideoProgressTracker(resumeSecond: 0)
        // Jump straight to end (e.g. a short clip whose rounding skipped 90%).
        let decision = tracker.end(durationSeconds: 100)
        XCTAssertTrue(decision.markComplete)
        // Idempotent.
        XCTAssertFalse(tracker.end(durationSeconds: 100).markComplete)
    }

    func testUnknownDurationNeverCompletes() {
        var tracker = VideoProgressTracker(resumeSecond: 0)
        XCTAssertFalse(tracker.tick(currentSeconds: 500, durationSeconds: 0).markComplete)
    }
}
