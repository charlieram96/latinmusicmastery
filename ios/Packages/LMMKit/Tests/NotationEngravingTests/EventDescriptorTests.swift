import ScoreModel
import XCTest

@testable import NotationEngraving

/// Port-parity + totality coverage for `EventDescriptorBuilder` — the Swift mirror of the
/// descriptor half of `lib/playsense-studio/score-to-vexflow.ts`.
final class EventDescriptorTests: XCTestCase {
    typealias Builder = EventDescriptorBuilder

    private let fourFour = TimeSignature(numerator: 4, denominator: 4)

    private func extract(_ track: Track) -> [MeasureDescriptor] {
        Builder.extractTrackEvents(track: track, initialTimeSignature: fourFour)
    }

    // MARK: Duration code (vexflowDurationCode)

    func testDurationCodeExactValues() {
        XCTAssertEqual(Builder.durationCode(durationQN: 4, dotted: false), .whole)
        XCTAssertEqual(Builder.durationCode(durationQN: 2, dotted: false), .half)
        XCTAssertEqual(Builder.durationCode(durationQN: 1, dotted: false), .quarter)
        XCTAssertEqual(Builder.durationCode(durationQN: 0.5, dotted: false), .eighth)
        XCTAssertEqual(Builder.durationCode(durationQN: 0.25, dotted: false), .sixteenth)
        XCTAssertEqual(Builder.durationCode(durationQN: 0.125, dotted: false), .thirtySecond)
        XCTAssertEqual(Builder.durationCode(durationQN: 0.0625, dotted: false), .sixtyFourth)
        XCTAssertEqual(Builder.durationCode(durationQN: 0.03125, dotted: false), .oneTwentyEighth)
    }

    func testDurationCodeDottedReversesToBase() {
        // A dotted quarter is 1.5 QN; base = 1.5 * 2/3 = 1 → quarter.
        XCTAssertEqual(Builder.durationCode(durationQN: 1.5, dotted: true), .quarter)
        // Dotted half = 3 QN; base = 2 → half.
        XCTAssertEqual(Builder.durationCode(durationQN: 3, dotted: true), .half)
        // Dotted eighth = 0.75 QN; base = 0.5 → eighth.
        XCTAssertEqual(Builder.durationCode(durationQN: 0.75, dotted: true), .eighth)
    }

    func testDurationCodeFallbackTotality() {
        // Weird MIDI-import durations must never throw — nearest power of 2 (matches TS).
        XCTAssertEqual(Builder.durationCode(durationQN: 3, dotted: false), .whole)     // round(log2 3)=2 → 'w'
        XCTAssertEqual(Builder.durationCode(durationQN: 0.4, dotted: false), .eighth)  // round(log2 .4)=-1 → '8'
        XCTAssertEqual(Builder.durationCode(durationQN: 1.4, dotted: false), .quarter) // round(log2 1.4)=0 → 'q'
        XCTAssertEqual(Builder.durationCode(durationQN: 100, dotted: false), .whole)   // huge → 'w'
        XCTAssertEqual(Builder.durationCode(durationQN: 0.0001, dotted: false), .oneTwentyEighth)
    }

    func testDurationCodeDegenerateInputsAreTotal() {
        // Zero / negative / NaN never trap; +infinity maps to whole (matches JS log2 arithmetic).
        XCTAssertEqual(Builder.durationCode(durationQN: 0, dotted: false), .oneTwentyEighth)
        XCTAssertEqual(Builder.durationCode(durationQN: -1, dotted: false), .oneTwentyEighth)
        XCTAssertEqual(Builder.durationCode(durationQN: .nan, dotted: false), .oneTwentyEighth)
        XCTAssertEqual(Builder.durationCode(durationQN: .infinity, dotted: false), .whole)
    }

    // MARK: midiToKeyString

