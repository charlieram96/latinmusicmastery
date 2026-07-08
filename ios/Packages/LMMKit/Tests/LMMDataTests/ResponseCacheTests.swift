import XCTest

@testable import LMMData

/// A manually-advanced clock so TTL tests never sleep.
private final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date

    init(start: Date = Date(timeIntervalSince1970: 1_000_000)) {
        current = start
    }

    func advance(by seconds: TimeInterval) {
        lock.lock()
        current = current.addingTimeInterval(seconds)
        lock.unlock()
    }

    func now() -> Date {
        lock.lock()
        defer { lock.unlock() }
        return current
    }
}

final class ResponseCacheTests: XCTestCase {
    func testGetReturnsSetValueBeforeTTLExpires() async {
        let clock = TestClock()
        let cache = ResponseCache(now: clock.now)
        await cache.set("k", value: "v", ttl: 10)

        clock.advance(by: 9)
        let value: String? = await cache.get("k")
        XCTAssertEqual(value, "v")
    }

    func testGetReturnsNilOnceTTLExpires() async {
        let clock = TestClock()
        let cache = ResponseCache(now: clock.now)
        await cache.set("k", value: "v", ttl: 10)

        clock.advance(by: 10.001)
        let value: String? = await cache.get("k")
        XCTAssertNil(value)
    }

    func testExpiryIsExactlyAtTTLBoundary() async {
        let clock = TestClock()
        let cache = ResponseCache(now: clock.now)
        await cache.set("k", value: "v", ttl: 10)

        clock.advance(by: 10)
        let value: String? = await cache.get("k")
        XCTAssertNil(value, "an entry at exactly its expiry instant should be treated as expired")
    }

    func testGetReturnsNilForMissingKey() async {
        let cache = ResponseCache()
        let value: String? = await cache.get("missing")
        XCTAssertNil(value)
    }

    func testInvalidatePrefixOnlyClearsMatchingKeys() async {
        let cache = ResponseCache()
        await cache.set("progress:user1:course:a", value: 1, ttl: 60)
        await cache.set("progress:user1:course:b", value: 2, ttl: 60)
        await cache.set("progress:user2:course:a", value: 3, ttl: 60)

        await cache.invalidate(prefix: "progress:user1")

        let user1A: Int? = await cache.get("progress:user1:course:a")
        let user1B: Int? = await cache.get("progress:user1:course:b")
        let user2A: Int? = await cache.get("progress:user2:course:a")
        XCTAssertNil(user1A)
        XCTAssertNil(user1B)
        XCTAssertEqual(user2A, 3)
    }

    func testInvalidateAllClearsEverything() async {
        let cache = ResponseCache()
        await cache.set("key-one", value: 1, ttl: 60)
        await cache.set("key-two", value: 2, ttl: 60)

        await cache.invalidateAll()

        let keyOne: Int? = await cache.get("key-one")
        let keyTwo: Int? = await cache.get("key-two")
        XCTAssertNil(keyOne)
        XCTAssertNil(keyTwo)
    }

    func testClearOnSignOutClearsEverything() async {
        let cache = ResponseCache()
        await cache.set("entitlements:user1", value: true, ttl: 60)

        await cache.clearOnSignOut()

        let value: Bool? = await cache.get("entitlements:user1")
        XCTAssertNil(value)
    }

    func testCatalogAndProgressTTLConstantsDiffer() {
        XCTAssertEqual(ResponseCache.catalogTTL, 5 * 60)
        XCTAssertEqual(ResponseCache.progressTTL, 30)
        XCTAssertLessThan(ResponseCache.progressTTL, ResponseCache.catalogTTL)
    }
}
