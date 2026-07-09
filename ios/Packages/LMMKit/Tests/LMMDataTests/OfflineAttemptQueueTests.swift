import Foundation
import PlaySenseCore
import XCTest

@testable import LMMData

/// `OfflineAttemptQueue` behavior against a mock ``AttemptRepository`` (the brief's own wording
/// for this bullet) — enqueue/drain semantics, the ~50 cap with oldest-dropped, and serialize/
/// restore via a real (temp-file) `AttemptQueueStore`. A genuine network-layer failure (no mock)
/// is separately covered by `OfflineAttemptQueueNetworkFailureTests`.
final class OfflineAttemptQueueTests: XCTestCase {

    private var tempFile: URL!

    override func setUp() {
        super.setUp()
        tempFile = FileManager.default.temporaryDirectory
            .appendingPathComponent("offline-queue-tests-\(UUID().uuidString)")
            .appendingPathComponent("attempt_queue.json")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempFile.deletingLastPathComponent())
        tempFile = nil
        super.tearDown()
    }

    private func makeStats() -> AttemptStats {
        AttemptStats(
            score: 70, accuracy: 80, perfectCount: 1, goodCount: 1, okCount: 1, missCount: 1,
            extraHits: 0, maxCombo: 2, maxStreak: 2, avgOffsetMs: 5, tempoDriftMs: 1,
            durationSeconds: 3, pitchAccuracy: nil
        )
    }

    private func makeEvents() -> [EventResult] {
        [EventResult(eventIndex: 0, grade: .perfect, offsetMs: 5, timing: .onTime, onsetEnergy: 1)]
    }

    // MARK: - record()

    func testRecordSavesLiveWhenRepositorySucceeds() async {
        let repository = FakeAttemptRepository()
        let queue = OfflineAttemptQueue(repository: repository, store: FileAttemptQueueStore(fileURL: tempFile))

        let outcome = await queue.record(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .saved)
        let savedCount = await repository.saveCallCount
        XCTAssertEqual(savedCount, 1)
        XCTAssertEqual(FileAttemptQueueStore(fileURL: tempFile).load(), [], "a successful save must not touch disk")
    }

    func testRecordQueuesToDiskWhenRepositoryFails() async {
        let repository = FakeAttemptRepository(shouldThrow: true)
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let queue = OfflineAttemptQueue(repository: repository, store: store)
        let exerciseId = UUID().uuidString

        let outcome = await queue.record(exerciseId: exerciseId, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .queued)
        let pending = store.load()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.exerciseId, exerciseId)
    }

    func testMalformedExerciseIdIsDroppedRatherThanQueuedForever() async {
        let repository = FakeAttemptRepository()
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let queue = OfflineAttemptQueue(repository: repository, store: store)

        let outcome = await queue.record(exerciseId: "not-a-uuid", stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .saved, "treated as handled — nothing retriable, dropped instead of queued forever")
        XCTAssertEqual(store.load(), [])
        let savedCount = await repository.saveCallCount
        XCTAssertEqual(savedCount, 0, "the repository is never called with an unparsable id")
    }

    // MARK: - drainPending()

    func testDrainPendingFlushesAQueuedAttemptOnceTheRepositorySucceeds() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failing = FakeAttemptRepository(shouldThrow: true)
        let queue = OfflineAttemptQueue(repository: failing, store: store)
        let exerciseId = UUID().uuidString
        _ = await queue.record(exerciseId: exerciseId, stats: makeStats(), events: makeEvents())
        XCTAssertEqual(store.load().count, 1)

        // "Relaunch" with the network back: a NEW queue instance, same disk store, a repository
        // that now succeeds.
        let succeeding = FakeAttemptRepository()
        let recovered = OfflineAttemptQueue(repository: succeeding, store: store)
        await recovered.drainPending()

        XCTAssertEqual(store.load(), [], "the queued attempt must be gone from disk once it saves live")
        let savedCount = await succeeding.saveCallCount
        XCTAssertEqual(savedCount, 1)
    }

    func testDrainPendingLeavesStillFailingItemsQueued() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failing = FakeAttemptRepository(shouldThrow: true)
        let queue = OfflineAttemptQueue(repository: failing, store: store)
        _ = await queue.record(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents())

        await queue.drainPending() // still failing

        XCTAssertEqual(store.load().count, 1, "an item that still fails to save must remain queued")
    }

    func testRecordOpportunisticallyDrainsOlderBacklogBeforeHandlingTheCurrentAttempt() async {
        // A previous attempt got stuck on disk (simulating an earlier failed session).
        let store = FileAttemptQueueStore(fileURL: tempFile)
        store.save([
            QueuedAttempt(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents(), queuedAt: Date())
        ])

        let repository = FakeAttemptRepository() // back online now
        let queue = OfflineAttemptQueue(repository: repository, store: store)

        let outcome = await queue.record(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .saved)
        XCTAssertEqual(store.load(), [], "the stale backlog item must have drained too")
        let savedCount = await repository.saveCallCount
        XCTAssertEqual(savedCount, 2, "one for the drained backlog item, one for the current attempt")
    }

    // MARK: - Cap (~50, oldest-dropped)

    func testQueueCapDropsOldestEntriesAndKeepsTheMostRecent() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let repository = FakeAttemptRepository(shouldThrow: true)
        let queue = OfflineAttemptQueue(repository: repository, store: store)

        var exerciseIds: [String] = []
        for index in 0..<(OfflineAttemptQueue.maxQueueSize + 5) {
            let id = UUID().uuidString
            exerciseIds.append(id)
            _ = await queue.record(exerciseId: id, stats: makeStats(), events: makeEvents())
            _ = index
        }

        let pending = store.load()
        XCTAssertEqual(pending.count, OfflineAttemptQueue.maxQueueSize)
        let pendingIds = Set(pending.map(\.exerciseId))
        // The oldest 5 must be gone; the newest `maxQueueSize` must all still be present.
        for droppedId in exerciseIds.prefix(5) {
            XCTAssertFalse(pendingIds.contains(droppedId), "oldest entries must be dropped over the cap")
        }
        for keptId in exerciseIds.suffix(OfflineAttemptQueue.maxQueueSize) {
            XCTAssertTrue(pendingIds.contains(keptId), "the most recent entries must survive the cap")
        }
    }
}

// MARK: - Fakes

private actor FakeAttemptRepository: AttemptRepository {
    private let shouldThrow: Bool
    private(set) var saveCallCount = 0

    init(shouldThrow: Bool = false) {
        self.shouldThrow = shouldThrow
    }

    func saveAttempt(exerciseId: UUID, stats: AttemptStats, events: [EventResult]) async throws -> UUID {
        saveCallCount += 1
        if shouldThrow { throw URLError(.notConnectedToInternet) }
        return UUID()
    }

    func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt] {
        []
    }
}
