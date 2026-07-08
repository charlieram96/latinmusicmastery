import Foundation
import Observation
import Supabase

/// Owns the single `SupabaseClient` for the app's lifetime. Construct once in `LMMApp` and
/// inject both this and `AuthService(client:)` (which wraps the same client) via the SwiftUI
/// environment — `AuthService` via `.environment(authService)` as today, and this via
/// `.environment(supabaseService)` / `@Environment(SupabaseService.self)`, the same
/// `@Observable`-environment pattern. Task A4's repositories resolve the shared `client` here.
@Observable
public final class SupabaseService: Sendable {
    public let client: SupabaseClient

    public init(supabaseURL: URL, supabaseAnonKey: String) {
        client = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: supabaseAnonKey,
            options: SupabaseClientOptions(db: .init(decoder: .lmm))
        )
    }
}
