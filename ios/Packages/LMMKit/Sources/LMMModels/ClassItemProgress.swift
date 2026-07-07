import Foundation

/// Row of the `class_item_progress` table.
///
/// The table has `UNIQUE (user_id, class_item_id)` (verified against the live DB), so
/// repository writes should upsert on that conflict target.
public struct ClassItemProgress: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let userId: UUID
    public let classItemId: UUID
    public let completed: Bool?
    public let completedAt: Date?
    public let lastPositionSeconds: Int?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case classItemId = "class_item_id"
        case completed
        case completedAt = "completed_at"
        case lastPositionSeconds = "last_position_seconds"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
