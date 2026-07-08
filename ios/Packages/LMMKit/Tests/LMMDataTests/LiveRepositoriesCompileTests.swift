import Foundation
import Supabase
import XCTest

@testable import LMMData

/// Compile-level only: proves the live repository implementations construct, conform to their
/// protocols, and link against Supabase — no network call is ever made (constructing a
/// `SupabaseClient` performs no I/O). Real integration tests against the live DB come later with
/// dedicated test users.
final class LiveRepositoriesCompileTests: XCTestCase {
    private struct FakeSessionUserProvider: SessionUserProvider {
        func currentUserId() async throws -> UUID {
            UUID()
        }
    }

    private func makeClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
    }

    func testEntitlementsRepositoryConformsToProtocol() {
        let repository: EntitlementsRepository = LiveEntitlementsRepository(
            client: makeClient(),
            sessionUserProvider: FakeSessionUserProvider()
        )
        XCTAssertNotNil(repository)
    }

    func testCatalogRepositoryConformsToProtocol() {
        let repository: CatalogRepository = LiveCatalogRepository(
            client: makeClient(),
            sessionUserProvider: FakeSessionUserProvider(),
            cache: ResponseCache()
        )
        XCTAssertNotNil(repository)
    }

    func testProgressRepositoryConformsToProtocol() {
        let repository: ProgressRepository = LiveProgressRepository(
            client: makeClient(),
            sessionUserProvider: FakeSessionUserProvider(),
            cache: ResponseCache()
        )
        XCTAssertNotNil(repository)
    }

    func testQuizRepositoryConformsToProtocol() {
        let repository: QuizRepository = LiveQuizRepository(client: makeClient(), cache: ResponseCache())
        XCTAssertNotNil(repository)
    }

    func testSupabaseSessionUserProviderConformsToProtocol() {
        let provider: SessionUserProvider = SupabaseSessionUserProvider(client: makeClient())
        XCTAssertNotNil(provider)
    }
}
