import Foundation

/// Discriminator for `class_items.item_type`.
///
/// Unknown raw values decode into `.unknown` instead of throwing, so new item types
/// added server-side never break older app builds.
public enum ClassItemType: Codable, Equatable, Hashable, Sendable {
    case video
    case quiz
    case exercise
    case jamSession
    case unknown(String)

    public init(rawValue: String) {
        switch rawValue {
        case "VIDEO": self = .video
        case "QUIZ": self = .quiz
        case "EXERCISE": self = .exercise
        case "JAM_SESSION": self = .jamSession
        default: self = .unknown(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .video: return "VIDEO"
        case .quiz: return "QUIZ"
        case .exercise: return "EXERCISE"
        case .jamSession: return "JAM_SESSION"
        case .unknown(let rawValue): return rawValue
        }
    }

    public init(from decoder: Decoder) throws {
        self.init(rawValue: try decoder.singleValueContainer().decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}
