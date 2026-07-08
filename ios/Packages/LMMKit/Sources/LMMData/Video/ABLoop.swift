import Foundation

/// Pure A–B loop state for the lesson player. Mirrors the endpoint/enable rules of the web's
/// `useVideoTransportClock` (`setLoopA`/`setLoopB`/`clearLoop` + the RAF wrap) so the two clients
/// loop identically, and so the wrap decision is unit-testable without an `AVPlayer`.
public struct ABLoop: Equatable, Sendable {
    public private(set) var pointA: TimeInterval?
    public private(set) var pointB: TimeInterval?
    public private(set) var isEnabled: Bool

    public init(pointA: TimeInterval? = nil, pointB: TimeInterval? = nil, isEnabled: Bool = false) {
        self.pointA = pointA
        self.pointB = pointB
        self.isEnabled = isEnabled
    }

    /// A loop can only run once both endpoints exist and B is strictly after A.
    public var isValid: Bool {
        guard let pointA, let pointB else { return false }
        return pointB > pointA
    }

    /// The seek target when `currentSeconds` has reached B on an enabled, valid loop — otherwise
    /// `nil`. The player seeks to this (point A) to wrap.
    public func loopTarget(currentSeconds: TimeInterval) -> TimeInterval? {
        guard isEnabled, isValid, let pointA, let pointB else { return nil }
        return currentSeconds >= pointB ? pointA : nil
    }

    /// Sets A at `seconds`; auto-enables when a valid window (A < B) now exists — matching the web.
    public mutating func setA(_ seconds: TimeInterval) {
        pointA = seconds
        if let pointB, seconds < pointB { isEnabled = true }
    }

    /// Sets B at `seconds`; auto-enables when a valid window (B > A) now exists — matching the web.
    public mutating func setB(_ seconds: TimeInterval) {
        pointB = seconds
        if let pointA, seconds > pointA { isEnabled = true }
    }

    public mutating func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }

    public mutating func clear() {
        pointA = nil
        pointB = nil
        isEnabled = false
    }
}
