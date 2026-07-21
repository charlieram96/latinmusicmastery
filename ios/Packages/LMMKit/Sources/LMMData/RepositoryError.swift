import Foundation

/// Typed errors surfaced by `LMMData` repositories, decoupled from server-internal detail —
/// mirrors the intent of `AuthServiceError` but scoped to data-repository concerns rather than
/// the sign-in/sign-up flows.
public enum RepositoryError: LocalizedError, Equatable, Sendable {
    /// No session could be found (`AuthError.sessionMissing`) when a repository call needed the
    /// current user's id.
    case notAuthenticated

    /// A `class_item_score_sections` row pointed at a `score_documents.id` that no longer
    /// exists. Mirrors `getScoreSectionsForClassItem`'s fatal-abort-the-whole-fetch behavior
    /// (`app/actions/playsense-studio.ts`): a dangling foreign key should never happen, but if
    /// it does, surfacing a partial section list silently would be worse than failing loudly.
    case scoreDocumentNotFound(UUID)

    public var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You need to be signed in to do this."
        case .scoreDocumentNotFound(let id):
            return "Score document \(id) was not found."
        }
    }
}
