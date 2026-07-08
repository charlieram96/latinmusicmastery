import LMMData
import SwiftUI

/// Environment-injected container for the app's repositories and shared cache. Constructed
/// once at app launch from `SupabaseService.makeLiveRepositories()` and read by the screens
/// via `@Environment(AppServices.self)`.
///
/// It's `@Observable` purely so it can travel through the SwiftUI environment; its contents
/// don't change after construction.
@MainActor
@Observable
public final class AppServices {
    public let catalog: CatalogRepository
    public let progress: ProgressRepository
    public let entitlements: EntitlementsRepository
    public let quiz: QuizRepository
    /// Reads score documents + video-synced score sections (C18 notation).
    public let score: ScoreRepository
    public let cache: ResponseCache
    /// The seam every playback URL passes through before it reaches an `AVPlayer` (v1 is a
    /// passthrough; the signed-URL Edge Function drops in here later).
    public let mediaResolver: MediaURLResolver

    public init(_ repositories: LiveRepositories) {
        self.catalog = repositories.catalog
        self.progress = repositories.progress
        self.entitlements = repositories.entitlements
        self.quiz = repositories.quiz
        self.score = repositories.score
        self.cache = repositories.cache
        self.mediaResolver = repositories.mediaResolver
    }

    /// Test / preview seam — inject fakes without touching Supabase.
    public init(
        catalog: CatalogRepository,
        progress: ProgressRepository,
        entitlements: EntitlementsRepository,
        quiz: QuizRepository,
        score: ScoreRepository,
        cache: ResponseCache,
        mediaResolver: MediaURLResolver = PassthroughMediaURLResolver()
    ) {
        self.catalog = catalog
        self.progress = progress
        self.entitlements = entitlements
        self.quiz = quiz
        self.score = score
        self.cache = cache
        self.mediaResolver = mediaResolver
    }
}
