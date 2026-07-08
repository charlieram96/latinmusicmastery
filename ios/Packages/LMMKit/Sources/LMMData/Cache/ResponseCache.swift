import Foundation

/// A tiny in-memory, per-process response cache for repository reads. No disk persistence, no
/// LRU eviction — entries simply expire after their TTL, checked lazily on ``get(_:as:)`` against
/// an injectable clock so tests never need to sleep.
///
/// Cache keys for anything user-scoped (progress, course structure, enrollments, achievements)
/// must embed the user id, so a fast account switch never serves one user's cached data to
/// another. ``EntitlementsRepository/refresh()`` never reads or writes this cache at all — access
/// decisions always hit the network.
public actor ResponseCache {
    /// Catalog reads (countries, styles, published courses, course detail) rarely change.
    public static let catalogTTL: TimeInterval = 5 * 60
    /// Progress-shaped reads (course structure, enrollments, achievements) change often — a
    /// short TTL so a just-completed item shows up promptly on the next fetch.
    public static let progressTTL: TimeInterval = 30

    private struct Entry {
        let value: any Sendable
        let expiresAt: Date
    }

    private var storage: [String: Entry] = [:]
    private let now: @Sendable () -> Date

    public init(now: @escaping @Sendable () -> Date = Date.init) {
        self.now = now
    }

    /// Returns the cached value for `key` if present and not yet expired, else `nil`. A stale
    /// entry is evicted as a side effect of being observed expired.
    public func get<T: Sendable>(_ key: String, as type: T.Type = T.self) -> T? {
        guard let entry = storage[key] else { return nil }
        guard entry.expiresAt > now() else {
            storage.removeValue(forKey: key)
            return nil
        }
        return entry.value as? T
    }

    public func set<T: Sendable>(_ key: String, value: T, ttl: TimeInterval) {
        storage[key] = Entry(value: value, expiresAt: now().addingTimeInterval(ttl))
    }

    /// Clears every key with the given prefix — e.g. every cache entry for one user's progress
    /// after a write, without touching another user's or catalog-wide entries.
    public func invalidate(prefix: String) {
        storage = storage.filter { !$0.key.hasPrefix(prefix) }
    }

    public func invalidateAll() {
        storage.removeAll()
    }

    /// Call from the sign-out flow (wired in a later task) so no cached data from the previous
    /// session can leak into the next one, even if a key was ever built without its user id.
    public func clearOnSignOut() {
        invalidateAll()
    }
}
