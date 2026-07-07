import Foundation

/// Domain of `instrument_subscriptions.status`: `active | canceled | past_due | incomplete`
/// (verified against the live DB and the Stripe webhook, which normalizes Stripe's
/// `trialing` to `active`, `unpaid` to `past_due`, and everything else to `incomplete`).
///
/// Access (RLS and app gating) is granted ONLY when `status == .active`. Unknown raw
/// values decode into `.unknown` instead of throwing.
public enum SubscriptionStatus: Codable, Equatable, Hashable, Sendable {
    case active
    case canceled
    case pastDue
    case incomplete
    case unknown(String)

    public init(rawValue: String) {
        switch rawValue {
        case "active": self = .active
        case "canceled": self = .canceled
        case "past_due": self = .pastDue
        case "incomplete": self = .incomplete
        default: self = .unknown(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .active: return "active"
        case .canceled: return "canceled"
        case .pastDue: return "past_due"
        case .incomplete: return "incomplete"
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