    func testMidiToKeyStringSharpKeyPrefersSharps() {
        // keyFifths >= 0 → sharps. 61 = C#4, 66 = F#4.
        XCTAssertEqual(Builder.midiToKeyString(midi: 60, spellingHint: nil, keyFifths: 2), "c/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 61, spellingHint: nil, keyFifths: 2), "c#/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 66, spellingHint: nil, keyFifths: 2), "f#/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 72, spellingHint: nil, keyFifths: 0), "c/5")
    }

    func testMidiToKeyStringFlatKeyPrefersFlats() {
        // keyFifths < 0 → flats. 61 = Db4, 70 = Bb4.
        XCTAssertEqual(Builder.midiToKeyString(midi: 61, spellingHint: nil, keyFifths: -2), "db/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 63, spellingHint: nil, keyFifths: -2), "eb/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 70, spellingHint: nil, keyFifths: -2), "bb/4")
    }

    func testMidiToKeyStringSpellingHintOverrides() {
        XCTAssertEqual(Builder.midiToKeyString(midi: 61, spellingHint: "Db", keyFifths: 2), "db/4")
        XCTAssertEqual(Builder.midiToKeyString(midi: 66, spellingHint: "F#", keyFifths: -2), "f#/4")
        // Explicit octave in the hint wins.
        XCTAssertEqual(Builder.midiToKeyString(midi: 61, spellingHint: "C#3", keyFifths: 0), "c#/3")
        // A hint that doesn't match the anchored regex falls back to the table.
        XCTAssertEqual(Builder.midiToKeyString(midi: 61, spellingHint: "nonsense", keyFifths: 0), "c#/4")
    }

    // MARK: extractAccidental (incl. the faithful web quirk)

    func testExtractAccidental() {
        XCTAssertEqual(Builder.extractAccidental("c#/4"), .sharp)
        XCTAssertEqual(Builder.extractAccidental("db/4"), .flat)
        XCTAssertEqual(Builder.extractAccidental("c/4"), nil)
        XCTAssertEqual(Builder.extractAccidental("g/5"), nil)
    }

    func testExtractAccidentalBNaturalWebQuirk() {
        // A B-natural key ("b/4") contains the letter 'b', which the ported (verbatim) rule
        // reads as a flat — the exact latent behavior of score-to-vexflow.ts. Locked in as a
        // regression guard so a "fix" here is a deliberate, reviewed change (see C14 report).
        XCTAssertEqual(Builder.extractAccidental("b/4"), .flat)
    }

    // MARK: staffPosition (diatonic math, treble reference)

    func testStaffPositionTrebleReference() {
        XCTAssertEqual(Builder.staffPosition(forKeyString: "e/4"), 0)  // bottom line
        XCTAssertEqual(Builder.staffPosition(forKeyString: "f/4"), 1)  // first space
        XCTAssertEqual(Builder.staffPosition(forKeyString: "g/4"), 2)
        XCTAssertEqual(Builder.staffPosition(forKeyString: "b/4"), 4)  // middle line
        XCTAssertEqual(Builder.staffPosition(forKeyString: "c/5"), 5)
        XCTAssertEqual(Builder.staffPosition(forKeyString: "f/5"), 8)  // top line
        XCTAssertEqual(Builder.staffPosition(forKeyString: "c/4"), -2) // middle C, 1 ledger below
    }

    func testStaffPositionIgnoresAccidental() {
        // The accidental never shifts the diatonic position (VexFlow behavior).
        XCTAssertEqual(Builder.staffPosition(forKeyString: "c#/4"), Builder.staffPosition(forKeyString: "c/4"))
        XCTAssertEqual(Builder.staffPosition(forKeyString: "eb/4"), Builder.staffPosition(forKeyString: "e/4"))
    }

    func testStaffPositionMalformedFallsBackToMiddleLine() {
        XCTAssertEqual(Builder.staffPosition(forKeyString: "garbage"), 4)
        XCTAssertEqual(Builder.staffPosition(forKeyString: ""), 4)
    }

    // MARK: Percussion mappings

    func testPercussionStrokeMappingsIncludingXNoteheads() {
        let track = percussionTrack(instrument: .percConga, midis: [64, 62, 63, 61, 60])
        let events = extract(track).first?.events ?? []
        guard events.count == 5 else { return XCTFail("expected 5 percussion events") }

        // 64 open-high g/5 (normal); 62 slap g/5 (x); 63 open-low e/5 (normal);
        // 61 mute d/5 (x); 60 bass c/5 (normal). staffLine → treble position.
        XCTAssertEqual(events[0].notes.first?.staffPosition, Builder.staffPosition(forKeyString: "g/5"))
        XCTAssertEqual(events[0].notes.first?.isCross, false)
        XCTAssertEqual(events[1].notes.first?.isCross, true)  // slap
        XCTAssertEqual(events[3].notes.first?.isCross, true)  // mute
        XCTAssertEqual(events[4].notes.first?.staffPosition, Builder.staffPosition(forKeyString: "c/5"))
        // Percussion notes never carry a spelled accidental.
        XCTAssertTrue(events.allSatisfy { $0.notes.allSatisfy { $0.accidental == nil } })
    }

