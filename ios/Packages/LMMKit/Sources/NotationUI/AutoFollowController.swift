import Foundation

/// Pure state machine for the notation's auto-follow behaviour — the iOS analogue of the web
/// player's `isFollowing` / `viewMs`-vs-`currentMs` split (`playsense-studio-player.tsx`). While
/// following, the view tracks the playhead (auto-scroll / auto-translate); when the user drags the
/// notation it suspends, then resumes after an idle interval or on a seek.
///
/// Kept UIKit-free and clock-injected (events carry a monotonic `now`) so the follow/suspend
/// transitions are unit-testable without timers.
public struct AutoFollowController: Equatable, Sendable {
    /// Seconds of no interaction after a drag before auto-follow resumes (web parity ≈ 2 s).
    public static let resumeIdleSeconds: TimeInterval = 2.0

    private(set) var isFollowing: Bool
    /// Timestamp of the user's last drag interaction; `nil` while following.
    private var lastInteraction: TimeInterval?

    public init(isFollowing: Bool = true) {
        self.isFollowing = isFollowing
        self.lastInteraction = nil
    }

    /// The user began (or continued) dragging the notation at `now` — suspend following.
    public mutating func userInteracted(now: TimeInterval) {
        isFollowing = false
        lastInteraction = now
    }

    /// A seek occurred (tap-to-seek / scrubber) — re-engage following immediately (the user wants
    /// the playhead to land where they seeked, not to hold a stale view).
    public mutating func didSeek() {
        isFollowing = true
        lastInteraction = nil
    }

    /// The playback clock reached `now` — resume following if we've been idle past the threshold.
    /// Returns `true` when this tick flips suspended → following, so the caller can snap the view
    /// back onto the playhead.
    @discardableResult
    public mutating func tick(now: TimeInterval) -> Bool {
        guard !isFollowing, let last = lastInteraction else { return false }
        if now - last >= Self.resumeIdleSeconds {
            isFollowing = true
            lastInteraction = nil
            return true
        }
        return false
    }

    /// Reset to following with no pending interaction — used when the loaded section/track changes.
    public mutating func reset() {
        isFollowing = true
        lastInteraction = nil
    }

    /// Whether the view should currently track the playhead.
    public var following: Bool { isFollowing }
}
