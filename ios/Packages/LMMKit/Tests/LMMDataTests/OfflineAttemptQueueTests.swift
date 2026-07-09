import Foundation
import PlaySenseCore
import XCTest

@testable import LMMData

/// `OfflineAttemptQueue` behavior against a mock ``AttemptRepository`` (the brief's own wording
/// for this bullet) — enqueue/drain semantics, the ~50 cap with oldest-dropped, serialize/restore
/// via a real (temp-file) `AttemptQueueStore`, and (fix round 1, finding 1) the mid-batch
/// partial-failure resume matrix: an attempt insert that succeeds but whose events insert fails
/// must retry ONLY the events batch, against the SAME attempt id, on every subsequent drain — never
/// re-inserting the attempt row. A genuine network-layer failure (no mock) is separately covered by
/// `OfflineAttemptQueueNetworkFailureTests`.
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

    // MARK: - record() — fully atomic success/failure

    func testRecordSavesLiveWhenRepositorySucceeds() async {
        let repository = FakeAttemptRepository()
        let queue = OfflineAttemptQueue(repository: repository, store: FileAttemptQueueStore(fileURL: tempFile))

        let outcome = await queue.record(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .saved)
        let attemptInserts = await repository.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 1)
        let eventInserts = await repository.insertEventsCallCount
        XCTAssertEqual(eventInserts, 1)
        XCTAssertEqual(FileAttemptQueueStore(fileURL: tempFile).load(), [], "a successful save must not touch disk")
    }

    func testRecordQueuesToDiskWhenTheAttemptInsertItselfFails() async {
        let repository = FakeAttemptRepository(failure: .attemptInsert)
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let queue = OfflineAttemptQueue(repository: repository, store: store)
        let exerciseId = UUID().uuidString

        let outcome = await queue.record(exerciseId: exerciseId, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .queued)
        let pending = store.load()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.exerciseId, exerciseId)
        XCTAssertNil(
            pending.first?.persistedAttemptId,
            "the attempt row never landed — a retry must re-run BOTH steps from scratch"
        )
        let eventInserts = await repository.insertEventsCallCount
        XCTAssertEqual(eventInserts, 0, "insertEvents must never be attempted when insertAttempt itself failed")
    }

    func testMalformedExerciseIdIsDroppedRatherThanQueuedForever() async {
        let repository = FakeAttemptRepository()
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let queue = OfflineAttemptQueue(repository: repository, store: store)

        let outcome = await queue.record(exerciseId: "not-a-uuid", stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .saved, "treated as handled — nothing retriable, dropped instead of queued forever")
        XCTAssertEqual(store.load(), [])
        let attemptInserts = await repository.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 0, "the repository is never called with an unparsable id")
    }

    // MARK: - record() — mid-batch partial failure (fix round 1, finding 1)

    func testPartialFailureQueuesWithThePersistedAttemptIdAndRetryOnlyInsertsEvents() async throws {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failingEvents = FakeAttemptRepository(failure: .eventsInsert)
        let queue = OfflineAttemptQueue(repository: failingEvents, store: store)
        let exerciseId = UUID().uuidString

        let outcome = await queue.record(exerciseId: exerciseId, stats: makeStats(), events: makeEvents())

        XCTAssertEqual(outcome, .queued)
        let attemptInserts = await failingEvents.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 1, "the attempt row itself must be inserted exactly once")
        let pending = store.load()
        XCTAssertEqual(pending.count, 1)
        let persistedId = try XCTUnwrap(
            pending.first?.persistedAttemptId,
            "the successfully-inserted attempt id must be persisted to disk so a retry resumes instead of re-inserting"
        )

        // "Relaunch" with events now succeeding too — a brand-new repository/queue instance,
        // same disk store (matching the existing recovery tests' pattern).
        let recovering = FakeAttemptRepository()
        let recoveredQueue = OfflineAttemptQueue(repository: recovering, store: store)
        await recoveredQueue.drainPending()

        XCTAssertEqual(store.load(), [], "fully saved now — nothing left queued")
        let recoveredAttemptInserts = await recovering.insertAttemptCallCount
        XCTAssertEqual(recoveredAttemptInserts, 0, "a resumed retry must NOT insert a second attempt row")
        let recoveredEventInserts = await recovering.insertEventsCallCount
        XCTAssertEqual(recoveredEventInserts, 1)
        let attemptIdsUsed = await recovering.insertEventsAttemptIds
        XCTAssertEqual(attemptIdsUsed, [persistedId], "events must be retried against the SAME attempt id")
    }

    func testRepeatedEventsFailureKeepsRetryingTheSameAttemptIdWithoutDuplicatingTheAttempt() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failingEvents = FakeAttemptRepository(failure: .eventsInsert)
        let queue = OfflineAttemptQueue(repository: failingEvents, store: store)
        _ = await queue.record(exerciseId: UUID().uuidString, stats: makeStats(), events: makeEvents())
        let firstId = store.load().first?.persistedAttemptId
        XCTAssertNotNil(firstId)

        await queue.drainPending() // still failing events, same repository instance
        await queue.drainPending() // again

        let pending = store.load()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(
            pending.first?.persistedAttemptId, firstId,
            "the persisted id must not change across repeated failed retries"
        )
        let attemptInserts = await failingEvents.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 1, "still only ONE attempt row across every retry")
        let eventInserts = await failingEvents.insertEventsCallCount
        XCTAssertEqual(eventInserts, 3, "one from record() + two more drains, all against the same id")
    }

    func testDrainPendingPersistsTheAttemptIdToDiskEvenWhenEventsStillFailOnRetry() async {
        // A fully-failed queued item already on disk from an earlier "no network at all" failure —
        // no persistedAttemptId yet.
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let exerciseId = UUID().uuidString
        store.save([QueuedAttempt(exerciseId: exerciseId, stats: makeStats(), events: makeEvents(), queuedAt: Date())])

        // The network partially recovers: the attempt insert now succeeds, but events still fail.
        let partiallyRecovered = FakeAttemptRepository(failure: .eventsInsert)
        let queue = OfflineAttemptQueue(repository: partiallyRecovered, store: store)

        await queue.drainPending()

        let pending = store.load()
        XCTAssertEqual(pending.count, 1, "still queued — events insert failed")
        XCTAssertNotNil(
            pending.first?.persistedAttemptId,
            """
            even though the queued item count didn't change, the newly-inserted attempt id MUST be \
            written to disk — otherwise a crash/relaunch before the next successful drain would forget \
            it and re-insert a duplicate attempt row on the following retry
            """
        )
        let attemptInserts = await partiallyRecovered.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 1)
    }

    // MARK: - drainPending() — fully atomic success/failure

    func testDrainPendingFlushesAQueuedAttemptOnceTheRepositorySucceeds() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failing = FakeAttemptRepository(failure: .attemptInsert)
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
        let attemptInserts = await succeeding.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 1)
        let eventInserts = await succeeding.insertEventsCallCount
        XCTAssertEqual(eventInserts, 1)
    }

    func testDrainPendingLeavesStillFailingItemsQueued() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let failing = FakeAttemptRepository(failure: .attemptInsert)
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
        let attemptInserts = await repository.insertAttemptCallCount
        XCTAssertEqual(attemptInserts, 2, "one for the drained backlog item, one for the current attempt")
    }

    // MARK: - Cap (~50, oldest-dropped)

    func testQueueCapDropsOldestEntriesAndKeepsTheMostRecent() async {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let repository = FakeAttemptRepository(failure: .attemptInsert)
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
    enum Failure {
        case none
        /// `insertAttempt` itself throws — the ordinary "fully offline" case; nothing lands.
        case attemptInsert
        /// `insertAttempt` succeeds but `insertEvents` throws — the mid-batch partial failure
        /// this fix round's resume semantics target (finding 1).
        case eventsInsert
    }

    private let failure: Failure
    private(set) var insertAttemptCallCount = 0
    private(set) var insertEventsCallCount = 0
    private(set) var insertEventsAttemptIds: [UUID] = []

    init(failure: Failure = .none) {
        self.failure = failure
    }

    func insertAttempt(exerciseId: UUID, stats: AttemptStats) async throws -> UUID {
        insertAttemptCallCount += 1
        if case .attemptInsert = failure { throw URLError(.notConnectedToInternet) }
        return UUID()
    }

    func insertEvents(attemptId: UUID, events: [EventResult]) async throws {
        insertEventsCallCount += 1
        insertEventsAttemptIds.append(attemptId)
        if case .eventsInsert = failure { throw URLError(.notConnectedToInternet) }
    }

    func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt] {
        []
    }
}
