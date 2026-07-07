import Foundation

/// Typed view of the `quiz_questions.options` / `options_es` jsonb column.
///
/// The shape families mirror `lib/quiz/grading.ts` exactly: `choices` (multiple_choice /
/// audio_choice), `pairs` (matching_pairs), `blanks` (fill_in_blank), `items`
/// (ordering_sequence), and `parts` + `zones` (instrument_assembly). Every field is
/// optional so any one family decodes leniently from the shared column.
public struct QuizOptions: Codable, Equatable, Sendable {
    /// Text choice (`Choice`) and audio choice (`AudioChoice`) merged: multiple_choice
    /// rows always set `text`; audio_choice rows may set `text` and/or `audioUrl`.
    public struct Choice: Codable, Equatable, Sendable {
        public let id: String?
        public let text: String?
        public let audioUrl: String?
    }

    public struct Pair: Codable, Equatable, Sendable {
        public let id: String?
        public let left: String?
        public let right: String?
    }

    public struct Blank: Codable, Equatable, Sendable {
        public let id: String?
        public let answer: String?
    }

    public struct OrderItem: Codable, Equatable, Sendable {
        public let id: String?
        public let text: String?
        public let correctPosition: Int?
    }

    public struct AssemblyZone: Codable, Equatable, Sendable {
        public let id: String?
        public let label: String?
        // swiftlint:disable identifier_name
        public let x: Double?
        public let y: Double?
        // swiftlint:enable identifier_name
        public let width: Double?
        public let height: Double?
    }

    public struct AssemblyPart: Codable, Equatable, Sendable {
        public let id: String?
        public let label: String?
        public let imageUrl: String?
        public let correctZoneId: String?
    }

    public let choices: [Choice]?
    public let pairs: [Pair]?
    public let blanks: [Blank]?
    public let items: [OrderItem]?
    public let parts: [AssemblyPart]?
    public let zones: [AssemblyZone]?
}
