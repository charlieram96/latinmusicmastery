import Foundation

/// Row of the `user_achievements` table.
public struct UserAchievement: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let userId: UUID
    public let achievementKey: String
    public let unlockedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case achievementKey = "achievement_key"
        case unlockedAt = "unlocked_at"
    }
}
