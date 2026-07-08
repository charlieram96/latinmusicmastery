import AuthenticationServices
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
    /// The user dismissed the sign-in sheet themselves (Google's `ASWebAuthenticationSession`,
    /// or a future OAuth provider using the same presentation). Callers should treat this as a
    /// silent no-op, the same way an Apple-cancel is already handled — never shown as an error.
    case cancelled
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
        case .cancelled:
            return "Sign-in was cancelled."
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

        let nsError = error as NSError

        // Cancelling the `ASWebAuthenticationSession` sheet (e.g. Google sign-in) surfaces as
        // this system error rather than anything from `AuthError` above — map it to `.cancelled`
        // so callers can treat it as a silent no-op instead of a real failure.
        if nsError.domain == ASWebAuthenticationSessionErrorDomain,
           nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
            return .cancelled
        }

        if nsError.domain == NSURLErrorDomain {
            return .network
        }

        return .unknown(message: error.localizedDescription)
    }
}
