import Foundation
import LMMModels
import Supabase

public protocol CatalogRepository: Sendable {
    func countries() async throws -> [Country]
    func musicalStyles() async throws -> [MusicalStyle]
    func publishedCourses() async throws -> [Course]
    func courseDetail(id: UUID) async throws -> Course?
    /// The two-query pattern from `getCourseStructureForStudent`: an embedded
    /// `course_sections?select=*,classes(*,items:class_items(*))` fetch, then the current user's
    /// `class_item_progress` rows for exactly those item ids, reduced by the pure
    /// ``CourseStructure/buildStructure(sections:progress:)``.
    func courseStructure(courseId: UUID) async throws -> CourseStructure
}

public struct LiveCatalogRepository: CatalogRepository {
    private let client: SupabaseClient
    private let sessionUserProvider: SessionUserProvider
    private let cache: ResponseCache?

    public init(
        client: SupabaseClient,
        sessionUserProvider: SessionUserProvider,
        cache: ResponseCache? = nil
    ) {
        self.client = client
        self.sessionUserProvider = sessionUserProvider
        self.cache = cache
    }

    public func countries() async throws -> [Country] {
        try await cached(key: "countries", ttl: ResponseCache.catalogTTL) {
            try await client.from("countries").select().execute().value
        }
    }

    public func musicalStyles() async throws -> [MusicalStyle] {
        try await cached(key: "musical_styles", ttl: ResponseCache.catalogTTL) {
            try await client.from("musical_styles").select().execute().value
        }
    }

    public func publishedCourses() async throws -> [Course] {
        try await cached(key: "published_courses", ttl: ResponseCache.catalogTTL) {
            try await client
                .from("courses")
                .select()
                .eq("is_published", value: true)
                .execute()
                .value
        }
    }

    public func courseDetail(id: UUID) async throws -> Course? {
        let key = "course_detail:\(id)"
        if let cache, let cached: Course = await cache.get(key) {
            return cached
        }

        let rows: [Course] = try await client
            .from("courses")
            .select()
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        guard let course = rows.first else { return nil }

        if let cache { await cache.set(key, value: course, ttl: ResponseCache.catalogTTL) }
        return course
    }

    public func courseStructure(courseId: UUID) async throws -> CourseStructure {
        let userId = try await sessionUserProvider.currentUserId()
        // Embeds the user id: this is progress-shaped data, not pure catalog content.
        let key = "course_structure:\(userId):\(courseId)"
        if let cache, let cached: CourseStructure = await cache.get(key) {
            return cached
        }

        let sections: [CourseSection] = try await client
            .from("course_sections")
            .select("*,classes(*,items:class_items(*))")
            .eq("course_id", value: courseId)
            .order("order_index")
            .execute()
            .value

        let itemIds = sections.flatMap { section in
            (section.classes ?? []).flatMap { courseClass in
                (courseClass.items ?? []).map(\.id)
            }
        }

        var progress: [ClassItemProgress] = []
        if !itemIds.isEmpty {
            progress = try await client
                .from("class_item_progress")
                .select()
                .eq("user_id", value: userId)
                .in("class_item_id", values: itemIds)
                .execute()
                .value
        }

        let structure = CourseStructure.buildStructure(sections: sections, progress: progress)
        // Short TTL: this bundles progress, so it must go stale quickly (see ResponseCache.progressTTL).
        if let cache { await cache.set(key, value: structure, ttl: ResponseCache.progressTTL) }
        return structure
    }

    private func cached<T: Sendable>(
        key: String,
        ttl: TimeInterval,
        fetch: () async throws -> T
    ) async throws -> T {
        if let cache, let cachedValue: T = await cache.get(key) {
            return cachedValue
        }
        let value = try await fetch()
        if let cache { await cache.set(key, value: value, ttl: ttl) }
        return value
    }
}
