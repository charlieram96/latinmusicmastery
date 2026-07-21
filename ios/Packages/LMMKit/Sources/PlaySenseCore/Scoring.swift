import Foundation

// Port of `lib/play-sense/scoring.ts` (function-for-function; the quirks are ported
// verbatim and noted inline). Golden parity: Tests/PlaySenseCoreTests/Fixtures.

/// Port of `downgradeGrade` — lower a hit grade by one level (perfect → good → ok → miss).
func downgradeGrade(_ grade: HitGrade) -> HitGrade {
    switch grade {
    case .perfect: return .good
    case .good: return .ok
    case .ok, .miss: return .miss
    }
}

/// Port of `gradeHit`.
func gradeHit(absOffsetMs: Double, tolerance: ToleranceWindows) -> HitGrade {
    if absOffsetMs <= tolerance.perfect { return .perfect }
    if absOffsetMs <= tolerance.good { return .good }
    if absOffsetMs <= tolerance.ok { return .ok }
    return .miss
}

/// Port of the inline timing classification (`offsetMs < -5 ? 'early' : offsetMs > 5 ?
/// 'late' : 'on_time'`) shared by all three graders. Uses the UNROUNDED offset.
private func timingFeedback(offsetMs: Double) -> TimingFeedback {
    offsetMs < -5 ? .early : offsetMs > 5 ? .late : .onTime
}

private func widened(_ tolerance: ToleranceWindows, by widenMs: Double) -> ToleranceWindows {
    ToleranceWindows(
        perfect: tolerance.perfect + widenMs,
        good: tolerance.good + widenMs,
        ok: tolerance.ok + widenMs
    )
}

// Faithful port of a long TS function; splitting it would obscure the line-for-line mapping.
// swiftlint:disable function_body_length

/// Port of `greedyMatch` — greedy matching with 1-event lookahead. Matches detected
/// onsets to expected events based on timing proximity.
public func greedyMatch(
    expectedEvents: [ExpectedEvent],
    detectedOnsets: [OnsetEvent],
    difficulty: Difficulty,
    calibrationOffsetSec: Double = 0,
    widenMs: Double = 0
) -> [EventResult] {
    let effectiveTolerance = widened(difficulty.toleranceWindows, by: widenMs)

    // Sort both arrays by timestamp (stable, like JS sort — ties keep input order).
    let sorted = expectedEvents.stableSorted { $0.timestamp < $1.timestamp }
    let onsets = detectedOnsets
        .map { onset -> OnsetEvent in
            var shifted = onset
            shifted.timestamp = onset.timestamp - calibrationOffsetSec
            return shifted
        }
        .stableSorted { $0.timestamp < $1.timestamp }

    var matchedOnsets = Set<Int>()
    var results: [EventResult] = []

    for index in sorted.indices {
        let expected = sorted[index]
        let expectedMs = expected.timestamp * 1000

        // Find closest unmatched onset within the Ok window.
        var bestIdx = -1
        var bestAbsOffset = Double.infinity

        for onsetIdx in onsets.indices {
            if matchedOnsets.contains(onsetIdx) { continue }
            let onsetMs = onsets[onsetIdx].timestamp * 1000
            let absOffset = abs(onsetMs - expectedMs)

            if absOffset > effectiveTolerance.ok {
                // Verbatim TS quirk: the intended "skip ahead once past the window" early
                // exit compares against `ok / 1000 * 1000` (a no-op unit conversion), so
                // the break fires for any later onset — including ones that were skipped
                // only because they were already matched. Ported as written.
                if onsetMs > expectedMs + effectiveTolerance.ok / 1000 * 1000 { break }
                continue
            }

            if absOffset < bestAbsOffset {
                bestAbsOffset = absOffset
                bestIdx = onsetIdx
            }
        }

        if bestIdx == -1 {
            // No onset found — miss.
            results.append(EventResult(
                eventIndex: expected.eventIndex,
                grade: .miss,
                offsetMs: nil,
                timing: nil,
                onsetEnergy: nil
            ))
            continue
        }

        let offsetMs = onsets[bestIdx].timestamp * 1000 - expectedMs

        // Grade the hit.
        let grade = gradeHit(absOffsetMs: abs(offsetMs), tolerance: effectiveTolerance)

        // Lookahead: if grade is only "ok" and there's a next event, check if this onset
        // is a better match for the next event.
        if grade == .ok, index + 1 < sorted.count {
            let nextExpectedMs = sorted[index + 1].timestamp * 1000
            let nextAbsOffset = abs(onsets[bestIdx].timestamp * 1000 - nextExpectedMs)
            if nextAbsOffset < bestAbsOffset {
                // This onset is closer to the next event — skip it, record miss.
                results.append(EventResult(
                    eventIndex: expected.eventIndex,
                    grade: .miss,
                    offsetMs: nil,
                    timing: nil,
                    onsetEnergy: nil
                ))
                continue
            }
        }

        // Assign the onset to this event.
        matchedOnsets.insert(bestIdx)

        results.append(EventResult(
            eventIndex: expected.eventIndex,
            grade: grade,
            offsetMs: jsRound(offsetMs * 100) / 100,
            timing: timingFeedback(offsetMs: offsetMs),
            onsetEnergy: onsets[bestIdx].energy
        ))
    }

    return results
}
// swiftlint:enable function_body_length

