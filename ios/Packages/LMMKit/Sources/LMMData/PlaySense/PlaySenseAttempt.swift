import Foundation

/// A row of `play_sense_attempts` (verified against the live DB — see ``AttemptRepository``'s doc
/// comment). Read-only from the app's perspective (writes go through ``AttemptRepository/saveAttempt``,
/// which never round-trips a full row back — only the new `id`).
public struct PlaySenseAttempt: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let userId: UUID
    public let exerciseId: UUID
    public let score: Double
    public let accuracy: Double
    public let perfectCount: Int
    public let goodCount: Int
    public let okCount: Int
    public let missCount: Int
    public let extraHits: Int
    public let maxCombo: Int
    public let maxStreak: Int
    public let avgOffsetMs: Double?
    public let tempoDriftMs: Double?
    public let durationSeconds: Double?
    public let createdAt: Date?

    public init(
        id: UUID,
        userId: UUID,
        exerciseId: UUID,
        score: Double,
        accuracy: Double,
        perfectCount: Int,
        goodCount: Int,
        okCount: Int,
        missCount: Int,
        extraHits: Int,
        maxCombo: Int,
        maxStreak: Int,
        avgOffsetMs: Double?,
        tempoDriftMs: Double?,
        durationSeconds: Double?,
        createdAt: Date?
    ) {
        self.id = id
        self.userId = userId
        self.exerciseId = exerciseId
        self.score = score
        self.accuracy = accuracy
        self.perfectCount = perfectCount
        self.goodCount = goodCount
        self.okCount = okCount
        self.missCount = missCount
        self.extraHits = extraHits
        self.maxCombo = maxCombo
        self.maxStreak = maxStreak
        self.avgOffsetMs = avgOffsetMs
        self.tempoDriftMs = tempoDriftMs
        self.durationSeconds = durationSeconds
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
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
        case createdAt = "created_at"
    }
}
