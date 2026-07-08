// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import Foundation
import PlaySenseCore

// Pure simulation core of the falling-note field, extracted from `NoteField.ts`'s `update()` so the
// timing math and the hit / missed / crossed set transitions are unit-testable without SpriteKit.
// The SpriteKit ``NoteField`` owns one of these and stamps pooled sprites from the frame it returns.

/// Seconds of refraction wobble after crossing the line.
public let refractSec = 0.18
/// Seconds over which the miss shake decays.
public let shakeDecaySec = 0.75
/// Seconds after crossing before a missed note fully expires.
public let missLifeSec = 1.1

/// One note the field wants drawn this frame. Lane geometry (x, width, color) is resolved by the
/// caller from the ``LaneLayout``; the model is geometry-agnostic beyond the vertical axis.
public struct VisibleNote: Equatable, Sendable {
    public let eventIndex: Int
    /// Vertical position in web space (0 = top, `hitY` = hit line), pixels.
    public let y: Double
    /// Seconds until the note reaches the hit line (negative = already past).
    public let timeToHit: Double
    /// Seconds past the hit line (0 while approaching).
    public let pastSec: Double
    public let isMissed: Bool
    /// 0…1 fade-in over the first 15% of the approach.
    public let fadeIn: Double
}

/// The per-frame output of ``NoteFieldModel/frame(elapsedSec:hitY:approachSec:)``.
///
/// NOTE on allocation: this struct's three arrays are freshly built every call — `frame()` does allocate
/// per frame. That's distinct from (and shouldn't be confused with) the SpriteKit ``NoteField``'s sprite
/// layer, which genuinely allocates zero sprites/textures during play (pooled, stamped from baked
/// textures — see `HighwayPerformanceTests`'s doc comment). A pooled visitor-callback API instead of
/// returning arrays was considered to eliminate this, but `NoteFrame`'s value semantics are relied on by
/// callers/tests that keep multiple frames alive at once (e.g. `NoteFieldModelTests` asserts across
/// several retained `frame()` results) — reusing an internal buffer in place would silently mutate
/// already-returned frames out from under them. Not worth destabilizing the model API for what's a small,
/// infrequent (one call per SpriteKit `update(_:)`, i.e. once per display frame, not per note) allocation;
/// `reserveCapacity` below at least avoids repeated reallocation while a frame's `visible` array grows.
public struct NoteFrame: Equatable, Sendable {
    public var visible: [VisibleNote] = []
    /// Events auto-missed this frame (passed the line unjudged) — fire onAutoMiss.
    public var autoMissed: [Int] = []
    /// Missed events that broke through the glass this frame — fire the ripple/red-seep once.
    public var crossed: [Int] = []
}

/// Straight-line note position: every note falls uniformly, reaching `hitY` exactly at its timestamp.
/// Port of `y = hitY - timeToHit * (hitY / approach)`.
public func noteY(timeToHit: Double, hitY: Double, approachSec: Double) -> Double {
    let pxPerSec = hitY / approachSec
    return hitY - timeToHit * pxPerSec
}

public final class NoteFieldModel {
    private var expectedEvents: [ExpectedEvent] = []

    private var hitIndices = Set<Int>()
    private var missedIndices = Set<Int>()
    private var crossedIndices = Set<Int>()

    public init() {}

    /// (Re)load with an exercise's expected timeline (already sorted by timestamp).
    public func setExpectedEvents(_ events: [ExpectedEvent]) {
        expectedEvents = events
        hitIndices.removeAll()
        missedIndices.removeAll()
        crossedIndices.removeAll()
    }

    public func markHit(_ eventIndex: Int) { hitIndices.insert(eventIndex) }
    public func markMissed(_ eventIndex: Int) { missedIndices.insert(eventIndex) }

    public func isHit(_ eventIndex: Int) -> Bool { hitIndices.contains(eventIndex) }
    public func isMissed(_ eventIndex: Int) -> Bool { missedIndices.contains(eventIndex) }

    /// Port of `getClosestEventIndex` — the unjudged note nearest the hit line.
    public func closestEventIndex(elapsedSec: Double) -> Int? {
        var bestIdx: Int?
        var bestDist = Double.infinity
        for expected in expectedEvents {
            if hitIndices.contains(expected.eventIndex) { continue }
            if missedIndices.contains(expected.eventIndex) { continue }
            let dist = abs(expected.timestamp - elapsedSec)
            if dist < bestDist { bestDist = dist; bestIdx = expected.eventIndex }
        }
        return bestIdx
    }

    /// First index in `expectedEvents` whose timestamp ≥ `windowStart` (binary search, port of the
    /// web's inline search).
    func firstVisibleIndex(windowStart: Double) -> Int {
        var lo = 0
        var hi = expectedEvents.count
        while lo < hi {
            let mid = (lo + hi) >> 1
            if expectedEvents[mid].timestamp < windowStart { lo = mid + 1 } else { hi = mid }
        }
        return lo
    }

    /// Advance the field to `elapsedSec` and return everything drawable this frame, mutating the
    /// missed/crossed sets and reporting the transitions. Port of `NoteField.update`'s selection loop.
    public func frame(elapsedSec: Double, hitY: Double, approachSec: Double) -> NoteFrame {
        var out = NoteFrame()
        guard hitY > 0, !expectedEvents.isEmpty else { return out }
        // Cheap allocation win (no API/semantics change): a handful of notes are visible at once in
        // practice (the visible window is only ~missLifeSec + approachSec*1.15 wide), so a small reserve
        // avoids most of the append-driven reallocation without over-allocating for the common case.
        out.visible.reserveCapacity(8)

        let pxPerSec = hitY / approachSec
        let windowStart = elapsedSec - missLifeSec
        let windowEnd = elapsedSec + approachSec * 1.15
        let lo = firstVisibleIndex(windowStart: windowStart)

        var i = lo
        while i < expectedEvents.count {
            let expected = expectedEvents[i]
            defer { i += 1 }
            if expected.timestamp > windowEnd { break }
            if hitIndices.contains(expected.eventIndex) { continue }

            let timeToHit = expected.timestamp - elapsedSec
            let y = hitY - timeToHit * pxPerSec
            if y < -30 { continue }

            let pastSec = -timeToHit

            // Auto-miss once meaningfully past the line and unjudged.
            if pastSec > 0.03, !missedIndices.contains(expected.eventIndex) {
                missedIndices.insert(expected.eventIndex)
                out.autoMissed.append(expected.eventIndex)
            }

            let isMissed = missedIndices.contains(expected.eventIndex)
            if isMissed, pastSec > missLifeSec { continue }
            if !isMissed, pastSec > 0.05 { continue }

            // Announce the crossing once (Effects fires ripple + red seep).
            if isMissed, pastSec > 0, !crossedIndices.contains(expected.eventIndex) {
                crossedIndices.insert(expected.eventIndex)
                out.crossed.append(expected.eventIndex)
            }

            let approachFrac = 1 - timeToHit / approachSec
            let fadeIn = min(1, max(0, approachFrac / 0.15))

            out.visible.append(VisibleNote(
                eventIndex: expected.eventIndex,
                y: y,
                timeToHit: timeToHit,
                pastSec: max(0, pastSec),
                isMissed: isMissed && pastSec > 0,
                fadeIn: fadeIn
            ))
        }
        return out
    }
}

// swiftlint:enable identifier_name
