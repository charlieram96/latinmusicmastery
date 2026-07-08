import Supabase

/// A bundle of the app's live repositories, all sharing one `ResponseCache` and one
/// `SessionUserProvider`. Built from `SupabaseService` so the feature layer never has to
/// import the Supabase SDK directly.
public struct LiveRepositories: Sendable {
    public let catalog: CatalogRepository
    public let progress: ProgressRepository
    public let entitlements: EntitlementsRepository
    public let cache: ResponseCache

    public init(
        catalog: CatalogRepository,
        progress: ProgressRepository,
        entitlements: EntitlementsRepository,
        cache: ResponseCache
    ) {
        self.catalog = catalog
        self.progress = progress
        self.entitlements = entitlements
        self.cache = cache
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
            cache: cache
        )
    }
}
