import LMMData
import LMMModels
import SwiftUI

/// Holds the signed-in user's entitlements and refreshes them on sign-in and app foreground.
/// Injected via the environment so any screen can ask `canAccess(_:)` without re-fetching.
///
/// Failure is intentionally quiet: a failed refresh keeps the previous entitlements rather
/// than throwing, and the default (empty) entitlements lock everything — so the safe state
/// on error is "locked", never "accidentally unlocked".
@MainActor
@Observable
public final class EntitlementsStore {
    public private(set) var entitlements: Entitlements
    public private(set) var isLoading = false

    private let repository: EntitlementsRepository

    public init(repository: EntitlementsRepository, initial: Entitlements = Entitlements()) {
        self.repository = repository
        self.entitlements = initial
    }

    /// Fetches fresh entitlements. Keeps the prior value on failure.
    public func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            entitlements = try await repository.refresh()
        } catch {
            // Keep the previous entitlements; empty-by-default already locks content.
        }
    }

    /// Resets to the locked-everything default. Called on sign-out so a second account can't
    /// inherit the first account's access.
    public func clear() {
        entitlements = Entitlements()
    }

    public func canAccess(_ course: Course) -> Bool {
        entitlements.canAccess(course)
    }
}
