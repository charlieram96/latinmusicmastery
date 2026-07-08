import Foundation
import ScoreModel

// Port of `lib/play-sense/exercise-utils.ts` (function-for-function).

/// Port of `beatToTimestamp` — convert a beat position to a timestamp in seconds relative
/// to exercise start. `beat` is 1-based, `measure` is 1-based. `swing` (0-100) pushes
/// upbeats (off-eighth-notes) later: 0 = straight, 67 = triplet swing.
public func beatToTimestamp(
    event: ExerciseEvent,
    bpm: Double,
    timeSignature: TimeSignature,
    loopIndex: Int = 0,
    totalMeasures: Int = 0,
    swing: Double = 0
) -> Double {
    let beatsPerMeasure = Double(timeSignature.numerator)
    let beatDuration = 60 / bpm

    // Total beats from start: (measure-1) * beatsPerMeasure + (beat-1), plus loop offset.
    let loopOffsetBeats = Double(loopIndex) * Double(totalMeasures) * beatsPerMeasure
    let measureOffset = Double(event.measure - 1) * beatsPerMeasure
    let beatOffset = event.beat - 1

    var timestamp = (loopOffsetBeats + measureOffset + beatOffset) * beatDuration

    // Apply swing: offset upbeat eighth notes (fractional part = 0.5).
    if swing > 0 {
        // JS `%` is a truncating remainder, matching `truncatingRemainder` exactly
        // (including the negative-fraction behavior for beats below 1).
        let fractionalBeat = (event.beat - 1).truncatingRemainder(dividingBy: 1)
        if abs(fractionalBeat - 0.5) < 0.01 {
            // Swing ratio: 0 = 50/50 (straight), 67 = 2:1 (triplet), 100 = fully dotted
            let swingRatio = swing / 100
            let swingOffset = swingRatio * beatDuration * 0.5
            timestamp += swingOffset
        }
    }

    return timestamp
}

/// Port of `generateExpectedTimestamps` — all expected event timestamps for a full
/// exercise (including loops), with timing, pitch, technique, and duration data.
public func generateExpectedTimestamps(_ exercise: ExerciseDefinition) -> [ExpectedEvent] {
    var results: [ExpectedEvent] = []
    let beatDuration = 60 / exercise.bpm

    for loop in 0..<exercise.loopCount {
        for event in exercise.events {
            let timestamp = beatToTimestamp(
                event: event,
                bpm: exercise.bpm,
                timeSignature: exercise.timeSignature,
                loopIndex: loop,
                totalMeasures: exercise.measures,
                swing: exercise.swing
            )
            results.append(ExpectedEvent(
                eventIndex: results.count,
                timestamp: timestamp,
                expectedPitch: event.expectedPitch,
                expectedTechnique: event.technique.rawValue,
                expectedDurationSec: event.duration * beatDuration,
                expectedSurface: event.surface,
                // Make the chord group id loop-unique so notes from different loop
                // iterations aren't grouped together.
                chordId: event.chordId.map { "\(loop):\($0)" }
            ))
        }
    }

    // Stable like JS sort: chord notes share timestamps and must keep push order.
    return results.stableSorted { $0.timestamp < $1.timestamp }
}

/// Port of `getExerciseDuration` — total exercise duration in seconds (all loops).
public func getExerciseDuration(_ exercise: ExerciseDefinition) -> Double {
    let beatsPerMeasure = exercise.timeSignature.numerator
    let totalBeats = exercise.measures * beatsPerMeasure * exercise.loopCount
    return (Double(totalBeats) * 60) / exercise.bpm
}

/// Port of `getCountInDuration` — count-in duration in seconds (default 4 beats).
public func getCountInDuration(bpm: Double, countInBeats: Double = 4) -> Double {
    (countInBeats * 60) / bpm
}

/// Port of `beatDurationToVexDuration` — VexFlow duration value from beat duration.
/// 1 beat = quarter (q), 0.5 = eighth (8), 0.25 = sixteenth (16), 2 = half (h), 4 = whole (w).
public func beatDurationToVexDuration(_ duration: Double) -> String {
    if duration >= 4 { return "w" }
    if duration >= 2 { return "h" }
    if duration >= 1 { return "q" }
    if duration >= 0.5 { return "8" }
    if duration >= 0.25 { return "16" }
    return "32"
}

/// Port of `groupEventsByMeasure` — group exercise events by measure for rendering.
/// (The TS returns an insertion-ordered `Map`; the keys here are the same 1...measures
/// range, so a dictionary keyed by measure number carries identical information.)
public func groupEventsByMeasure(events: [ExerciseEvent], measures: Int) -> [Int: [ExerciseEvent]] {
    var grouped: [Int: [ExerciseEvent]] = [:]
    if measures >= 1 {
        for measure in 1...measures {
            grouped[measure] = []
        }
    }
    for event in events where grouped[event.measure] != nil {
        grouped[event.measure]?.append(event)
    }
    // Sort events within each measure by beat (stable, like JS sort).
    for (measure, measureEvents) in grouped {
        grouped[measure] = measureEvents.stableSorted { $0.beat < $1.beat }
    }
    return grouped
}

/// Port of `getLetterGrade` — letter grade from score percentage.
public func getLetterGrade(_ score: Double) -> String {
    if score >= 95 { return "A+" }
    if score >= 90 { return "A" }
    if score >= 85 { return "B+" }
    if score >= 80 { return "B" }
    if score >= 75 { return "C+" }
    if score >= 70 { return "C" }
    if score >= 60 { return "D" }
    return "F"
}

/// Port of `getInstrumentLabel` — instrument display name (falls back to the raw string).
public func getInstrumentLabel(_ instrument: String) -> String {
    let labels: [String: String] = [
        "conga": "Congas",
        "timbale": "Timbales",
        "bongo": "Bongos",
        "clave": "Clave",
        "cowbell": "Cowbell",
        "guiro": "Guiro",
        "guitar": "Guitar",
        "bass": "Bass",
        "piano": "Piano",
        "tres": "Tres",
        "cuatro": "Cuatro",
        "trumpet": "Trumpet",
        "saxophone": "Saxophone",
        "flute": "Flute",
        "violin": "Violin"
    ]
    return labels[instrument] ?? instrument
}

/// Port of `getDifficultyColor` — Tailwind badge class per difficulty (UI data, ported
/// with the table for completeness).
public func getDifficultyColor(_ difficulty: String) -> String {
    switch difficulty {
    case "beginner": return "text-green-500"
    case "intermediate": return "text-yellow-500"
    case "advanced": return "text-red-500"
    default: return "text-muted-foreground"
    }
}
