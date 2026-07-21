import Foundation

/// Row of the `instrument_subscriptions` table (one per user + instrument; Stripe-backed).
public struct InstrumentSubscription: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let userId: UUID
    public let instrument: String
    public let billingInterval: String
    public let status: SubscriptionStatus
    public let stripeCustomerId: String?
    public let stripeBaseSubscriptionId: String?
    public let stripeAddonSubscriptionId: String?
    public let baseCurrentPeriodEnd: Date?
    public let addonCurrentPeriodEnd: Date?
    public let cancelAtPeriodEnd: Bool
    public let pendingInterval: String?
    public let createdAt: Date
    public let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case instrument
        case billingInterval = "billing_interval"
        case status
        case stripeCustomerId = "stripe_customer_id"
        case stripeBaseSubscriptionId = "stripe_base_subscription_id"
        case stripeAddonSubscriptionId = "stripe_addon_subscription_id"
        case baseCurrentPeriodEnd = "base_current_period_end"
        case addonCurrentPeriodEnd = "addon_current_period_end"
        case cancelAtPeriodEnd = "cancel_at_period_end"
        case pendingInterval = "pending_interval"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
