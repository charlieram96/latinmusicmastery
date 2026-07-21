import Foundation

/// Row of the `subscription_courses` table (courses granted by an instrument subscription).
public struct SubscriptionCourse: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let instrumentSubscriptionId: UUID
    public let userId: UUID
    public let courseId: UUID
    public let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case instrumentSubscriptionId = "instrument_subscription_id"
        case userId = "user_id"
        case courseId = "course_id"
        case createdAt = "created_at"
    }
}
