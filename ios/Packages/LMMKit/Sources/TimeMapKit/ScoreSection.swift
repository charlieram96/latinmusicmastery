import Foundation

/// Row of `class_item_score_sections` (migrations `028_class_item_score_sections.sql` +
/// `034_section_draft_time_map.sql`).
///
/// A VIDEO class item is mostly the instructor talking, with a few stretches where they
/// demonstrate and notation should show on screen. Each such stretch is a "section": it
/// owns one `score_documents` row (1:1, like `play_sense_songs`) and points at one active
/// time map. The section's video range is derived from its published waypoints and stored
/// here for ordering, fast active-section lookup, and scrubber markers.
public struct ScoreSection: Codable, Identifiable, Equatable, Hashable, Sendable {
    public let id: UUID
    public let classItemId: UUID
    public let scoreDocumentId: UUID
    /// The last Published alignment. `nil` until first publish.
    public let activeTimeMapId: UUID?
    /// Admin-only autosaved sync draft (not yet Published). Students never read this —
    /// the studio seeds its markers from it. `LMMData.ScoreRepository` never selects it.
    public let draftTimeMapId: UUID?
    public let sectionIndex: Int
    public let label: String?
    /// Derived from the active time map's waypoints (min/max `video_time_seconds`) at
    /// publish time. `nil` until first publish.
    public let videoStartSeconds: Double?
    public let videoEndSeconds: Double?
    public let createdAt: Date?
    public let updatedAt: Date?

    public init(
        id: UUID,
        classItemId: UUID,
        scoreDocumentId: UUID,
        activeTimeMapId: UUID?,
        draftTimeMapId: UUID?,
        sectionIndex: Int,
        label: String?,
        videoStartSeconds: Double?,
        videoEndSeconds: Double?,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.classItemId = classItemId
        self.scoreDocumentId = scoreDocumentId
        self.activeTimeMapId = activeTimeMapId
        self.draftTimeMapId = draftTimeMapId
        self.sectionIndex = sectionIndex
        self.label = label
        self.videoStartSeconds = videoStartSeconds
        self.videoEndSeconds = videoEndSeconds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case classItemId = "class_item_id"
        case scoreDocumentId = "score_document_id"
        case activeTimeMapId = "active_time_map_id"
        case draftTimeMapId = "draft_time_map_id"
        case sectionIndex = "section_index"
        case label
        case videoStartSeconds = "video_start_seconds"
        case videoEndSeconds = "video_end_seconds"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
