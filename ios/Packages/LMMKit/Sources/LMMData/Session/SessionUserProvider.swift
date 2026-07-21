import Foundation
import Supabase

/// Supplies the current signed-in user's id to repositories, decoupled from `AuthService`'s
/// `@MainActor`, UI-oriented API — repositories only ever need the id, not the whole auth
/// surface (sign-in, sign-up, OAuth, …).
public protocol SessionUserProvider: Sendable {
    /// - Throws: `RepositoryError.notAuthenticated` when no session exists, or a transport error.
    func currentUserId() async throws -> UUID
}

/// Reads `SupabaseClient.auth.session`, which refreshes an expired access token transparently —
/// unlike `AuthService.state`, which is a cached snapshot driven by `authStateChanges` and meant
/// for UI routing, not for "give me a guaranteed-fresh id right now."
public struct SupabaseSessionUserProvider: SessionUserProvider {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func currentUserId() async throws -> UUID {
        do {
            return try await client.auth.session.user.id
        } catch AuthError.sessionMissing {
            throw RepositoryError.notAuthenticated
        }
    }
}