    func testPercussionUnknownMidiFallsBackToC5() {
        let measures = extract(percussionTrack(instrument: .percConga, midis: [999]))
        let position = measures.first?.events.first?.notes.first?.staffPosition
        XCTAssertEqual(position, Builder.staffPosition(forKeyString: "c/5"))
        XCTAssertEqual(measures.first?.clef, .percussion)
    }

    // MARK: Chords + rests + cumulative QN

    func testChordProducesStackedNoteDescriptors() {
        let chord = MusicalEvent.chord(Chord(durationQN: 1, notes: [
            ChordNote(midi: 60), ChordNote(midi: 64), ChordNote(midi: 67)
        ]))
        let events = extract(pitchedTrack(events: [chord])).first?.events
        XCTAssertEqual(events?.first?.notes.count, 3)
        XCTAssertEqual(events?.first?.midi, 60) // first authored note
        XCTAssertEqual(events?.first?.kind, .chord)
    }

    func testRestHasNoNotesAndNoMidi() {
        let track = pitchedTrack(events: [.rest(Rest(durationQN: 2))])
        let event = extract(track).first?.events.first
        XCTAssertEqual(event?.isRest, true)
        XCTAssertEqual(event?.notes.count, 0)
        XCTAssertNil(event?.midi ?? nil)
        XCTAssertEqual(event?.durationCode, .half)
    }

    func testCumulativeQNAccumulatesAcrossMeasures() {
        let measure1 = Measure(number: 1, voices: [Voice(number: 1, events: (0..<4).map { _ in
            MusicalEvent.note(Note(durationQN: 1, midi: 60))
        })])
        let measure2 = Measure(number: 2, voices: [Voice(number: 1, events: (0..<4).map { _ in
            MusicalEvent.note(Note(durationQN: 1, midi: 62))
        })])
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil, stringMultiplicity: 1,
            channel: 0, defaultView: .staff, measures: [measure1, measure2]
        )
        let measures = extract(track)
        XCTAssertEqual(measures[0].cumulativeQN, 0)
        XCTAssertEqual(measures[1].cumulativeQN, 4)
        XCTAssertEqual(measures[0].events.map(\.qnStart), [0, 1, 2, 3])
        XCTAssertEqual(measures[1].events.map(\.qnStart), [4, 5, 6, 7])
        // beatInMeasure resets each measure (downbeat = 1).
        XCTAssertEqual(measures[1].events.map(\.beatInMeasure), [1, 2, 3, 4])
    }

    func testEmptyVoicesLaysOutAsEmptyNotThrow() {
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil, stringMultiplicity: 1,
            channel: 0, defaultView: .staff, measures: [Measure(number: 1, voices: [])]
        )
        let measures = extract(track)
        XCTAssertEqual(measures.count, 1)
        XCTAssertEqual(measures.first?.events.count, 0)
    }

    // MARK: Helpers

    private func percussionTrack(instrument: Instrument, midis: [Int]) -> Track {
        let events = midis.map { MusicalEvent.note(Note(durationQN: 0.5, midi: $0)) }
        let voice = Voice(number: 1, events: events)
        return Track(
            index: 0, instrument: instrument, displayName: "Perc", tuning: nil, stringMultiplicity: 1,
            channel: 9, defaultView: .rhythmGrid, measures: [Measure(number: 1, voices: [voice])]
        )
    }

    private func pitchedTrack(events: [MusicalEvent]) -> Track {
        Track(index: 0, instrument: .guitar, displayName: "G", tuning: nil, stringMultiplicity: 1, channel: 0,
              defaultView: .staff, measures: [Measure(number: 1, voices: [Voice(number: 1, events: events)])])
    }
}