// Faithful port of a long TS function; splitting it would obscure the line-for-line mapping.
// swiftlint:disable function_body_length

/// Port of `gradeSingleOnset` — grade a single onset against the nearest expected event
/// in real time. Supports both percussion (onset-only) and pitched instruments
/// (onset + pitch). Mutates `matchedIndices` exactly like the TS `Set` argument.
public func gradeSingleOnset(
    onsetTimestamp: Double,
    onsetEnergy: Double,
    expectedEvents: [ExpectedEvent],
    matchedIndices: inout Set<Int>,
    difficulty: Difficulty,
    calibrationOffsetSec: Double = 0,
    widenMs: Double = 0,
    instrumentCategory: InstrumentCategory = .percussion,
    detectedMidiNote: Int? = nil,
    detectedFrequency: Double? = nil,
    detectedSurface: String? = nil
) -> EventResult? {
    let effectiveTolerance = widened(difficulty.toleranceWindows, by: widenMs)

    let correctedTimestamp = onsetTimestamp - calibrationOffsetSec
    let correctedMs = correctedTimestamp * 1000

    var bestIdx = -1
    var bestAbsOffset = Double.infinity

    for index in expectedEvents.indices {
        if matchedIndices.contains(expectedEvents[index].eventIndex) { continue }
        let expectedMs = expectedEvents[index].timestamp * 1000
        let absOffset = abs(correctedMs - expectedMs)

        if absOffset <= effectiveTolerance.ok, absOffset < bestAbsOffset {
            bestAbsOffset = absOffset
            bestIdx = index
        }
    }

    if bestIdx == -1 { return nil }

    let matched = expectedEvents[bestIdx]
    let expectedMs = matched.timestamp * 1000
    let offsetMs = correctedMs - expectedMs
    var grade = gradeHit(absOffsetMs: abs(offsetMs), tolerance: effectiveTolerance)
    let timing = timingFeedback(offsetMs: offsetMs)

    // Pitch scoring for pitched instruments — tolerant by cents + (optionally)
    // octave-agnostic, so a slightly flat/sharp or octave-confused note is not
    // automatically zeroed. `pitchCorrect` starts at `.unknown` (TS `null`), so
    // percussion and pitch-less slots report null on the wire, not undefined.
    var pitchCorrect: PitchJudgment = .unknown
    var pitchCents: Double?
    if instrumentCategory == .pitched, let expectedPitch = matched.expectedPitch {
        let toleranceCents = difficulty.pitchToleranceInCents
        let octaveAgnostic = difficulty.isOctaveAgnostic

        if let detectedFrequency {
            let expectedFreq = 440 * pow(2, (Double(expectedPitch) - 69) / 12)
            let rawCents = 1200 * log2(detectedFrequency / expectedFreq)

            // Display value: deviation to the nearest semitone, clamped to ±50 cents.
            let semitoneCents = rawCents - 100 * jsRound(rawCents / 100)
            pitchCents = max(-50, min(50, jsRound(semitoneCents)))

            // Deviation to the nearest *matching* pitch. When octave-agnostic, fold out
            // whole octaves so an octave error reads as in-tune, not wildly off.
            let trueCents = octaveAgnostic
                ? rawCents - 1200 * jsRound(rawCents / 1200)
                : rawCents
            pitchCorrect = abs(trueCents) <= toleranceCents ? .correct : .wrong
        } else if let detectedMidiNote {
            // No frequency available — fall back to MIDI comparison.
            let matches = octaveAgnostic
                ? detectedMidiNote % 12 == expectedPitch % 12
                : detectedMidiNote == expectedPitch
            pitchCorrect = matches ? .correct : .wrong
        } else {
            // Pitch expected but nothing detected — treat as a miss.
            pitchCorrect = .wrong
            grade = .miss
        }

        // A clearly-wrong pitch downgrades the hit one level rather than zeroing a
        // well-timed note. (A note with no detected pitch is already a miss above.)
        if pitchCorrect == .wrong, detectedFrequency != nil || detectedMidiNote != nil {
            grade = downgradeGrade(grade)
        }
    }

    // Technique tracking for percussion instruments: detection from audio requires ML
    // models (future enhancement), so the TS leaves it null (unknown) — as does this port.
    let techniqueCorrect: Bool? = nil

    // Surface scoring for the PlaySense device. TS guards on `matched.expectedSurface`
    // TRUTHINESS, so an empty-string surface behaves like none at all.
    var surfaceCorrect: Bool?
    if let expectedSurface = matched.expectedSurface, !expectedSurface.isEmpty, let detectedSurface {
        surfaceCorrect = detectedSurface == expectedSurface
        if surfaceCorrect == false {
            grade = .miss // wrong drum = miss
        }
    }

    matchedIndices.insert(matched.eventIndex)

    return EventResult(
        eventIndex: matched.eventIndex,
        grade: grade,
        offsetMs: jsRound(offsetMs * 100) / 100,
        timing: timing,
        onsetEnergy: onsetEnergy,
        detectedPitch: detectedFrequency,
        pitchCorrect: pitchCorrect,
        pitchCents: pitchCents,
        techniqueCorrect: techniqueCorrect,
        surfaceCorrect: surfaceCorrect,
        detectedSurface: detectedSurface
    )
}
// swiftlint:enable function_body_length

