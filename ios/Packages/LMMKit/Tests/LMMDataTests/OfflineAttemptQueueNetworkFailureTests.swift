import Foundation
import PlaySenseCore
import Supabase
import XCTest

@testable import LMMData

/// The brief's "kill network" bullet, done with a REAL network-layer failure rather than a mock
/// throw: a genuine `SupabaseClient` pointed at a black-hole host (`http://127.0.0.1:1` —
/// port 1 refuses connections instantly on every platform this runs on) drives
/// `LiveAttemptRepository.insertAttempt` to actually fail via `URLSession`, proving
/// `OfflineAttemptQueue` serializes to disk on a REAL failure, not just a hand-rolled throw. No
/// live credentials are needed for this half — `insertAttempt` fails before auth would ever matter.
/// Recovery ("relaunch with the network back") is then simulated by swapping in a fake
/// (deterministic, no real 2nd network round trip needed to prove the drain mechanics) repository
/// against the SAME on-disk queue, matching `OfflineAttemptQueueTests`'s existing recovery test.
final class OfflineAttemptQueueNetworkFailureTests: XCTestCase {

    private var tempFile: URL!

    override func setUp() {
        super.setUp()
        tempFile = FileManager.default.temporaryDirectory
            .appendingPathComponent("attempt-queue-network-\(UUID().uuidString)")
            .appendingPathComponent("attempt_queue.json")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempFile.deletingLastPathComponent())
        tempFile = nil
        super.tearDown()
    }

    private struct FixedSessionUserProvider: SessionUserProvider {
        let userId: UUID
        func currentUserId() async throws -> UUID { userId }
    }

    func testARealNetworkFailureQueuesToDiskAndLaterDrains() async throws {
        // A black-hole client: nothing is listening on 127.0.0.1:1, so every request fails fast
        // with a real `URLError` (connection refused) — a genuine "no network" condition, not a
        // simulated one.
        let blackHoleClient = SupabaseClient(
            supabaseURL: URL(string: "http://127.0.0.1:1")!,
            supabaseKey: "test-anon-key"
        )
        let deadRepository = LiveAttemptRepository(
            client: blackHoleClient,
            sessionUserProvider: FixedSessionUserProvider(userId: UUID())
        )
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let queue = OfflineAttemptQueue(repository: deadRepository, store: store)
        let exerciseId = UUID().uuidString
        let stats = AttemptStats(
            score: 55, accuracy: 60, perfectCount: 1, goodCount: 0, okCount: 1, missCount: 2,
            extraHits: 0, maxCombo: 1, maxStreak: 1, avgOffsetMs: 20, tempoDriftMs: 4,
            durationSeconds: 5, pitchAccuracy: nil
        )
        let events = [EventResult(eventIndex: 0, grade: .ok, offsetMs: 20, timing: .late, onsetEnergy: 0.5)]

        let outcome = await queue.record(exerciseId: exerciseId, stats: stats, events: events)

        XCTAssertEqual(outcome, .queued, "a real connection-refused failure must queue, not crash or silently drop")
        let pending = store.load()
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.exerciseId, exerciseId)
        XCTAssertEqual(pending.first?.stats, stats)
        XCTAssertEqual(pending.first?.events, events)
        XCTAssertNil(
            pending.first?.persistedAttemptId,
            "the attempt insert itself failed (connection refused) — nothing landed, so a retry must " +
            "re-run both steps from scratch, not resume from a persisted id"
        )

        // "The network comes back" (and, separately, a relaunch: a brand-new queue instance reads
        // the same on-disk file) — recovery mechanics are exercised with a fast fake so this test
        // doesn't depend on a second real network round trip to prove `drainPending()` works.
        let recoveredRepository = RecordingAttemptRepository()
        let recoveredQueue = OfflineAttemptQueue(repository: recoveredRepository, store: store)
        await recoveredQueue.drainPending()

        XCTAssertEqual(store.load(), [], "the queued attempt must drain once the network is back")
        let saved = await recoveredRepository.savedExerciseIds
        XCTAssertEqual(saved, [exerciseId])
    }
}

private actor RecordingAttemptRepository: AttemptRepository {
    private(set) var savedExerciseIds: [String] = []

    private var exerciseIdByAttemptId: [UUID: String] = [:]

    func insertAttempt(exerciseId: UUID, stats: AttemptStats) async throws -> UUID {
        let attemptId = UUID()
        exerciseIdByAttemptId[attemptId] = exerciseId.uuidString
        return attemptId
    }

    func insertEvents(attemptId: UUID, events: [EventResult]) async throws {
        if let exerciseId = exerciseIdByAttemptId[attemptId] {
            savedExerciseIds.append(exerciseId)
        }
    }

    func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt] {
        []
    }
}
