import XCTest

@testable import LMMData
@testable import LMMFeatures
@testable import LMMModels

/// A repository whose `refresh()` returns a scripted result — no network, so the store's
/// refresh/keep/clear semantics can be pinned down deterministically.
private struct ScriptedEntitlementsRepository: EntitlementsRepository {
    let result: Result<Entitlements, Error>
    func refresh() async throws -> Entitlements {
        try result.get()
    }
}

private enum ScriptedError: Error { case boom }

@MainActor
final class EntitlementsStoreTests: XCTestCase {
    func testStartsEmptyByDefault() {
        let store = EntitlementsStore(
            repository: ScriptedEntitlementsRepository(result: .success(Entitlements()))
        )
        XCTAssertEqual(store.entitlements, Entitlements())
    }

    func testRefreshSuccessAdoptsFetchedEntitlements() async {
        let fetched = Entitlements(activeInstruments: ["bass"], unlockedCourseIds: [UUID()], isAdmin: false)
        let store = EntitlementsStore(repository: ScriptedEntitlementsRepository(result: .success(fetched)))

        await store.refresh()

        XCTAssertEqual(store.entitlements, fetched)
        XCTAssertFalse(store.isLoading)
    }

    func testRefreshFailureKeepsPreviousEntitlements() async {
        let seeded = Entitlements(activeInstruments: ["congas"])
        let store = EntitlementsStore(
            repository: ScriptedEntitlementsRepository(result: .failure(ScriptedError.boom)),
            initial: seeded
        )

        await store.refresh()

        // A failed refresh must never widen or clear access — the prior value stands.
        XCTAssertEqual(store.entitlements, seeded)
        XCTAssertFalse(store.isLoading)
    }

    func testClearResetsToLockedEverythingDefault() async {
        let fetched = Entitlements(activeInstruments: ["bass"], isAdmin: true)
        let store = EntitlementsStore(repository: ScriptedEntitlementsRepository(result: .success(fetched)))
        await store.refresh()
        XCTAssertEqual(store.entitlements, fetched)

        store.clear()

        XCTAssertEqual(store.entitlements, Entitlements())
    }
}
