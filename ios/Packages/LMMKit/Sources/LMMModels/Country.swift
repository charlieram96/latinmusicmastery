import Foundation

/// Row of the `countries` table.
public struct Country: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let nameEs: String?
    public let slug: String
    public let description: String?
    public let descriptionEs: String?
    public let imageUrl: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case nameEs = "name_es"
        case slug
        case description
        case descriptionEs = "description_es"
        case imageUrl = "image_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
