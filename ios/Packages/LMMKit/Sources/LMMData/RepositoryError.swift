import Foundation

/// Typed errors surfaced by `LMMData` repositories, decoupled from server-internal detail —
/// mirrors the intent of `AuthServiceError` but scoped to data-repository concerns rather than
/// the sign-in/sign-up flows.
public enum RepositoryError: LocalizedError, Equatable, Sendable {
    /// No session could be found (`AuthError.sessionMissing`) when a repository call needed the
    /// current user's id.
    case notAuthenticated

    public var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You need to be signed in to do this."
        }
    }
}