/// Port of `matchOnsetToExpected` — find the nearest unmatched expected event within the
/// Ok timing window, without consuming it. Read-only (non-`inout` by construction) — used
/// to decide whether an onset lands on a chord group (so the caller can route to chord
/// scoring) before committing a grade.
public func matchOnsetToExpected(
    onsetTimestamp: Double,
    expectedEvents: [ExpectedEvent],
    matchedIndices: Set<Int>,
    difficulty: Difficulty,
    calibrationOffsetSec: Double = 0,
    widenMs: Double = 0
) -> ExpectedEvent? {
    let okWindow = difficulty.toleranceWindows.ok + widenMs
    let correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1000

    var best: ExpectedEvent?
    var bestAbsOffset = Double.infinity
    for event in expectedEvents {
        if matchedIndices.contains(event.eventIndex) { continue }
        let absOffset = abs(correctedMs - event.timestamp * 1000)
        if absOffset <= okWindow, absOffset < bestAbsOffset {
            bestAbsOffset = absOffset
            best = event
        }
    }
    return best
}

// Faithful port of a long TS function — same rationale as `gradeSingleOnset` above.
// swiftlint:disable function_body_length function_parameter_count

/// Port of `gradeChordOnset` — grade a strummed chord as a SET. Given the onset (timing)
/// plus the strum's chroma vector, check how many of the chord's distinct pitch classes
/// are present and grade the whole group at once. Returns one `EventResult` per group
/// event (same grade) so expected/result cardinality — and `computeStats` normalization —
/// is preserved. Presence-only: extra/wrong pitch classes do not penalize.
///
/// If chroma is missing (analysis failed/late), grades leniently on timing alone so a
/// real strum is never zeroed for a dropped analysis frame.
public func gradeChordOnset(
    onsetTimestamp: Double,
    onsetEnergy: Double,
    expectedEvents: [ExpectedEvent],
    matchedIndices: inout Set<Int>,
    chordId: String,
    difficulty: Difficulty,
    calibrationOffsetSec: Double = 0,
    widenMs: Double = 0,
    chroma: [Double]? = nil
) -> [EventResult] {
    // Grade the whole chord group by id. The caller reserves the group's indices in
    // matchedIndices when it schedules this, so we group by chordId alone here.
    let group = expectedEvents.filter { $0.chordId == chordId }
    if group.isEmpty { return [] }

    let effectiveTolerance = widened(difficulty.toleranceWindows, by: widenMs)

    // Timing graded against the group's shared timestamp.
    let expectedMs = group[0].timestamp * 1000
    let correctedMs = (onsetTimestamp - calibrationOffsetSec) * 1000
    let offsetMs = correctedMs - expectedMs
    let timingGrade = gradeHit(absOffsetMs: abs(offsetMs), tolerance: effectiveTolerance)
    let timing = timingFeedback(offsetMs: offsetMs)

    // Distinct expected pitch classes for this chord.
    let pitchClasses = Set(group.compactMap { event in
        event.expectedPitch.map { (($0 % 12) + 12) % 12 }
    })

    // Presence per pitch class. With no chroma, assume present (lenient fallback).
    var present = Set<Int>()
    if let chroma, chroma.count == 12 {
        let maxEnergy = chroma.max() ?? -.infinity
        let floor = maxEnergy > 0 ? maxEnergy * chromaPresenceThreshold : Double.infinity
        for pitchClass in pitchClasses where chroma[pitchClass] >= floor {
            present.insert(pitchClass)
        }
    } else {
        present = pitchClasses
    }

    let ratio = pitchClasses.isEmpty ? 1 : Double(present.count) / Double(pitchClasses.count)
    let required = difficulty.requiredChordPresenceRatio

    // At/above the required ratio → full timing grade. Below → downgrade by how complete
    // the chord is in absolute terms (fraction of tones present), bottoming out at a miss
    // for under ~40% of the chord.
    var chordGrade = timingGrade
    if ratio < required {
        let levels: Int
        if ratio >= 0.6 {
            levels = 1
        } else if ratio >= 0.4 {
            levels = 2
        } else {
            levels = 3
        }
        for _ in 0..<levels { chordGrade = downgradeGrade(chordGrade) }
    }

    return group.map { event in
        let pitchClass = event.expectedPitch.map { (($0 % 12) + 12) % 12 }
        let notePresent: PitchJudgment = pitchClass.map { present.contains($0) ? .correct : .wrong } ?? .unknown
        matchedIndices.insert(event.eventIndex)
        return EventResult(
            eventIndex: event.eventIndex,
            grade: chordGrade,
            offsetMs: jsRound(offsetMs * 100) / 100,
            timing: timing,
            onsetEnergy: onsetEnergy,
            detectedPitch: nil,
            pitchCorrect: notePresent,
            pitchCents: nil,
            techniqueCorrect: nil,
            surfaceCorrect: nil,
            detectedSurface: nil
        )
    }
}
// swiftlint:enable function_body_length function_parameter_count
