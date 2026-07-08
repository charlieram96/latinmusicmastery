import Foundation
import ScoreModel

// Port of `lib/play-sense/score-to-exercise.ts` — convert a PlaySense Studio
// `ScoreDocument` (the notation the admin builds + syncs to video) into the
// `ExerciseDefinition` the rhythm-highway + grading engine consumes. This is the
// single-source-of-truth bridge: the admin authors ONE score, and the falling-notes
// "rockband" test view is derived from it. Pure function — no I/O.
//
// The exercise timeline is FIXED-BPM: it runs at `score.initialTempo` and deliberately
// ignores per-measure tempo changes (the unified-PlaySense-Studio rule that the highway
// derives a fixed BPM at runtime).

/// Port of `ScoreToExerciseOptions`.
public struct ScoreToExerciseOptions: Codable, Equatable, Sendable {
    /// Which track in the score the student plays/gets graded on. Default 0.
    public var trackIndex: Int?
    /// Difficulty drives the timing tolerance windows. Default `.intermediate`.
    public var difficulty: Difficulty?
    /// Media URL (video/audio) the highway syncs to.
    public var audioUrl: String?
    public var id: String?
    public var title: String?
    public var description: String?

    public init(
        trackIndex: Int? = nil,
        difficulty: Difficulty? = nil,
        audioUrl: String? = nil,
        id: String? = nil,
        title: String? = nil,
        description: String? = nil
    ) {
        self.trackIndex = trackIndex
        self.difficulty = difficulty
        self.audioUrl = audioUrl
        self.id = id
        self.title = title
        self.description = description
    }
}

/// Port of `INSTRUMENT_MAP` — score-model instrument → play-sense engine instrument.
private let instrumentMap: [ScoreModel.Instrument: Instrument] = [
    .guitar: .guitar,
    .bass: .bass,
    .tres: .tres,
    .cuatro: .cuatro,
    .tiple: .guitar,
    .ukulele: .guitar,
    .mandolin: .guitar,
    .piano: .piano,
    .staff: .piano,
    .percConga: .conga,
    .percBongo: .bongo,
    .percTimbal: .timbale,
    .percClave: .clave,
    .percKit: .conga // no kit in the play-sense vocabulary; nearest fallback
]

/// Port of `STROKE_INFO` — per-stroke (by `PercStroke.id`) technique + drum surface for
/// percussion grading. Surfaces follow `playsense-mappings.ts` (conga:
/// quinto/conga/tumba, timbale: macho/hembra/cascara/…).
private let strokeInfo: [String: (technique: Technique, surface: String)] = [
    // conga
    "open-high": (technique: .open, surface: "quinto"),
    "slap": (technique: .slap, surface: "quinto"),
    "open-low": (technique: .open, surface: "conga"),
    "mute": (technique: .mute, surface: "conga"),
    "bass": (technique: .bass, surface: "tumba"),
    // bongo
    "macho-open": (technique: .open, surface: "macho"),
    "macho-slap": (technique: .slap, surface: "macho"),
    "hembra-open": (technique: .open, surface: "hembra"),
    "hembra-slap": (technique: .slap, surface: "hembra"),
    // timbal
    "cascara": (technique: .shell, surface: "cascara"),
    "high": (technique: .open, surface: "macho"),
    "low": (technique: .open, surface: "hembra"),
    "rim": (technique: .rim, surface: "cencerro"),
    // clave
    "stroke": (technique: .tip, surface: "clave")
]

/// Port of `mapInstrument`.
private func mapInstrument(_ score: ScoreModel.Instrument) -> Instrument {
    instrumentMap[score] ?? .conga
}

// Pitch-spelling tables for `midiToKeyString`'s keyFifths path. Deliberately a tiny local
// copy of `score-to-vexflow.ts`'s tables rather than a dependency on NotationEngraving's
// full port (`EventDescriptor.midiToKeyString`): PlaySenseCore is a pure-logic target and
// must not pull in the engraving module (Bravura font resources et al.) for two arrays.
private let sharpNames = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]
private let flatNames = ["c", "db", "d", "eb", "e", "f", "gb", "g", "ab", "a", "bb", "b"]

/// Port of the `midiToKeyString(midi, { keyFifths })` call path used by
/// `score-to-exercise.ts` (the `spellingHint` branch is never taken there).
private func midiToKeyString(_ midi: Int, keyFifths: Int) -> String {
    let pitchClass = ((midi % 12) + 12) % 12
    let octave = Int((Double(midi) / 12).rounded(.down)) - 1
    let table = keyFifths < 0 ? flatNames : sharpNames
    return "\(table[pitchClass])/\(octave)"
}

