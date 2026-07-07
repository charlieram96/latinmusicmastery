import LMMLocalization
import LMMModels
import Supabase

/// Namespace anchor for the LMMData module. Supabase-backed repositories land here in later tasks.
public enum LMMDataModule {
    /// Proves the Supabase dependency resolves and links at this scaffolding stage.
    public typealias Client = SupabaseClient
}
