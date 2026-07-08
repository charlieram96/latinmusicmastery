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
    public let cache: ResponseCache

    public init(_ repositories: LiveRepositories) {
        self.catalog = repositories.catalog
        self.progress = repositories.progress
        self.entitlements = repositories.entitlements
        self.cache = repositories.cache
    }

    /// Test / preview seam — inject fakes without touching Supabase.
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
