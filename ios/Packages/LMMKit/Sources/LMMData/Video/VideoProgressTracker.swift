import Foundation

/// What a progress event decided: an optional position to persist, and whether the item just
/// crossed into "complete".
public struct VideoProgressDecision: Equatable, Sendable {
    /// The whole-second position to persist, or `nil` when this event shouldn't write.
    public var writePosition: Int?
    /// `true` only on the single event that crosses the completion threshold (or reaches the end).
    public var markComplete: Bool

    public init(writePosition: Int? = nil, markComplete: Bool = false) {
        self.writePosition = writePosition
        self.markComplete = markComplete
    }

    static let none = VideoProgressDecision()
}

/// The pure decision core for the lesson player's persistence: it throttles position heartbeats
/// and fires completion exactly once, given only `(currentSeconds, durationSeconds)` events. The
/// player owns the `AVPlayer`; this owns *when* to write, so the policy is unit-testable without
/// any playback.
///
/// - Heartbeat: a periodic ``tick(currentSeconds:durationSeconds:)`` persists only after the
///   position has moved at least `heartbeatSeconds` from the last write.
/// - Flush: ``flush(currentSeconds:durationSeconds:)`` (pause / disappear / background) always
///   persists the current position.
/// - Completion: fires once at `completionThreshold` of the duration, or on ``end(durationSeconds:)``.
public struct VideoProgressTracker: Equatable, Sendable {
    public let heartbeatSeconds: Double
    public let completionThreshold: Double
    private var lastWrittenSecond: Int?
    private var didComplete: Bool

    public init(
        heartbeatSeconds: Double = 10,
        completionThreshold: Double = 0.9,
        resumeSecond: Int? = nil,
        alreadyComplete: Bool = false
    ) {
        self.heartbeatSeconds = heartbeatSeconds
        self.completionThreshold = completionThreshold
        // Seeding the last-written baseline with the resume point stops the first heartbeat from
        // redundantly re-writing the position we just resumed from.
        self.lastWrittenSecond = resumeSecond
        self.didComplete = alreadyComplete
    }

    /// Periodic while-playing event. Writes when the position advanced past the heartbeat window.
    public mutating func tick(currentSeconds: Double, durationSeconds: Double) -> VideoProgressDecision {
        var decision = completionCheck(currentSeconds: currentSeconds, durationSeconds: durationSeconds)
        let current = wholeSecond(currentSeconds)
        if let last = lastWrittenSecond {
            if abs(current - last) >= Int(heartbeatSeconds.rounded()) {
                lastWrittenSecond = current
                decision.writePosition = current
            }
        } else {
            lastWrittenSecond = current
            decision.writePosition = current
        }
        return decision
    }

    /// Forced write (pause, view disappear, app background). Persists the current position unless
    /// it's unchanged from the last write.
    public mutating func flush(currentSeconds: Double, durationSeconds: Double) -> VideoProgressDecision {
        var decision = completionCheck(currentSeconds: currentSeconds, durationSeconds: durationSeconds)
        let current = wholeSecond(currentSeconds)
        if current != lastWrittenSecond {
            lastWrittenSecond = current
            decision.writePosition = current
        }
        return decision
    }

    /// Playback reached the end — completion fires here even if the threshold rounding missed it.
    public mutating func end(durationSeconds: Double) -> VideoProgressDecision {
        guard !didComplete else { return .none }
        didComplete = true
        return VideoProgressDecision(writePosition: nil, markComplete: true)
    }

    private mutating func completionCheck(currentSeconds: Double, durationSeconds: Double) -> VideoProgressDecision {
        guard !didComplete, durationSeconds > 0 else { return .none }
        if currentSeconds / durationSeconds >= completionThreshold {
            didComplete = true
            return VideoProgressDecision(writePosition: nil, markComplete: true)
        }
        return .none
    }

    private func wholeSecond(_ seconds: Double) -> Int {
        Int(max(0, seconds).rounded(.down))
    }
}
