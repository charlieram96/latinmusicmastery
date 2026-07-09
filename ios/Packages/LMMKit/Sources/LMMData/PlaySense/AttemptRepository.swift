import Foundation
import PlaySenseCore
import Supabase

/// Mirrors `saveAttempt`/`getUserAttempts` (`app/actions/play-sense.ts`): persists one completed
/// PlaySense take (an insert into `play_sense_attempts`, `.select("id")` back, then a batch insert
/// into `play_sense_attempt_events`) and reads back recent attempts for one exercise.
///
/// RLS (verified against the live DB): `play_sense_attempts` restricts INSERT/SELECT to
/// `user_id = auth.uid()`; `play_sense_attempt_events` restricts both to rows whose owning attempt
/// belongs to the caller (a join back to `play_sense_attempts`). There is no UPDATE/DELETE policy
/// on either table from the client — every write here is a plain insert, matching the web (which
/// never edits or deletes an attempt either).
///
/// `pitchAccuracy` on `AttemptStats` is intentionally NOT written: the live schema has no such
/// column (verified), and the web's `saveAttempt` payload doesn't send it either — an iOS/pitched-
/// instrument-only stat with no wire representation yet.
///
/// Fix round 1 (D26 review, finding 1): the original shape was a single `saveAttempt(...)` doing
/// both inserts. `OfflineAttemptQueue` (LMMData) is what actually calls this — its retry loop needs
/// to tell the two inserts apart so a mid-batch failure (attempt row lands, events batch doesn't)
/// can resume from the events step instead of re-running the whole thing and inserting a SECOND
/// attempt row while the first sits events-less. See `OfflineAttemptQueue`'s doc comment for the
/// resume mechanics and the (now much narrower) remaining crash window.
public protocol AttemptRepository: Sendable {
    /// Insert one `play_sense_attempts` row (no events). Returns the new row's `id`. Practice-mode
    /// (unranked) takes are never passed here — that decision is made by the caller
    /// (`SessionCoordinator`), matching the web (which has no unranked concept at all).
    @discardableResult
    func insertAttempt(exerciseId: UUID, stats: AttemptStats) async throws -> UUID

    /// Insert the per-event breakdown for an attempt that already exists (its `id` from
    /// `insertAttempt`). A no-op for an empty `events` array — matches the previous combined
    /// `saveAttempt`'s behavior of skipping the batch insert entirely for a zero-event take.
    func insertEvents(attemptId: UUID, events: [EventResult]) async throws

    /// Recent attempts for one exercise, newest first, capped at `limit`. Mirrors `getUserAttempts`
    /// (the web also supports an all-exercises variant when its `exerciseId` argument is omitted;
    /// no iOS surface needs that yet, so this repository only exposes the single-exercise shape).
    func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt]
}

public struct LiveAttemptRepository: AttemptRepository {
    private let client: SupabaseClient
    private let sessionUserProvider: SessionUserProvider

    public init(client: SupabaseClient, sessionUserProvider: SessionUserProvider) {
        self.client = client
        self.sessionUserProvider = sessionUserProvider
    }

    @discardableResult
    public func insertAttempt(exerciseId: UUID, stats: AttemptStats) async throws -> UUID {
        let userId = try await sessionUserProvider.currentUserId()
        let payload = AttemptInsertRow(userId: userId, exerciseId: exerciseId, stats: stats)

        let inserted: IdRow = try await client
            .from("play_sense_attempts")
            .insert(payload)
            .select("id")
            .single()
            .execute()
            .value

        return inserted.id
    }

    public func insertEvents(attemptId: UUID, events: [EventResult]) async throws {
        guard !events.isEmpty else { return }
        let eventRows = events.map { AttemptEventInsertRow(attemptId: attemptId, event: $0) }
        _ = try await client
            .from("play_sense_attempt_events")
            .insert(eventRows)
            .execute()
    }

    public func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt] {
        let userId = try await sessionUserProvider.currentUserId()
        return try await client
            .from("play_sense_attempts")
            .select()
            .eq("user_id", value: userId)
            .eq("exercise_id", value: exerciseId)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}

/// Default for previews/tests that don't exercise attempt persistence — mirrors
/// `PassthroughMediaURLResolver`'s role for `AppServices.mediaResolver`. Never touches the
/// network; `insertAttempt` fabricates a local id, `insertEvents` no-ops, `recentAttempts`
/// returns empty.
public struct NoOpAttemptRepository: AttemptRepository {
    public init() {}

