import Foundation

/// Row of the `quiz_questions` table (multi-question quizzes attached to a QUIZ class item).
public struct QuizQuestion: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let classItemId: UUID
    public let orderIndex: Int
    public let question: String
    public let questionEs: String?
    public let questionType: String
    public let options: QuizOptions?
    public let optionsEs: QuizOptions?
    public let correctAnswer: String?
    public let explanation: String?
    public let explanationEs: String?
    public let imageUrl: String?
    public let audioUrl: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case classItemId = "class_item_id"
        case orderIndex = "order_index"
        case question
        case questionEs = "question_es"
        case questionType = "question_type"
        case options
        case optionsEs = "options_es"
        case correctAnswer = "correct_answer"
        case explanation
        case explanationEs = "explanation_es"
        case imageUrl = "image_url"
        case audioUrl = "audio_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
