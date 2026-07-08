import Foundation
import Supabase

/// Typed, user-presentable errors surfaced by `AuthService`. Wraps supabase-swift's `AuthError`
/// (and transport failures) so views can show a clean message without inspecting server-internal
/// detail — and so an unrecognized case never crashes, it just falls back to `.unknown`.
///
/// Named `AuthServiceError` (not `AuthError`) because `import Supabase` already re-exports the
/// SDK's own `Auth.AuthError` into this module's namespace; a same-named local type would shadow
/// it and make the SDK's cases unreachable by their plain name.
public enum AuthServiceError: LocalizedError, Equatable, Sendable {
    case invalidCredentials
    case emailNotConfirmed
    case emailAlreadyInUse
    case weakPassword(reasons: [String])
    case network
    case appleSignInFailed
    case unknown(message: String)

    public var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Incorrect email or password."
        case .emailNotConfirmed:
            return "Please confirm your email before signing in — check your inbox for the confirmation link."
        case .emailAlreadyInUse:
            return "An account with this email already exists."
        case .weakPassword(let reasons):
            guard !reasons.isEmpty else {
                return "That password is too weak. Please choose a stronger one."
            }
            return "That password is too weak: \(reasons.joined(separator: ", "))."
        case .network:
            return "Couldn't reach the server. Check your connection and try again."
        case .appleSignInFailed:
            return "Sign in with Apple failed. Please try again."
        case .unknown(let message):
            return message
        }
    }

    /// Maps a thrown error (typically supabase-swift's `AuthError`) to a typed case. Falls back
    /// to `.network` for transport-level failures and `.unknown` for anything unrecognized.
    static func map(_ error: Error) -> AuthServiceError {
        if let authError = error as? AuthError {
            switch authError {
            case .weakPassword(_, let reasons):
                return .weakPassword(reasons: reasons)
            case .api(let message, let errorCode, _, _):
                switch errorCode {
                case .invalidCredentials:
                    return .invalidCredentials
                case .emailNotConfirmed:
                    return .emailNotConfirmed
                case .emailExists, .userAlreadyExists:
                    return .emailAlreadyInUse
                default:
                    return .unknown(message: message)
                }
            default:
                return .unknown(message: authError.message)
            }
        }

        if (error as NSError).domain == NSURLErrorDomain {
            return .network
        }

        return .unknown(message: error.localizedDescription)
    }
}
