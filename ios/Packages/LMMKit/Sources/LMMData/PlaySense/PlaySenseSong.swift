import Foundation
import PlaySenseCore

/// A standalone, score-backed PlaySense song — one row of `play_sense_songs` (migration 027). The
/// `ScoreDocument` (via `score_document_id`) is the single source of truth for notes/tempo; this row holds
/// only the metadata the clock-agnostic score model can't carry: difficulty, which track is graded,
/// publish/order state.
public struct PlaySenseSong: Identifiable, Equatable, Sendable, Codable {
    public let id: UUID
    public let scoreDocumentId: UUID
    public let title: String
    public let difficulty: Difficulty
    public let trackIndex: Int
    public let isPublished: Bool
    public let orderIndex: Int

    public init(
        id: UUID,
        scoreDocumentId: UUID,
        title: String,
        difficulty: Difficulty,
        trackIndex: Int,
        isPublished: Bool,
        orderIndex: Int
    ) {
        self.id = id
        self.scoreDocumentId = scoreDocumentId
        self.title = title
        self.difficulty = difficulty
        self.trackIndex = trackIndex
        self.isPublished = isPublished
        self.orderIndex = orderIndex
    }

    enum CodingKeys: String, CodingKey {
        case id
        case scoreDocumentId = "score_document_id"
        case title
        case difficulty
        case trackIndex = "track_index"
        case isPublished = "is_published"
        case orderIndex = "order_index"
    }
}
