import Foundation
import LMMModels
import Supabase

public protocol ProgressRepository: Sendable {
    /// Mirrors `markClassItemComplete`: sets `completed = true` and stamps `completed_at`.
    /// Leaves `last_position_seconds` untouched.
    func markComplete(itemId: UUID) async throws
    /// Mirrors `updateClassItemPosition`: writes `last_position_seconds` only. Never clears
    /// `completed` — an upsert that omits a column never touches it on conflict.
    func updatePosition(itemId: UUID, seconds: Int) async throws
    /// Mirrors `enrollInCourse`: inserts a `course_enrollments` row, or touches
    /// `last_accessed_at`/`updated_at` on the existing one.
    func enroll(courseId: UUID) async throws
    func myEnrollments() async throws -> [CourseEnrollment]
    func achievements() async throws -> [UserAchievement]
}

public struct LiveProgressRepository: ProgressRepository {
    private let client: SupabaseClient
    private let sessionUserProvider: SessionUserProvider
    private let cache: ResponseCache?
    private let now: @Sendable () -> Date

    /// The `class_item_progress` unique constraint this repository upserts against — verified
    /// against the live DB (see `ClassItemProgress`'s doc comment).
    private static let progressConflictTarget = "user_id,class_item_id"

    public init(
        client: SupabaseClient,
        sessionUserProvider: SessionUserProvider,
        cache: ResponseCache? = nil,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.client = client
        self.sessionUserProvider = sessionUserProvider
        self.cache = cache
        self.now = now
    }

    public func markComplete(itemId: UUID) async throws {
        let userId = try await sessionUserProvider.currentUserId()
        let payload = MarkCompletePayload(
            userId: userId,
            classItemId: itemId,
            completed: true,
            completedAt: now()
        )
        _ = try await client
            .from("class_item_progress")
            .upsert(payload, onConflict: Self.progressConflictTarget)
            .execute()

        if let cache { await cache.invalidate(prefix: "course_structure:\(userId)") }
    }

    public func updatePosition(itemId: UUID, seconds: Int) async throws {
        let userId = try await sessionUserProvider.currentUserId()
        let payload = UpdatePositionPayload(userId: userId, classItemId: itemId, lastPositionSeconds: seconds)
        _ = try await client
            .from("class_item_progress")
            .upsert(payload, onConflict: Self.progressConflictTarget)
            .execute()

        if let cache { await cache.invalidate(prefix: "course_structure:\(userId)") }
    }

    public func enroll(courseId: UUID) async throws {
        let userId = try await sessionUserProvider.currentUserId()

        let existing: [IdRow] = try await client
            .from("course_enrollments")
            .select("id")
            .eq("user_id", value: userId)
            .eq("course_id", value: courseId)
            .limit(1)
            .execute()
            .value

        if let row = existing.first {
            _ = try await client
                .from("course_enrollments")
                .update(TouchEnrollmentPayload(lastAccessedAt: now(), updatedAt: now()))
                .eq("id", value: row.id)
                .execute()
        } else {
            _ = try await client
                .from("course_enrollments")
                .insert(NewEnrollmentPayload(userId: userId, courseId: courseId))
                .execute()
        }

        if let cache { await cache.invalidate(prefix: "enrollments:\(userId)") }
    }

    public func myEnrollments() async throws -> [CourseEnrollment] {
        let userId = try await sessionUserProvider.currentUserId()
        let key = "enrollments:\(userId)"
        if let cache, let cached: [CourseEnrollment] = await cache.get(key) {
            return cached
        }

        let rows: [CourseEnrollment] = try await client
            .from("course_enrollments")
            .select()
            .eq("user_id", value: userId)
            .execute()
            .value

        if let cache { await cache.set(key, value: rows, ttl: ResponseCache.progressTTL) }
        return rows
    }

    public func achievements() async throws -> [UserAchievement] {
        let userId = try await sessionUserProvider.currentUserId()
        // Unlike `enrollments:`, this cache key has no write-triggered `invalidate(prefix:)` call
        // anywhere — there's no client write path to `user_achievements` (rows only ever appear
        // via a server-side trigger), so a fresh unlock is picked up purely by `progressTTL`
        // expiry. Revisit if achievements ever gain a client-initiated write/unlock flow.
        let key = "achievements:\(userId)"
        if let cache, let cached: [UserAchievement] = await cache.get(key) {
            return cached
        }

        let rows: [UserAchievement] = try await client
            .from("user_achievements")
            .select()
            .eq("user_id", value: userId)
            .execute()
            .value

        if let cache { await cache.set(key, value: rows, ttl: ResponseCache.progressTTL) }
        return rows
    }
}

// File-private (not nested, to keep type nesting at one level): the small Encodable/Decodable
// payload and row shapes `LiveProgressRepository` reads and writes.

private struct MarkCompletePayload: Encodable {
    let userId: UUID
    let classItemId: UUID
    let completed: Bool
    let completedAt: Date

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case classItemId = "class_item_id"
        case completed
        case completedAt = "completed_at"
    }
}

private struct UpdatePositionPayload: Encodable {
    let userId: UUID
    let classItemId: UUID
    let lastPositionSeconds: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case classItemId = "class_item_id"
        case lastPositionSeconds = "last_position_seconds"
    }
}

private struct NewEnrollmentPayload: Encodable {
    let userId: UUID
    let courseId: UUID

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case courseId = "course_id"
    }
}

private struct TouchEnrollmentPayload: Encodable {
    let lastAccessedAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case lastAccessedAt = "last_accessed_at"
        case updatedAt = "updated_at"
    }
}

private struct IdRow: Decodable {
    let id: UUID
}
