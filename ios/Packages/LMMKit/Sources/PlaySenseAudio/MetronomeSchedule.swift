import Foundation

/// One scheduled metronome click, positioned relative to the exercise-start boundary `t0`.
///
/// Count-in clicks have negative offsets (they sound before `t0`); exercise clicks are at
/// non-negative offsets. `isDownbeat` follows the web rule `index % beatsPerMeasure == 0` within each
/// phase.
public struct ClickEvent: Equatable, Sendable {
    /// Seconds relative to `t0` (negative during the count-in).
    public let offsetSeconds: Double
    public let isDownbeat: Bool

    public init(offsetSeconds: Double, isDownbeat: Bool) {
        self.offsetSeconds = offsetSeconds
        self.isDownbeat = isDownbeat
    }
}

/// Beat readout for UI, derived purely from elapsed time (never from the audio scheduler).
public struct BeatReadout: Equatable, Sendable {
    /// 1-indexed beat within the measure; `0` before the count-in begins.
    public let beatInMeasure: Int
    public let isDownbeat: Bool

    public init(beatInMeasure: Int, isDownbeat: Bool) {
        self.beatInMeasure = beatInMeasure
        self.isDownbeat = isDownbeat
    }
}

public enum MetronomeSchedule {

    /// The full click schedule for an exercise: `countInBeats` count-in clicks followed by
    /// `exerciseBeats` exercise clicks. Offsets are relative to `t0` (the exercise start), so the
    /// count-in occupies `[−countInBeats·beatDuration, 0)`.
    ///
    /// Divergence from web (documented): iOS schedules the ENTIRE track sample-accurately up front on a
    /// dedicated player node, so there is no 25 ms look-ahead `setInterval` — the JS look-ahead exists
    /// only because Web Audio cannot schedule far ahead reliably.
    public static func clicks(
        bpm: Double,
        beatsPerMeasure: Int,
        countInBeats: Int,
        exerciseBeats: Int
    ) -> [ClickEvent] {
        precondition(bpm > 0 && beatsPerMeasure > 0, "bpm and beatsPerMeasure must be positive")
        let beatDuration = 60.0 / bpm
        var events: [ClickEvent] = []
        events.reserveCapacity(max(0, countInBeats) + max(0, exerciseBeats))

        // Count-in: web uses `index % beatsPerMeasure == 0` for the downbeat and sounds these first.
        for index in 0..<max(0, countInBeats) {
            let offset = Double(index - countInBeats) * beatDuration
            events.append(ClickEvent(offsetSeconds: offset, isDownbeat: index % beatsPerMeasure == 0))
        }
        // Exercise clicks, multiplied from the base to avoid float drift (matching the web comment).
        for beat in 0..<max(0, exerciseBeats) {
            events.append(ClickEvent(
                offsetSeconds: Double(beat) * beatDuration,
                isDownbeat: beat % beatsPerMeasure == 0
            ))
        }
        return events
    }

    /// Total count-in duration in seconds — the amount of lead time `t0` must sit in the future.
    public static func countInDuration(bpm: Double, countInBeats: Int) -> Double {
        Double(max(0, countInBeats)) * (60.0 / bpm)
    }

    /// The current visual beat for a time `elapsedSeconds` after the count-in START
    /// (i.e. after `t0 − countInDuration`). Ported from `use-metronome.ts` visual tracking:
    /// `totalBeatIndex = floor(elapsed / beatDuration)`, `beatInMeasure = totalBeatIndex % bpm + 1`.
    public static func beatReadout(
        elapsedSeconds: Double,
        bpm: Double,
        beatsPerMeasure: Int
    ) -> BeatReadout {
        guard elapsedSeconds >= 0 else { return BeatReadout(beatInMeasure: 0, isDownbeat: false) }
        let beatDuration = 60.0 / bpm
        let totalBeatIndex = Int((elapsedSeconds / beatDuration).rounded(.down))
        let beatInMeasure = (totalBeatIndex % beatsPerMeasure) + 1
        return BeatReadout(beatInMeasure: beatInMeasure, isDownbeat: beatInMeasure == 1)
    }
}
