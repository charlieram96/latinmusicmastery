import PlaySenseCore
import SwiftUI
import XCTest

@testable import LMMFeatures

/// D26 fix round 1, finding 2: the foreground-drain trigger used to live ONLY in
/// `StagePlayerView`'s `scenePhase` hook (`PlaySenseUI`), which never fires unless a PlaySense
/// stage happens to be the screen on screen when the app returns to foreground — foregrounding
/// from Home/Courses/My Courses/Profile silently skipped draining the offline attempt queue.
/// `RootView.handleScenePhaseChange(_:attemptSink:)` is the extracted, app-wide seam (`RootView`
/// is mounted for the app's entire lifetime); this package has no view-inspection dependency to
/// drive `scenePhase` through the real view hierarchy, so the seam is driven directly here with a
/// spy sink instead.
final class RootViewForegroundDrainTests: XCTestCase {
    func testActivePhaseDrainsTheAttemptQueue() async {
        let sink = SpyAttemptSink()

        RootView.handleScenePhaseChange(.active, attemptSink: sink)
        await settle()

        let drainCount = await sink.drainCallCount
        XCTAssertEqual(drainCount, 1, "returning to the foreground anywhere in the app must drain the queue")
    }

    func testBackgroundPhaseDoesNotDrain() async {
        let sink = SpyAttemptSink()

        RootView.handleScenePhaseChange(.background, attemptSink: sink)
        await settle()

        let drainCount = await sink.drainCallCount
        XCTAssertEqual(drainCount, 0)
    }

    func testInactivePhaseDoesNotDrain() async {
        let sink = SpyAttemptSink()

        RootView.handleScenePhaseChange(.inactive, attemptSink: sink)
        await settle()

        let drainCount = await sink.drainCallCount
        XCTAssertEqual(drainCount, 0)
    }

    // MARK: - Helpers

    /// `handleScenePhaseChange` fires an unstructured `Task` (matching `SessionCoordinator
    /// .handleForegrounding`'s existing fire-and-forget shape) — give it a few run-loop turns to
    /// land before asserting.
    private func settle() async {
        for _ in 0..<20 { await Task.yield() }
    }
}

// MARK: - Fakes

private actor SpyAttemptSink: PlaySenseAttemptSink {
    private(set) var drainCallCount = 0

    func record(exerciseId: String, stats: AttemptStats, events: [EventResult]) async -> AttemptPersistOutcome {
        .saved
    }

    func drainPending() async {
        drainCallCount += 1
    }
}
