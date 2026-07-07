import Foundation

/// Row of the `profiles` table (mirrors `auth.users` via trigger; `id` is the auth user id).
public struct Profile: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let email: String
    public let fullName: String?
    public let avatarUrl: String?
    public let isAdmin: Bool?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case avatarUrl = "avatar_url"
        case isAdmin = "is_admin"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
