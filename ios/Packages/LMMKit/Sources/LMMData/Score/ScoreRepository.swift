import Foundation
import ScoreModel
import Supabase
import TimeMapKit

/// Mirrors the read paths in `app/actions/playsense-studio.ts`: `getScoreDocumentForClassItem`
/// / `fetchScorePayload`'s `score_documents` query (``scoreDocument(id:)``) and
/// `getScoreSectionsForClassItem` (``scoreSections(classItemId:)``).
public protocol ScoreRepository: Sendable {
    /// Fetch one `score_documents` row's `parsed_score`, decoded + validated as a
    /// ``ScoreDocument``. `nil` if no row has this id.
    func scoreDocument(id: UUID) async throws -> ScoreDocument?

    /// All scored sections for a VIDEO class item, ordered by `section_index`, each
    /// hydrated with its score document and (if published) active time map. Mirrors
    /// `getScoreSectionsForClassItem` — the admin-only draft time map is never fetched.
    func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection]
}

/// A ``ScoreSection`` hydrated with its full score document and (if published) active time
/// map. Mirrors `ClassItemScoreSection` (`app/actions/playsense-studio.ts`) minus
/// `draftTimeMap` (admin-only, never read by the student app) and the separate
/// `score_tracks` query — `scoreDocument.tracks` (from `parsed_score`) is already the
/// single source of truth for track metadata, so this type does not duplicate it with a
/// second table read.
public struct HydratedScoreSection: Sendable, Equatable, Identifiable {
    public let section: ScoreSection
    public let scoreDocument: ScoreDocument
    public let activeTimeMap: WaypointTimeMap?

    public var id: UUID { section.id }

    public init(section: ScoreSection, scoreDocument: ScoreDocument, activeTimeMap: WaypointTimeMap?) {
        self.section = section
        self.scoreDocument = scoreDocument
        self.activeTimeMap = activeTimeMap
    }
}

public struct LiveScoreRepository: ScoreRepository {
    private let client: SupabaseClient
    private let cache: ResponseCache?

    public init(client: SupabaseClient, cache: ResponseCache? = nil) {
        self.client = client
        self.cache = cache
    }

    public func scoreDocument(id: UUID) async throws -> ScoreDocument? {
        let key = "score_document:\(id)"
        if let cache, let cached: ScoreDocument = await cache.get(key) {
            return cached
        }

        let rows: [ScoreDocumentRow] = try await client
            .from("score_documents")
            .select("id,title,composer,parsed_score")
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value

        guard let document = rows.first?.parsedScore else { return nil }

        if let cache { await cache.set(key, value: document, ttl: ResponseCache.catalogTTL) }
        return document
    }

    public func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection] {
        let key = "score_sections:\(classItemId)"
        if let cache, let cached: [HydratedScoreSection] = await cache.get(key) {
            return cached
        }

        let sections: [ScoreSection] = try await client
            .from("class_item_score_sections")
            .select(
                "id,class_item_id,score_document_id,active_time_map_id,draft_time_map_id," +
                    "section_index,label,video_start_seconds,video_end_seconds,created_at,updated_at"
            )
            .eq("class_item_id", value: classItemId)
            .order("section_index", ascending: true)
            .execute()
            .value

        // N+1 by design, mirroring `getScoreSectionsForClassItem`'s own sequential
        // per-section fetch loop — section counts per class item are small (a handful at
        // most), so this trades a few extra round trips for a direct, obviously-correct port.
        var hydrated: [HydratedScoreSection] = []
        hydrated.reserveCapacity(sections.count)
        for section in sections {
            guard let document = try await scoreDocument(id: section.scoreDocumentId) else {
                throw RepositoryError.scoreDocumentNotFound(section.scoreDocumentId)
            }
            let activeTimeMap = try await loadTimeMap(id: section.activeTimeMapId)
            hydrated.append(
                HydratedScoreSection(section: section, scoreDocument: document, activeTimeMap: activeTimeMap)
            )
        }

        if let cache { await cache.set(key, value: hydrated, ttl: ResponseCache.catalogTTL) }
        return hydrated
    }

    /// Load one time map's header + waypoints, or `nil` when `id` is `nil` (unpublished
    /// section). Mirrors `loadTimeMap` (`app/actions/playsense-studio.ts`).
    private func loadTimeMap(id: UUID?) async throws -> WaypointTimeMap? {
        guard let id else { return nil }

        let timeMaps: [ScoreTimeMapRow] = try await client
            .from("score_time_maps")
            .select("id,method")
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        guard let timeMap = timeMaps.first else { return nil }

        let waypointRows: [ScoreTimeWaypointRow] = try await client
            .from("score_time_waypoints")
            .select("musical_position_qn,video_time_seconds,measure_number,beat_in_measure")
            .eq("time_map_id", value: id)
            .order("musical_position_qn", ascending: true)
            .execute()
            .value

        let waypoints = waypointRows.map {
            Waypoint(
                musicalPositionQN: $0.musicalPositionQN,
                videoTimeSeconds: $0.videoTimeSeconds,
                measureNumber: $0.measureNumber,
                beatInMeasure: $0.beatInMeasure
            )
        }

        return try WaypointTimeMap(id: timeMap.id.uuidString, method: timeMap.method, waypoints: waypoints)
    }
}

// File-private (not nested, to keep type nesting at one level): the narrow row shapes
// `LiveScoreRepository` decodes.

private struct ScoreDocumentRow: Decodable {
    let id: UUID
    let title: String
    let composer: String?
    let parsedScore: ScoreDocument

    enum CodingKeys: String, CodingKey {
        case id, title, composer
        case parsedScore = "parsed_score"
    }
}

private struct ScoreTimeMapRow: Decodable {
    let id: UUID
    let method: SyncMethod
}

private struct ScoreTimeWaypointRow: Decodable {
    let musicalPositionQN: Double
    let videoTimeSeconds: Double
    let measureNumber: Int?
    let beatInMeasure: Double?

    enum CodingKeys: String, CodingKey {
        case musicalPositionQN = "musical_position_qn"
        case videoTimeSeconds = "video_time_seconds"
        case measureNumber = "measure_number"
        case beatInMeasure = "beat_in_measure"
    }
}
