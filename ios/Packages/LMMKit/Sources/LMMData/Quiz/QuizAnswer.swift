import Foundation

/// The student's in-progress answer to one `QuizQuestion`, keyed by question id in the runner's
/// session state. One case per question-type answer shape from `lib/quiz/grading.ts`:
///
/// - `.choice` — multiple_choice / audio_choice (selected option id)
/// - `.bool` — true_false
/// - `.text` — text_answer / audio (typed string)
/// - `.blanks` — fill_in_blank (blank id -> typed text)
/// - `.pairs` — matching_pairs (left id -> chosen right text)
/// - `.ordering` — ordering_sequence (item ids in the student's current order)
/// - `.assembly` — instrument_assembly (part id -> zone id)
/// - `.none` — no answer yet (the web's `undefined`)
///
/// Codable so `QuizRunnerViewModel` can persist/restore in-progress answers within a session
/// (e.g. across a SwiftUI state restoration), matching the web's plain `Record<string, unknown>`
/// bag but as a closed, type-safe shape.
public enum QuizAnswer: Equatable, Sendable {
    case none
    case choice(String)
    case bool(Bool)
    case text(String)
    case blanks([String: String])
    case pairs([String: String])
    case ordering([String])
    case assembly([String: String])
}

extension QuizAnswer: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind
        case value
    }

    private enum Kind: String, Codable {
        case none, choice, bool, text, blanks, pairs, ordering, assembly
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .kind) {
        case .none:
            self = .none
        case .choice:
            self = .choice(try container.decode(String.self, forKey: .value))
        case .bool:
            self = .bool(try container.decode(Bool.self, forKey: .value))
        case .text:
            self = .text(try container.decode(String.self, forKey: .value))
        case .blanks:
            self = .blanks(try container.decode([String: String].self, forKey: .value))
        case .pairs:
            self = .pairs(try container.decode([String: String].self, forKey: .value))
        case .ordering:
            self = .ordering(try container.decode([String].self, forKey: .value))
        case .assembly:
            self = .assembly(try container.decode([String: String].self, forKey: .value))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .none:
            try container.encode(Kind.none, forKey: .kind)
        case .choice(let value):
            try container.encode(Kind.choice, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .bool(let value):
            try container.encode(Kind.bool, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .text(let value):
            try container.encode(Kind.text, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .blanks(let value):
            try container.encode(Kind.blanks, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .pairs(let value):
            try container.encode(Kind.pairs, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .ordering(let value):
            try container.encode(Kind.ordering, forKey: .kind)
            try container.encode(value, forKey: .value)
        case .assembly(let value):
            try container.encode(Kind.assembly, forKey: .kind)
            try container.encode(value, forKey: .value)
        }
    }
}
