import Foundation

/// Row of the `course_enrollments` table.
public struct CourseEnrollment: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let userId: UUID
    public let courseId: UUID
    public let enrolledAt: Date?
    public let lastAccessedAt: Date?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case courseId = "course_id"
        case enrolledAt = "enrolled_at"
        case lastAccessedAt = "last_accessed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
