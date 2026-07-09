import Foundation
import PlaySenseCore

/// One completed take that failed its live save and is waiting on disk for a retry. `localId`
/// exists purely for identity/debugging (e.g. counting distinct queued entries in tests) — it is
/// never sent to the server; `play_sense_attempts.id` is always server-generated.
public struct QueuedAttempt: Codable, Equatable, Sendable {
    public let localId: UUID
    public let exerciseId: String
    public let stats: AttemptStats
    public let events: [EventResult]
    public let queuedAt: Date

    public init(
        localId: UUID = UUID(),
        exerciseId: String,
        stats: AttemptStats,
        events: [EventResult],
        queuedAt: Date
    ) {
        self.localId = localId
        self.exerciseId = exerciseId
        self.stats = stats
        self.events = events
        self.queuedAt = queuedAt
    }
}

/// Disk-backed persistence for queued (failed-to-save) attempts — JSON in Application Support,
/// schema-versioned so a future field change can discard gracefully instead of crashing on decode.
/// `Sendable` so ``OfflineAttemptQueue`` (an actor) can hold one without isolation friction.
public protocol AttemptQueueStore: Sendable {
    func load() -> [QueuedAttempt]
    func save(_ items: [QueuedAttempt])
}

/// The schema-versioned envelope actually written to disk.
struct QueuedAttemptEnvelope: Codable {
    var schemaVersion: Int
    var items: [QueuedAttempt]
}

/// JSON-file-backed ``AttemptQueueStore`` — one file in Application Support
/// (`PlaySense/attempt_queue.json` by default). A missing file, a decode failure, or a
/// `schemaVersion` mismatch all resolve to an empty queue rather than throwing: this data is a
/// small, non-critical retry buffer, so "start fresh" is always safer than crashing or wedging
/// launch on a corrupt/stale file.
public struct FileAttemptQueueStore: AttemptQueueStore {
    /// Bump this — and handle the old shape in `load()` if a migration is ever needed — when the
    /// envelope or `QueuedAttempt`'s fields change incompatibly. Today an old file just gets
    /// discarded on version mismatch (see the type doc).
    public static let currentSchemaVersion = 1

    private let fileURL: URL
    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    /// Default location: `<Application Support>/PlaySense/attempt_queue.json`.
    public init(fileManager: FileManager = .default) {
        let base = fileManager
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first ?? fileManager.temporaryDirectory
        let directory = base.appendingPathComponent("PlaySense", isDirectory: true)
        self.init(fileURL: directory.appendingPathComponent("attempt_queue.json"), fileManager: fileManager)
    }

    /// Test seam: point the store at an arbitrary file (e.g. a temp directory per test) so tests
    /// never touch the real Application Support directory.
    public init(fileURL: URL, fileManager: FileManager = .default) {
        self.fileURL = fileURL
        self.fileManager = fileManager
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    public func load() -> [QueuedAttempt] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        guard
            let envelope = try? decoder.decode(QueuedAttemptEnvelope.self, from: data),
            envelope.schemaVersion == Self.currentSchemaVersion
        else { return [] }
        return envelope.items
    }

    public func save(_ items: [QueuedAttempt]) {
        let envelope = QueuedAttemptEnvelope(schemaVersion: Self.currentSchemaVersion, items: items)
        guard let data = try? encoder.encode(envelope) else { return }
        try? fileManager.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: fileURL, options: .atomic)
    }
}
