import LMMLocalization
import LMMModels
import Supabase

/// Namespace anchor for the LMMData module.
///
/// Repositories live under `Entitlements/`, `Catalog/`, `Progress/`, and `Quiz/` — each a thin
/// protocol plus a `Live*` implementation over `SupabaseClient`/PostgREST, with all
/// aggregation/decision logic factored into pure, unit-tested functions (`Entitlements.canAccess`,
/// `CourseStructure.buildStructure`). `Cache/ResponseCache` provides a short-TTL in-memory cache
/// the live repositories read through; `Session/SessionUserProvider` decouples them from
/// `AuthService`'s `@MainActor` UI surface.
public enum LMMDataModule {
    /// Proves the Supabase dependency resolves and links at this scaffolding stage.
    public typealias Client = SupabaseClient
}
