import Foundation

/// Coarse-grained authentication state for the app's root routing, driven by `AuthService`
/// observing `SupabaseClient.auth.authStateChanges` for the app's whole lifetime.
public enum AuthState: Equatable, Sendable {
    /// Initial state, before the first session-restore event arrives.
    case loading
    case signedOut
    case signedIn(userId: UUID)
}
