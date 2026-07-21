import Foundation

/// Row of the `musical_styles` table.
public struct MusicalStyle: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let countryId: UUID
    public let name: String
    public let nameEs: String?
    public let slug: String
    public let description: String?
    public let descriptionEs: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case countryId = "country_id"
        case name
        case nameEs = "name_es"
        case slug
        case description
        case descriptionEs = "description_es"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
