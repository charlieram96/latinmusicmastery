import Foundation
import Supabase

/// Reads the published `play_sense_songs` catalog. Mirrors the RLS on migration 027 (authenticated read),
/// so any signed-in student sees the published list; admin-only rows (`is_published = false`) are filtered
/// out here as well as by the server.
public protocol PlaySenseSongRepository: Sendable {
    /// Published songs, ordered by `order_index`.
    func publishedSongs() async throws -> [PlaySenseSong]
}

public struct LivePlaySenseSongRepository: PlaySenseSongRepository {
    private let client: SupabaseClient
    private let cache: ResponseCache?

    public init(client: SupabaseClient, cache: ResponseCache? = nil) {
        self.client = client
        self.cache = cache
    }

    public func publishedSongs() async throws -> [PlaySenseSong] {
        let key = "play_sense_songs:published"
        if let cache, let cached: [PlaySenseSong] = await cache.get(key) {
            return cached
        }

        let songs: [PlaySenseSong] = try await client
            .from("play_sense_songs")
            .select("id,score_document_id,title,difficulty,track_index,is_published,order_index")
            .eq("is_published", value: true)
            .order("order_index", ascending: true)
            .execute()
            .value

        if let cache { await cache.set(key, value: songs, ttl: ResponseCache.catalogTTL) }
        return songs
    }
}
