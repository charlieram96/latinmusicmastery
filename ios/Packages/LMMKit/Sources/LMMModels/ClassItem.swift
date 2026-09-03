import Foundation

/// Row of the `class_items` table — the full row, including PlaySense pass-through
/// fields (`score_document_id`, `active_time_map_id`, `exercise_*`, `bpm`,
/// `key_signature`), subtitles, and the legacy single-question quiz columns
/// (`question`, `question_type`, `options`, `correct_answer`, `explanation`).
public struct ClassItem: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let classId: UUID
    public let itemType: ClassItemType
    public let title: String
    public let titleEs: String?
    public let description: String?
    public let descriptionEs: String?
    public let orderIndex: Int
    public let richContent: JSONValue?
    public let videoUrl: String?
    public let videoDurationSeconds: Int?
    public let audioUrl: String?
    public let soundsliceEmbedUrl: String?
    /// Raw `subtitles` jsonb (array of `{lang, src}`); read it through `ClassItemSubtitle.parse`.
    public let subtitles: JSONValue?
    public let bpm: Int?
    public let keySignature: String?
    public let scoreDocumentId: UUID?
    public let activeTimeMapId: UUID?
    public let exerciseTimeMapId: UUID?
    public let exerciseVideoUrl: String?
    public let exerciseVideoStartSeconds: Double
    public let question: String?
    public let questionType: String?
    public let options: JSONValue?
    public let correctAnswer: String?
    public let explanation: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case classId = "class_id"
        case itemType = "item_type"
        case title
        case titleEs = "title_es"
        case description
        case descriptionEs = "description_es"
        case orderIndex = "order_index"
        case richContent = "rich_content"
        case videoUrl = "video_url"
        case videoDurationSeconds = "video_duration_seconds"
        case audioUrl = "audio_url"
        case soundsliceEmbedUrl = "soundslice_embed_url"
        case subtitles
        case bpm
        case keySignature = "key_signature"
        case scoreDocumentId = "score_document_id"
        case activeTimeMapId = "active_time_map_id"
        case exerciseTimeMapId = "exercise_time_map_id"
        case exerciseVideoUrl = "exercise_video_url"
        case exerciseVideoStartSeconds = "exercise_video_start_seconds"
        case question
        case questionType = "question_type"
        case options
        case correctAnswer = "correct_answer"
        case explanation
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