/// Port of the file-private `midiToNoteName(midi, keyFifths)` in `score-to-exercise.ts` —
/// MIDI → display note name like "C4" / "Eb3" (derived from the VexFlow key string).
private func midiToNoteName(_ midi: Int, keyFifths: Int) -> String {
    let key = midiToKeyString(midi, keyFifths: keyFifths) // e.g. "c#/4"
    let parts = key.split(separator: "/", maxSplits: 1)
    let pitch = String(parts[0])
    let octave = parts.count > 1 ? String(parts[1]) : ""
    return pitch.prefix(1).uppercased() + pitch.dropFirst() + octave
}

// Faithful port of a long TS function; splitting it would obscure the line-for-line mapping.
// swiftlint:disable function_body_length cyclomatic_complexity

/// Port of `scoreToExerciseDefinition` — build an `ExerciseDefinition` from one track of
/// a score. Rests advance the cursor but emit no event. Chords emit one event per note.
public func scoreToExerciseDefinition(
    _ score: ScoreDocument,
    options: ScoreToExerciseOptions = ScoreToExerciseOptions()
) -> ExerciseDefinition {
    let trackIndex = options.trackIndex ?? 0
    let track: Track? = score.tracks.indices.contains(trackIndex) ? score.tracks[trackIndex] : score.tracks.first

    guard let track else {
        return ExerciseDefinition(
            id: options.id ?? "score-exercise",
            title: options.title ?? score.title,
            description: options.description ?? "",
            instrument: .conga,
            bpm: score.initialTempo,
            timeSignature: score.initialTimeSignature,
            swing: 0,
            difficulty: options.difficulty ?? .intermediate,
            measures: 0,
            loopCount: 1,
            events: [],
            audioUrl: options.audioUrl
        )
    }

    let instrument = mapInstrument(track.instrument)
    let perc = PercStrokes.isPercussion(track.instrument)
    var events: [ExerciseEvent] = []

    var currentTimeSig = score.initialTimeSignature
    var currentKeyFifths = score.initialKeyFifths
    var hand: Hand = .right
    var chordCounter = 0

    for measure in track.measures {
        if let timeSignature = measure.timeSignature { currentTimeSig = timeSignature }
        if let keyFifths = measure.keyFifths { currentKeyFifths = keyFifths }
        let beatQN = ScoreTime.beatLengthInQN(currentTimeSig)

        // Use the first voice for grading (v1 supports up to 2; the melody/primary voice
        // is voice 1).
        guard let voice = measure.voices.first(where: { $0.number == 1 }) ?? measure.voices.first else {
            continue
        }

        var qnIntoMeasure = 0.0
        for event in voice.events {
            let durationQN = event.durationQN
            if case .rest = event {
                qnIntoMeasure += durationQN
                continue
            }

            let beat = qnIntoMeasure / beatQN + 1
            let durationBeats = durationQN / beatQN
            let accent = event.articulation == .accent

            let midis: [Int]
            switch event {
            case .chord(let chord): midis = chord.notes.map(\.midi)
            case .note(let note): midis = [note.midi]
            case .rest: continue // unreachable — rests handled above
            }

            // Tag pitched chords so the scorer can grade the notes as one set. The notes
            // still emit as separate events (cardinality/rendering unchanged) — only
            // grading uses the shared id. Single notes and percussion get none.
            var chordId: String?
            if case .chord = event, !perc, midis.count > 1 {
                chordId = "c\(chordCounter)"
                chordCounter += 1
            }

            for midi in midis {
                let vexKey: String
                var technique: Technique = .open
                var surface: String?
                var expectedPitch: Int?
                var expectedNoteName: String?

                if perc {
                    let strokeData = PercStrokes.stroke(for: track.instrument, midi: midi)
                    vexKey = strokeData?.staffLine ?? "g/5"
                    let info = strokeData.flatMap { strokeInfo[$0.id] }
                    technique = info?.technique ?? .open
                    surface = info?.surface
                } else {
                    vexKey = midiToKeyString(midi, keyFifths: currentKeyFifths)
                    expectedPitch = midi
                    expectedNoteName = midiToNoteName(midi, keyFifths: currentKeyFifths)
                }

                events.append(ExerciseEvent(
                    beat: beat,
                    measure: measure.number,
                    instrument: instrument,
                    technique: technique,
                    hand: hand,
                    duration: durationBeats,
                    vexKey: vexKey,
                    accent: accent,
                    expectedPitch: expectedPitch,
                    expectedNoteName: expectedNoteName,
                    surface: surface,
                    chordId: chordId
                ))
            }

            // Alternate hands per struck event for natural sticking/stem direction.
            hand = hand == .right ? .left : .right
            qnIntoMeasure += durationQN
        }
    }

    return ExerciseDefinition(
        id: options.id ?? "score-exercise",
        title: options.title ?? score.title,
        description: options.description ?? "",
        instrument: instrument,
        bpm: score.initialTempo,
        timeSignature: score.initialTimeSignature,
        swing: 0,
        difficulty: options.difficulty ?? .intermediate,
        measures: track.measures.count,
        loopCount: 1,
        events: events,
        audioUrl: options.audioUrl
    )
}
// swiftlint:enable function_body_length cyclomatic_complexity
