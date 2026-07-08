import Foundation

/// Port of `lib/playsense-studio/time-mapping.ts` — score-internal time math.
///
/// Given a ``ScoreDocument`` with an initial tempo and per-measure tempo/time-signature
/// changes, computes the millisecond offset (from the start of the piece) of any musical
/// position. This is the "score-relative" clock — it knows nothing about video. The
/// video-relative clock is `TimeMapKit`'s `WaypointTimeMap`.
///
/// Conventions (verbatim from the TS source):
///   - `tempo` is always quarter-note BPM (matches the MusicXML default beat-unit = 4).
///   - `beat` within a measure is denominator-of-time-signature units. In 4/4 that's a
///     quarter note, in 6/8 an eighth note. Beat numbers are 1-based: beat 1 is the downbeat.
///   - `qn` is "quarter notes from the start of the piece" — the canonical position unit
///     used everywhere else (TimeMap waypoints, score events, etc.).
public enum ScoreTime {
    /// Floating-point slack for QN capacity comparisons.
    public static let qnEpsilon = 1e-7

    /// Quarter notes per measure for a given time signature.
    public static func measureLengthInQN(_ timeSignature: TimeSignature) -> Double {
        (Double(timeSignature.numerator) * 4) / Double(timeSignature.denominator)
    }

    /// Quarter notes per beat for a given time signature.
    public static func beatLengthInQN(_ timeSignature: TimeSignature) -> Double {
        4 / Double(timeSignature.denominator)
    }

    /// The TRUE occupied length of a note/rest in quarter notes, given a base duration and
    /// its modifiers. A dot adds half (×1.5); a triplet member occupies two-thirds of its
    /// nominal value (×2/3). Single source of truth for how much room an event takes in a
    /// measure — the editor stores this value as `durationQN` so this function and
    /// `occupiedQN` stay consistent.
    public static func effectiveDurationQN(
        _ baseDurationQN: Double,
        dotted: Bool = false,
        triplet: Bool = false
    ) -> Double {
        var result = baseDurationQN
        if dotted { result *= 1.5 }
        if triplet { result *= 2.0 / 3.0 }
        return result
    }

    /// Total quarter notes occupied by a measure's events (their stored durations).
    public static func occupiedQN(_ events: [MusicalEvent]) -> Double {
        events.reduce(0) { $0 + $1.durationQN }
    }

    /// True when a measure holds nothing but a single full-measure rest — the placeholder
    /// older scores were seeded with. Such a rest should be replaced (not appended to) when
    /// the first real note is added.
    public static func isFillerRest(_ events: [MusicalEvent], timeSignature: TimeSignature) -> Bool {
        guard events.count == 1, case .rest(let rest) = events[0] else { return false }
        return abs(rest.durationQN - measureLengthInQN(timeSignature)) < qnEpsilon
    }

    /// Milliseconds per quarter note at the given quarter-note BPM.
    public static func qnToMs(_ quarterNotes: Double, tempo: Double) -> Double {
        (quarterNotes * 60_000) / tempo
    }

    /// State at the START of one measure while walking a track.
    public struct MeasureWalkState: Equatable, Sendable {
        /// Cumulative quarter notes at the start of this measure.
        public let cumulativeQN: Double
        /// Cumulative milliseconds at the start of this measure.
        public let cumulativeMs: Double
        /// Time signature in effect AT this measure (after any change at its start).
        public let timeSignature: TimeSignature
        /// Quarter-note BPM in effect AT this measure (after any change at its start).
        public let tempo: Double
    }

    /// One step of ``walkMeasures(track:score:)``.
    public struct MeasureWalk: Equatable, Sendable {
        public let measure: Measure
        public let state: MeasureWalkState
    }

    /// Walk a track's measures, yielding the cumulative state at the start of each. Pure
    /// helper every other function in this namespace builds on. Eager (an array, not a
    /// lazy generator like the TS version) — scores are small by design (see
    /// `ScoreDocument`'s doc comment on scope), so materializing the whole walk up front
    /// costs nothing and keeps every caller's code simpler.
    public static func walkMeasures(track: Track, score: ScoreDocument) -> [MeasureWalk] {
        var cumulativeQN = 0.0
        var cumulativeMs = 0.0
        var timeSignature = score.initialTimeSignature
        var tempo = score.initialTempo
        var steps: [MeasureWalk] = []
        steps.reserveCapacity(track.measures.count)

        for measure in track.measures {
            if let measureTimeSignature = measure.timeSignature { timeSignature = measureTimeSignature }
            if let tempoChange = measure.tempoChange { tempo = tempoChange }

            steps.append(MeasureWalk(
                measure: measure,
                state: MeasureWalkState(
                    cumulativeQN: cumulativeQN,
                    cumulativeMs: cumulativeMs,
                    timeSignature: timeSignature,
                    tempo: tempo
                )
            ))

            let measureQN = measureLengthInQN(timeSignature)
            cumulativeQN += measureQN
            cumulativeMs += qnToMs(measureQN, tempo: tempo)
        }

        return steps
    }

