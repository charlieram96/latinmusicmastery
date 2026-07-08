import PlaySenseCore
import PlaySenseHighway

/// Pure diffing of ``SessionCoordinator/hudResults`` into the highway effects ``HighwayBridge`` should fire
/// this tick — extracted out of `HighwayBridge.tick()` so the miss/correction bookkeeping is unit-testable
/// without a live `SessionCoordinator`/`HighwayScene` (see `HighwayResultVisualizerTests`).
///
/// ## The un-miss question
/// `LiveScorer`'s tentative-miss design lets a late-arriving hit correct an already-recorded miss: a chord
/// (`gradeChordDeferred`) or deferred-pitch (`gradePitchDeferred`) grade can land *after*
/// `checkTentativeMisses` already appended a `.miss` `EventResult` for the same `eventIndex` — when that
/// happens, `LiveScorer` removes the stale miss result and appends the corrected one in its place
/// (`applySingleResult`/`gradeChordDeferred` in `PlaySenseCore/LiveScorer.swift`), so `hudResults` ends up
/// with a *different* grade at that `eventIndex` than whatever was last visualized.
///
/// Does the highway then need to visually "un-miss" the note (pull it back out of its sunk/red-glow state)?
/// Checked against the web reference (`components/play-sense/glass-highway/GlassHighway.tsx` +
/// `hooks/use-exercise-session.ts`, which `HighwayBridge`'s own doc comment already cites as the port
/// source): the web hook performs the exact same remove-then-append
/// (`eventResultsRef.current = eventResultsRef.current.filter(...)` then `[...eventResultsRef.current,
/// result]`), and `GlassHighway`'s effect only reacts to *growth* of `eventResultsLength`
/// (`prevEventCountRef`). A solo correction removes one result and appends one result, so the array's length
/// is unchanged before vs. after — `newCount > prevEventCountRef.current` stays false and the web's
/// `triggerHitEffect`/`triggerMiss` never fires again for that `eventIndex`. Its `NoteField.ts` sprite is
/// left exactly as it was last drawn (still sinking under the glass if a miss was already shown) until it
/// simply times out via `MISS_LIFE_SEC`. The HUD score/combo/accuracy the player sees update correctly
/// regardless, because those are driven by the scorer's own live stats
/// (`currentScore`/`currentCombo`/`currentAccuracy`), not by this per-event visualization latch.
///
/// So: the web genuinely never visually un-misses a corrected event. We match that contract here rather
/// than inventing new unmiss choreography — `diff(_:)` records the corrected grade (so it doesn't loop on
/// the same correction forever) but deliberately does not re-fire `triggerHitEffect`/`triggerMiss` for it.
struct HighwayResultVisualizer {
    /// The grade last fired for each `eventIndex`, so (a) a repeat observation of the same grade doesn't
    /// re-fire, and (b) a correction (a *different* grade at an already-seen `eventIndex`) is recognized and
    /// recorded without looping — see the type doc for why it isn't re-fired.
    private var lastFiredGrade: [Int: HitGrade] = [:]
    /// Mirrors the web's `prevEventCountRef` — the cheap "did anything happen at all" guard. `hudResults`
    /// only grows or does a same-size replace (see type doc), so comparing counts lets most ticks
    /// short-circuit before touching the array at all, instead of rescanning the full growing timeline
    /// every display-link frame.
    private var lastResultCount = 0

    /// Reset for a fresh take (a retry reuses `eventIndex`es from zero).
    mutating func reset() {
        lastFiredGrade.removeAll()
        lastResultCount = 0
    }

    /// Returns the `(eventIndex, kind)` pairs to visualize this tick, in `results` order. Empty when
    /// `results` hasn't grown or shrunk since the last call (the common case — most ticks land between
    /// graded events).
    mutating func diff(_ results: [EventResult]) -> [(eventIndex: Int, kind: HitGradeKind)] {
        guard results.count != lastResultCount else { return [] }
        lastResultCount = results.count

        var toFire: [(eventIndex: Int, kind: HitGradeKind)] = []
        toFire.reserveCapacity(4) // typically 0-1 new results per tick; a chord lands a handful at once.
        for result in results {
            if let recorded = lastFiredGrade[result.eventIndex] {
                if recorded != result.grade {
                    // A correction (see type doc) — update the bookkeeping so we don't keep re-evaluating
                    // it, but intentionally do not re-fire the highway effect (web parity).
                    lastFiredGrade[result.eventIndex] = result.grade
                }
                continue
            }
            lastFiredGrade[result.eventIndex] = result.grade
            toFire.append((result.eventIndex, HighwayBridge.kind(for: result.grade)))
        }
        return toFire
    }
}
