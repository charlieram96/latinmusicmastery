import Foundation

/// Row of the `courses` table.
public struct Course: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let musicalStyleId: UUID?
    public let title: String
    public let titleEs: String?
    public let slug: String
    public let description: String?
    public let descriptionEs: String?
    public let difficulty: String?
    public let instrument: String?
    public let isFundamentals: Bool
    // "Master class" is the product's own domain term (DB column `is_master_class`).
    // swiftlint:disable:next inclusive_language
    public let isMasterClass: Bool
    public let isPublished: Bool?
    public let orderIndex: Int?
    public let previewVideoUrl: String?
    public let thumbnailUrl: String?
    public let teacherId: UUID?
    public let teacherName: String?
    public let teacherBio: String?
    public let teacherImageUrl: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case musicalStyleId = "musical_style_id"
        case title
        case titleEs = "title_es"
        case slug
        case description
        case descriptionEs = "description_es"
        case difficulty
        case instrument
        case isFundamentals = "is_fundamentals"
        // swiftlint:disable:next inclusive_language
        case isMasterClass = "is_master_class"
        case isPublished = "is_published"
        case orderIndex = "order_index"
        case previewVideoUrl = "preview_video_url"
        case thumbnailUrl = "thumbnail_url"
        case teacherId = "teacher_id"
        case teacherName = "teacher_name"
        case teacherBio = "teacher_bio"
        case teacherImageUrl = "teacher_image_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
