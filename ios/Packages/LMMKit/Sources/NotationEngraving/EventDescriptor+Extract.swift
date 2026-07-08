import Foundation
import ScoreModel

/// `extractTrackEvents` and its per-event spelling helpers — the top-level port of
/// `score-to-vexflow.ts`'s `extractTrackEvents`. Split out of `EventDescriptor.swift` so each
/// file stays focused (pure duration/pitch helpers there; track traversal here).
extension EventDescriptorBuilder {
    /// The shared inputs for spelling one voice's events (kept together so the per-event helper
    /// takes a couple of arguments, not a long list).
    struct SpellingContext {
        let percussion: Bool
        let instrument: Instrument
        let keyFifths: Int
    }

    /// Port of `extractTrackEvents` for a single track's voice 1. Produces one
    /// `MeasureDescriptor` per measure, carrying cumulative-QN positions ready for cursor
    /// mapping. Total — never throws (see the note on `voices` below).
    public static func extractTrackEvents(
        track: Track,
        initialTimeSignature: TimeSignature,
        keyFifths: Int = 0
    ) -> [MeasureDescriptor] {
        let percussion = PercStrokes.isPercussion(track.instrument)
        let clef: Clef = percussion ? .percussion : .treble
        let spelling = SpellingContext(percussion: percussion, instrument: track.instrument, keyFifths: keyFifths)

        var result: [MeasureDescriptor] = []
        var cumulativeQN: Double = 0
        var currentTimeSig = initialTimeSignature

        for measure in track.measures {
            if let timeSig = measure.timeSignature { currentTimeSig = timeSig }
            let measureStartQN = cumulativeQN
            // TS reads `measure.voices[0]` unconditionally; a measure with no voices would throw
            // there. Here it lays out as empty (total) rather than trapping.
            let voiceEvents = measure.voices.first?.events ?? []
            let events = descriptors(
                for: voiceEvents,
                measureStartQN: measureStartQN,
                timeSignature: currentTimeSig,
                spelling: spelling
            )
            result.append(MeasureDescriptor(
                measure: measure,
                events: events,
                cumulativeQN: measureStartQN,
                timeSignature: currentTimeSig,
                clef: clef
            ))
            cumulativeQN += 4.0 * Double(currentTimeSig.numerator) / Double(currentTimeSig.denominator)
        }

        return result
    }

    /// Extract the `EventDescriptor`s for one voice's events, accumulating within-measure QN.
    private static func descriptors(
        for voiceEvents: [MusicalEvent],
        measureStartQN: Double,
        timeSignature: TimeSignature,
        spelling: SpellingContext
    ) -> [EventDescriptor] {
        let beatQN = 4.0 / Double(timeSignature.denominator)
        var events: [EventDescriptor] = []
        var qnInMeasure: Double = 0
        for event in voiceEvents {
            events.append(descriptor(
                for: event,
                qnStart: measureStartQN + qnInMeasure,
                beatInMeasure: qnInMeasure / beatQN + 1,
                spelling: spelling
            ))
            qnInMeasure += event.durationQN
        }
        return events
    }

    private static func descriptor(
        for event: MusicalEvent,
        qnStart: Double,
        beatInMeasure: Double,
        spelling: SpellingContext
    ) -> EventDescriptor {
        let dotted = event.dotted ?? false
        let isRest = event.kind == .rest
        var notes: [NoteDescriptor] = []
        var firstMidi: Int?

        switch event {
        case .note(let note):
            firstMidi = note.midi
            notes = [noteDescriptor(midi: note.midi, spellingHint: note.spellingHint, spelling: spelling)]
        case .chord(let chord):
            firstMidi = chord.notes.first?.midi
            notes = chord.notes.map {
                noteDescriptor(midi: $0.midi, spellingHint: $0.spellingHint, spelling: spelling)
            }
        case .rest:
            notes = []
        }

        return EventDescriptor(
            kind: event.kind,
            qnStart: qnStart,
            durationQN: event.durationQN,
            beatInMeasure: beatInMeasure,
            durationCode: durationCode(durationQN: event.durationQN, dotted: dotted),
            isRest: isRest,
            dotted: dotted,
            notes: notes,
            midi: firstMidi,
            triplet: event.triplet ?? false,
            tieToNext: event.tieToNext ?? false,
            articulation: isRest ? nil : event.articulation
        )
    }

    /// Build a single `NoteDescriptor` — the percussion path resolves the stroke's staff line
    /// + `'x'` notehead; the pitched path spells the MIDI and extracts the accidental.
    private static func noteDescriptor(midi: Int, spellingHint: String?, spelling: SpellingContext) -> NoteDescriptor {
        if spelling.percussion {
            let stroke = PercStrokes.stroke(for: spelling.instrument, midi: midi)
            let key = stroke?.staffLine ?? "c/5"
            return NoteDescriptor(
                staffPosition: staffPosition(forKeyString: key),
                accidental: nil,
                midi: midi,
                // Deliberate improvement over the web renderer, which resolves x-vs-normal
                // notehead once per CHORD (from the first note's stroke type) and applies it to
                // every notehead in that chord. Resolving it per NOTE here means a mixed-stroke
                // percussion chord (e.g. an open tone plus a slap) engraves each notehead with
                // its own correct glyph instead of forcing the whole chord to match the first
                // note. Documented in the C14 report.
                isCross: stroke?.noteType == .xNotehead,
                keyString: key
            )
        }
        let key = midiToKeyString(midi: midi, spellingHint: spellingHint, keyFifths: spelling.keyFifths)
        return NoteDescriptor(
            staffPosition: staffPosition(forKeyString: key),
            accidental: extractAccidental(key),
            midi: midi,
            isCross: false,
            keyString: key
        )
    }
}
