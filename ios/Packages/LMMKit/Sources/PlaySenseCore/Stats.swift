import Foundation

// Port of the aggregate-stats + pure pitch helpers in `lib/play-sense/scoring.ts`
// (split from Scoring.swift only for file length; same TS source module).

/// Port of `frequencyToMidi` — convert a frequency in Hz to the nearest MIDI note number.
public func frequencyToMidi(_ freq: Double) -> Int {
    Int(jsRound(69 + 12 * log2(freq / 440)))
}

/// Port of `midiToNoteName` (`scoring.ts`) — MIDI note number to a note name
/// (e.g. 60 → "C4").
public func midiToNoteName(_ midi: Int) -> String {
    let names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    let note = names[((midi % 12) + 12) % 12]
    let octave = Int((Double(midi - 12) / 12).rounded(.down))
    return "\(note)\(octave)"
}

// Faithful port of a long TS function — same rationale as `gradeSingleOnset`.
// swiftlint:disable function_body_length

/// Port of `computeStats` — aggregate stats from event results.
public func computeStats(
    results: [EventResult],
    extraHits: Int,
    durationSeconds: Double
) -> AttemptStats {
    let perfectCount = results.filter { $0.grade == .perfect }.count
    let goodCount = results.filter { $0.grade == .good }.count
    let okCount = results.filter { $0.grade == .ok }.count
    let missCount = results.filter { $0.grade == .miss }.count
    let totalEvents = results.count

    // Accuracy: (perfect + good) / total
    let accuracy = totalEvents > 0 ? (Double(perfectCount + goodCount) / Double(totalEvents)) * 100 : 0

    // Score with combo multiplier
    var combo = 0
    var maxCombo = 0
    var streak = 0
    var maxStreak = 0
    var totalScore = 0.0

    for result in results {
        if result.grade != .miss {
            combo += 1
            maxCombo = max(maxCombo, combo)
            if result.grade == .perfect {
                streak += 1
                maxStreak = max(maxStreak, streak)
            } else {
                streak = 0
            }
        } else {
            combo = 0
            streak = 0
        }

        let multiplier = min(combo / 10 + 1, 4)
        totalScore += result.grade.points * Double(multiplier)
    }

    // Normalize to 0-100: simulate a perfect run with the same combo ramp-up
    var maxPossibleScore = 0.0
    for index in 0..<totalEvents {
        let maxMultiplier = min((index + 1) / 10 + 1, 4)
        maxPossibleScore += HitGrade.perfect.points * Double(maxMultiplier)
    }
    var score = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0

    // Penalize extra hits: each extra hit deducts 2% of the score (min 0)
    if extraHits > 0, score > 0 {
        let penalty = Double(extraHits) * 2
        score = max(0, score - penalty)
    }

    // Average offset (excluding misses)
    let hitResults = results.filter { $0.offsetMs != nil }
    let avgOffsetMs = hitResults.isEmpty
        ? 0
        : hitResults.reduce(0.0) { $0 + ($1.offsetMs ?? 0) } / Double(hitResults.count)

    // Tempo drift: running average of last 8 offsets
    let driftWindow = hitResults.suffix(8)
    let tempoDriftMs = driftWindow.isEmpty
        ? 0
        : driftWindow.reduce(0.0) { $0 + ($1.offsetMs ?? 0) } / Double(driftWindow.count)

    // Pitch accuracy: percentage of notes with pitchCorrect === true out of notes that
    // had a pitchCorrect slot at all (TS `!== undefined` — null/`unknown` counts in the
    // denominator; `.notApplicable` does not).
    let pitchedResults = results.filter { $0.pitchCorrect != .notApplicable }
    let pitchAccuracy: Double? = pitchedResults.isEmpty
        ? nil
        : jsRound(
            Double(pitchedResults.filter { $0.pitchCorrect == .correct }.count)
                / Double(pitchedResults.count) * 10000
        ) / 100

    return AttemptStats(
        score: jsRound(score * 100) / 100,
        accuracy: jsRound(accuracy * 100) / 100,
        perfectCount: perfectCount,
        goodCount: goodCount,
        okCount: okCount,
        missCount: missCount,
        extraHits: extraHits,
        maxCombo: maxCombo,
        maxStreak: maxStreak,
        avgOffsetMs: jsRound(avgOffsetMs * 100) / 100,
        tempoDriftMs: jsRound(tempoDriftMs * 100) / 100,
        durationSeconds: jsRound(durationSeconds * 100) / 100,
        pitchAccuracy: pitchAccuracy
    )
}
// swiftlint:enable function_body_length