    public func insertAttempt(exerciseId: UUID, stats: AttemptStats) async throws -> UUID {
        UUID()
    }

    public func insertEvents(attemptId: UUID, events: [EventResult]) async throws {}

    public func recentAttempts(exerciseId: UUID, limit: Int) async throws -> [PlaySenseAttempt] {
        []
    }
}

// MARK: - Wire row shapes (not `private`: `AttemptRowEncodingTests`/`AttemptRowDecodingTests`
// pin these against the live DB's exact column names via `@testable import LMMData`).

/// Insert payload for `play_sense_attempts` — exact column names verified against the live DB
/// (`information_schema.columns`) and against `insertAttempt`'s insert object.
struct AttemptInsertRow: Encodable, Equatable {
    let userId: UUID
    let exerciseId: UUID
    let score: Double
    let accuracy: Double
    let perfectCount: Int
    let goodCount: Int
    let okCount: Int
    let missCount: Int
    let extraHits: Int
    let maxCombo: Int
    let maxStreak: Int
    let avgOffsetMs: Double
    let tempoDriftMs: Double
    let durationSeconds: Double

    init(userId: UUID, exerciseId: UUID, stats: AttemptStats) {
        self.userId = userId
        self.exerciseId = exerciseId
        self.score = stats.score
        self.accuracy = stats.accuracy
        self.perfectCount = stats.perfectCount
        self.goodCount = stats.goodCount
        self.okCount = stats.okCount
        self.missCount = stats.missCount
        self.extraHits = stats.extraHits
        self.maxCombo = stats.maxCombo
        self.maxStreak = stats.maxStreak
        self.avgOffsetMs = stats.avgOffsetMs
        self.tempoDriftMs = stats.tempoDriftMs
        self.durationSeconds = stats.durationSeconds
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case exerciseId = "exercise_id"
        case score
        case accuracy
        case perfectCount = "perfect_count"
        case goodCount = "good_count"
        case okCount = "ok_count"
        case missCount = "miss_count"
        case extraHits = "extra_hits"
        case maxCombo = "max_combo"
        case maxStreak = "max_streak"
        case avgOffsetMs = "avg_offset_ms"
        case tempoDriftMs = "tempo_drift_ms"
        case durationSeconds = "duration_seconds"
    }
}

/// Insert payload for one `play_sense_attempt_events` row — exact shape from `insertEvents`'s
/// `eventRows` map: `{attempt_id, event_index, grade, offset_ms, timing, onset_energy}`. The
/// richer iOS-only `EventResult` fields (pitch/technique/surface detail) have no column on this
/// table and are never sent — parity with the web's event insert object.
struct AttemptEventInsertRow: Equatable {
    let attemptId: UUID
    let eventIndex: Int
    let grade: String
    let offsetMs: Double?
    let timing: String?
    let onsetEnergy: Double?

    init(attemptId: UUID, event: EventResult) {
        self.attemptId = attemptId
        self.eventIndex = event.eventIndex
        self.grade = event.grade.rawValue
        self.offsetMs = event.offsetMs
        self.timing = event.timing?.rawValue
        self.onsetEnergy = event.onsetEnergy
    }
}

extension AttemptEventInsertRow: Encodable {
    private enum CodingKeys: String, CodingKey {
        case attemptId = "attempt_id"
        case eventIndex = "event_index"
        case grade
        case offsetMs = "offset_ms"
        case timing
        case onsetEnergy = "onset_energy"
    }

    /// Custom (not synthesized) so `offsetMs`/`timing`/`onsetEnergy` are always PRESENT on the wire
    /// as explicit JSON `null` for a miss — mirroring `EventResult`'s own custom encoder ("These
    /// three are always present on the TS wire (null for a miss)") and the web's event insert
    /// object, which never omits them either. The synthesized encoder for an `Optional` property
    /// would instead OMIT the key entirely via `encodeIfPresent`, which happens to reach the same
    /// DB result here (these columns have no default), but explicit-null is the faithful port.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(attemptId, forKey: .attemptId)
        try container.encode(eventIndex, forKey: .eventIndex)
        try container.encode(grade, forKey: .grade)
        try container.encode(offsetMs, forKey: .offsetMs)
        try container.encode(timing, forKey: .timing)
        try container.encode(onsetEnergy, forKey: .onsetEnergy)
    }
}

private struct IdRow: Decodable {
    let id: UUID
}
