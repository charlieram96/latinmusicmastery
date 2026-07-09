import Foundation
import PlaySenseCore
import XCTest

@testable import LMMData

/// Disk round-trip + resilience coverage for ``FileAttemptQueueStore`` — each test points the store
/// at its own temp file so nothing touches the real Application Support directory.
final class FileAttemptQueueStoreTests: XCTestCase {

    private var tempFile: URL!

    override func setUp() {
        super.setUp()
        tempFile = FileManager.default.temporaryDirectory
            .appendingPathComponent("attempt-queue-tests-\(UUID().uuidString)")
            .appendingPathComponent("attempt_queue.json")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempFile.deletingLastPathComponent())
        tempFile = nil
        super.tearDown()
    }

    private func sampleAttempt(exerciseId: String = UUID().uuidString) -> QueuedAttempt {
        QueuedAttempt(
            exerciseId: exerciseId,
            stats: AttemptStats(
                score: 70, accuracy: 80, perfectCount: 1, goodCount: 1, okCount: 1, missCount: 1,
                extraHits: 0, maxCombo: 2, maxStreak: 2, avgOffsetMs: 5, tempoDriftMs: 1,
                durationSeconds: 3, pitchAccuracy: nil
            ),
            events: [EventResult(eventIndex: 0, grade: .perfect, offsetMs: 5, timing: .onTime, onsetEnergy: 1)],
            queuedAt: Date(timeIntervalSince1970: 1_750_000_000)
        )
    }

    func testLoadOnMissingFileReturnsEmpty() {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        XCTAssertEqual(store.load(), [])
    }

    func testSaveThenLoadRoundTripsExactly() {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        let items = [sampleAttempt(), sampleAttempt()]

        store.save(items)
        let reloaded = FileAttemptQueueStore(fileURL: tempFile).load()

        XCTAssertEqual(reloaded, items)
    }

    func testRoundTripSurvivesANewStoreInstance() {
        // Simulates "relaunch": a brand-new store instance (fresh process) reads what an earlier
        // instance wrote.
        let attempt = sampleAttempt(exerciseId: "11111111-1111-1111-1111-111111111111")
        FileAttemptQueueStore(fileURL: tempFile).save([attempt])

        let reloaded = FileAttemptQueueStore(fileURL: tempFile).load()

        XCTAssertEqual(reloaded.count, 1)
        XCTAssertEqual(reloaded.first?.exerciseId, "11111111-1111-1111-1111-111111111111")
    }

    func testCorruptFileLoadsAsEmptyRatherThanThrowing() throws {
        try FileManager.default.createDirectory(
            at: tempFile.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try Data("not valid json at all".utf8).write(to: tempFile)

        let store = FileAttemptQueueStore(fileURL: tempFile)
        XCTAssertEqual(store.load(), [])
    }

    func testSchemaVersionMismatchLoadsAsEmpty() throws {
        try FileManager.default.createDirectory(
            at: tempFile.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        let staleEnvelope = QueuedAttemptEnvelope(
            schemaVersion: FileAttemptQueueStore.currentSchemaVersion + 1,
            items: [sampleAttempt()]
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(staleEnvelope).write(to: tempFile)

        let store = FileAttemptQueueStore(fileURL: tempFile)
        XCTAssertEqual(store.load(), [], "a future/incompatible schema version must be discarded, not crash")
    }

    func testSaveOverwritesPreviousContents() {
        let store = FileAttemptQueueStore(fileURL: tempFile)
        store.save([sampleAttempt(), sampleAttempt()])
        store.save([sampleAttempt()])

        XCTAssertEqual(store.load().count, 1)
    }
}
