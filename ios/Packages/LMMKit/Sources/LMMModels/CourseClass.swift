import Foundation

/// Row of the `classes` table (named `CourseClass` to avoid the Swift `class` keyword).
///
/// `items` is populated only by PostgREST embedded selects such as
/// `classes(*,items:class_items(*))`; plain selects leave it `nil`.
public struct CourseClass: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let sectionId: UUID
    public let title: String
    public let titleEs: String?
    public let description: String?
    public let descriptionEs: String?
    public let orderIndex: Int
    public let isFree: Bool?
    public let createdAt: Date?
    public let updatedAt: Date?
    public let items: [ClassItem]?

    enum CodingKeys: String, CodingKey {
        case id
        case sectionId = "section_id"
        case title
        case titleEs = "title_es"
        case description
        case descriptionEs = "description_es"
        case orderIndex = "order_index"
        case isFree = "is_free"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case items
    }
}
