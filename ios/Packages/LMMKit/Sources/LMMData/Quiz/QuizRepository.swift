import Foundation
import LMMModels
import Supabase

/// Mirrors `getQuizQuestions` in `app/actions/quiz.ts`.
public protocol QuizRepository: Sendable {
    /// Ordered `order_index asc` — RLS gates read access via the parent class item's course.
    func questions(classItemId: UUID) async throws -> [QuizQuestion]
}

public struct LiveQuizRepository: QuizRepository {
    private let client: SupabaseClient
    private let cache: ResponseCache?

    public init(client: SupabaseClient, cache: ResponseCache? = nil) {
        self.client = client
        self.cache = cache
    }

    public func questions(classItemId: UUID) async throws -> [QuizQuestion] {
        let key = "quiz_questions:\(classItemId)"
        if let cache, let cached: [QuizQuestion] = await cache.get(key) {
            return cached
        }

        let rows: [QuizQuestion] = try await client
            .from("quiz_questions")
            .select()
            .eq("class_item_id", value: classItemId)
            .order("order_index", ascending: true)
            .execute()
            .value

        if let cache { await cache.set(key, value: rows, ttl: ResponseCache.catalogTTL) }
        return rows
    }
}
