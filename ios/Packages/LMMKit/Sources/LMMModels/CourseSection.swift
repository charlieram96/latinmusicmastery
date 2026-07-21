import Foundation

/// Row of the `course_sections` table.
///
/// `classes` is populated only by PostgREST embedded selects such as
/// `course_sections?select=*,classes(*,items:class_items(*))`; plain selects leave it `nil`.
public struct CourseSection: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let courseId: UUID
    public let title: String
    public let titleEs: String?
    public let description: String?
    public let descriptionEs: String?
    public let orderIndex: Int
    public let createdAt: Date?
    public let updatedAt: Date?
    public let classes: [CourseClass]?

    enum CodingKeys: String, CodingKey {
        case id
        case courseId = "course_id"
        case title
        case titleEs = "title_es"
        case description
        case descriptionEs = "description_es"
        case orderIndex = "order_index"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case classes
    }
}