    /// Total duration of a track in milliseconds. Zero for a track with no measures.
    public static func trackDurationMs(track: Track, score: ScoreDocument) -> Double {
        var cumulativeMs = 0.0
        for step in walkMeasures(track: track, score: score) {
            let state = step.state
            cumulativeMs = state.cumulativeMs + qnToMs(measureLengthInQN(state.timeSignature), tempo: state.tempo)
        }
        return cumulativeMs
    }

    /// Total duration of a track in quarter notes.
    public static func trackDurationQN(track: Track, score: ScoreDocument) -> Double {
        var cumulativeQN = 0.0
        for step in walkMeasures(track: track, score: score) {
            cumulativeQN = step.state.cumulativeQN + measureLengthInQN(step.state.timeSignature)
        }
        return cumulativeQN
    }

    /// Convert (measureNumber, beatInMeasure) to cumulative quarter notes from start. Beat
    /// numbers are 1-based: beat 1 is the downbeat. `nil` if the measure does not exist on
    /// this track.
    public static func measureBeatToQN(
        track: Track,
        score: ScoreDocument,
        measureNumber: Int,
        beatInMeasure: Double
    ) -> Double? {
        for step in walkMeasures(track: track, score: score) where step.measure.number == measureNumber {
            let beatsFromDownbeat = beatInMeasure - 1
            return step.state.cumulativeQN + beatsFromDownbeat * beatLengthInQN(step.state.timeSignature)
        }
        return nil
    }

    /// Convert (measureNumber, beatInMeasure) to milliseconds from start. `nil` if the
    /// measure does not exist on this track.
    public static func measureBeatToMs(
        track: Track,
        score: ScoreDocument,
        measureNumber: Int,
        beatInMeasure: Double
    ) -> Double? {
        for step in walkMeasures(track: track, score: score) where step.measure.number == measureNumber {
            let beatsFromDownbeat = beatInMeasure - 1
            let qnIntoMeasure = beatsFromDownbeat * beatLengthInQN(step.state.timeSignature)
            return step.state.cumulativeMs + qnToMs(qnIntoMeasure, tempo: step.state.tempo)
        }
        return nil
    }

    // `qn` mirrors the TS parameter name verbatim.
    // swiftlint:disable identifier_name
    /// Convert a quarter-note position from the start of a track into milliseconds. Walks
    /// tempo changes, accumulating ms per measure until the target `qn` is found.
    ///
    /// If `qn` exceeds the track's length, extrapolates using the final tempo (matches the
    /// TimeMap edge-handling contract). Negative `qn` extrapolates backward at the score's
    /// initial tempo.
    public static func qnToTrackMs(track: Track, score: ScoreDocument, qn: Double) -> Double {
        if qn < 0 { return -qnToMs(-qn, tempo: score.initialTempo) }

        var lastTempo = score.initialTempo
        var lastCumulativeQN = 0.0
        var lastCumulativeMs = 0.0

        for step in walkMeasures(track: track, score: score) {
            let state = step.state
            let measureQN = measureLengthInQN(state.timeSignature)
            let measureEndQN = state.cumulativeQN + measureQN

            if qn <= measureEndQN {
                let qnIntoMeasure = qn - state.cumulativeQN
                return state.cumulativeMs + qnToMs(qnIntoMeasure, tempo: state.tempo)
            }

            lastTempo = state.tempo
            lastCumulativeQN = measureEndQN
            lastCumulativeMs = state.cumulativeMs + qnToMs(measureQN, tempo: state.tempo)
        }

        // qn is past the end of the score — extrapolate at the final tempo.
        return lastCumulativeMs + qnToMs(qn - lastCumulativeQN, tempo: lastTempo)
    }
    // swiftlint:enable identifier_name
}
