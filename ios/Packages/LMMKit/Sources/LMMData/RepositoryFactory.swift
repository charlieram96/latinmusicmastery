import Supabase

/// A bundle of the app's live repositories, all sharing one `ResponseCache` and one
/// `SessionUserProvider`. Built from `SupabaseService` so the feature layer never has to
/// import the Supabase SDK directly.
public struct LiveRepositories: Sendable {
    public let catalog: CatalogRepository
    public let progress: ProgressRepository
    public let entitlements: EntitlementsRepository
    public let quiz: QuizRepository
    public let cache: ResponseCache
    public let mediaResolver: MediaURLResolver

    public init(
        catalog: CatalogRepository,
        progress: ProgressRepository,
        entitlements: EntitlementsRepository,
        quiz: QuizRepository,
        cache: ResponseCache,
        mediaResolver: MediaURLResolver = PassthroughMediaURLResolver()
    ) {
        self.catalog = catalog
        self.progress = progress
        self.entitlements = entitlements
        self.quiz = quiz
        self.cache = cache
        self.mediaResolver = mediaResolver
    }
}

public extension SupabaseService {
    /// Constructs the live repositories wired to this service's shared client.
    func makeLiveRepositories() -> LiveRepositories {
        let cache = ResponseCache()
        let session = SupabaseSessionUserProvider(client: client)
        return LiveRepositories(
            catalog: LiveCatalogRepository(client: client, sessionUserProvider: session, cache: cache),
            progress: LiveProgressRepository(client: client, sessionUserProvider: session, cache: cache),
            entitlements: LiveEntitlementsRepository(client: client, sessionUserProvider: session),
            quiz: LiveQuizRepository(client: client, cache: cache),
            cache: cache,
            mediaResolver: PassthroughMediaURLResolver()
        )
    }
}
