import Foundation
import Supabase

/// Owns the single `SupabaseClient` for the app's lifetime. Construct once in `LMMApp` and
/// inject `AuthService(client:)` (which wraps it) via the SwiftUI environment.
public struct SupabaseService: Sendable {
    public let client: SupabaseClient

    public init(supabaseURL: URL, supabaseAnonKey: String) {
        client = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: supabaseAnonKey,
            options: SupabaseClientOptions(db: .init(decoder: .lmm))
        )
    }
}
