import Foundation
import Supabase

/// Refreshes ``Entitlements`` from Supabase. Always hits the network — entitlements are the
/// access-control source of truth, so this repository never reads or writes ``ResponseCache``.
public protocol EntitlementsRepository: Sendable {
    func refresh() async throws -> Entitlements
}

/// Three queries, mirroring the brief exactly:
///   - `instrument_subscriptions?select=instrument&user_id=eq.<me>&status=eq.active`
///   - `subscription_courses?select=course_id,instrument_subscriptions!inner(status)`
///     `&user_id=eq.<me>&instrument_subscriptions.status=eq.active`
///   - `profiles?select=is_admin&id=eq.<me>`
public struct LiveEntitlementsRepository: EntitlementsRepository {
    private let client: SupabaseClient
    private let sessionUserProvider: SessionUserProvider

    public init(client: SupabaseClient, sessionUserProvider: SessionUserProvider) {
        self.client = client
        self.sessionUserProvider = sessionUserProvider
    }

    public func refresh() async throws -> Entitlements {
        let userId = try await sessionUserProvider.currentUserId()

        async let instrumentRowsTask: [InstrumentRow] = client
            .from("instrument_subscriptions")
            .select("instrument")
            .eq("user_id", value: userId)
            .eq("status", value: "active")
            .execute()
            .value

        async let unlockedRowsTask: [CourseIdRow] = client
            .from("subscription_courses")
            .select("course_id,instrument_subscriptions!inner(status)")
            .eq("user_id", value: userId)
            .eq("instrument_subscriptions.status", value: "active")
            .execute()
            .value

        async let profileRowsTask: [IsAdminRow] = client
            .from("profiles")
            .select("is_admin")
            .eq("id", value: userId)
            .execute()
            .value

        let (instrumentRows, unlockedRows, profileRows) = try await (
            instrumentRowsTask, unlockedRowsTask, profileRowsTask
        )

        return Entitlements(
            activeInstruments: Set(instrumentRows.map(\.instrument)),
            unlockedCourseIds: Set(unlockedRows.map(\.courseId)),
            isAdmin: profileRows.first?.isAdmin ?? false
        )
    }
}

// File-private (not nested, to keep type nesting at one level): the three narrow row shapes
// `LiveEntitlementsRepository.refresh()` decodes.

private struct InstrumentRow: Decodable {
    let instrument: String
}

private struct CourseIdRow: Decodable {
    let courseId: UUID

    enum CodingKeys: String, CodingKey {
        case courseId = "course_id"
    }
}

private struct IsAdminRow: Decodable {
    let isAdmin: Bool?

    enum CodingKeys: String, CodingKey {
        case isAdmin = "is_admin"
    }
}
