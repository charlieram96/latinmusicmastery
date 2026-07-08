import PlaySenseCore
import ScoreModel
import XCTest

@testable import PlaySenseHighway

/// Ports the web's lane-mapping expectations: instrument → lane count/surfaces, and the
/// `laneForEvent` / `laneColor` vectors.
final class LaneLayoutTests: XCTestCase {

    private func exercise(instrument: PlaySenseCore.Instrument, events: [ExerciseEvent]) -> ExerciseDefinition {
        ExerciseDefinition(
            id: "t", title: "t", description: "", instrument: instrument, bpm: 100,
            timeSignature: TimeSignature(numerator: 4, denominator: 4), swing: 0,
            difficulty: .beginner, measures: 1, loopCount: 1, events: events
        )
    }

    private func event(
        instrument: PlaySenseCore.Instrument, technique: Technique = .open, surface: String? = nil,
        pitch: Int? = nil, noteName: String? = nil
    ) -> ExerciseEvent {
        ExerciseEvent(
            beat: 1, measure: 1, instrument: instrument, technique: technique, hand: .right,
            duration: 1, vexKey: "g/4", accent: false,
            expectedPitch: pitch, expectedNoteName: noteName, surface: surface
        )
    }

    // MARK: - Lanes per instrument

    func testCongaHasThreeSurfaceLanes() {
        let layout = createLaneLayout(exercise(instrument: .conga, events: [event(instrument: .conga)]))
        XCTAssertEqual(layout.kind, .pads)
        XCTAssertEqual(layout.laneCount, 3)
        XCTAssertEqual(layout.laneLabel(0), "QUINTO")
        XCTAssertEqual(layout.laneLabel(1), "CONGA")
        XCTAssertEqual(layout.laneLabel(2), "TUMBA")
    }

    func testTimbaleHasSixSurfaceLanes() {
        let layout = createLaneLayout(exercise(instrument: .timbale, events: [event(instrument: .timbale)]))
        XCTAssertEqual(layout.laneCount, 6)
        XCTAssertEqual(layout.laneLabel(0), "MACHO")
        XCTAssertEqual(layout.laneLabel(5), "CASCARA")
    }

    func testPitchedFallbackWhenNoNotes() {
        // A pitched instrument with no pitch data falls back to low/mid/high.
        let layout = createLaneLayout(exercise(instrument: .trumpet, events: [event(instrument: .trumpet)]))
        XCTAssertEqual(layout.kind, .pads)
        XCTAssertEqual(layout.laneCount, 3)
    }

    func testPianoIsEightyEightLanes() {
        let layout = createLaneLayout(exercise(instrument: .piano, events: [event(instrument: .piano, pitch: 60)]))
        XCTAssertEqual(layout.kind, .piano)
        XCTAssertEqual(layout.laneCount, 88)
    }

    // MARK: - laneForEvent

    func testLaneForEventBySurface() {
        let layout = createLaneLayout(exercise(instrument: .conga, events: [event(instrument: .conga)]))
        XCTAssertEqual(layout.laneForEvent(event(instrument: .conga, surface: "quinto")), 0)
        XCTAssertEqual(layout.laneForEvent(event(instrument: .conga, surface: "conga")), 1)
        XCTAssertEqual(layout.laneForEvent(event(instrument: .conga, surface: "tumba")), 2)
        XCTAssertEqual(layout.laneForEvent(nil), 0)
    }

    func testPianoLaneForEventByPitch() {
        let layout = createLaneLayout(exercise(instrument: .piano, events: [event(instrument: .piano, pitch: 60)]))
        // Middle C (60) → lane 60 - 21 = 39.
        XCTAssertEqual(layout.laneForEvent(event(instrument: .piano, pitch: 60)), 39)
        // A0 (21) → lane 0; clamped below the low bound too.
        XCTAssertEqual(layout.laneForEvent(event(instrument: .piano, pitch: 10)), 0)
    }

    // MARK: - colorForEvent / laneColor

    func testLaneColorVectors() {
        let layout = createLaneLayout(exercise(instrument: .conga, events: [event(instrument: .conga)]))
        XCTAssertEqual(layout.laneColor(0), 0xD54E3F) // quinto
        XCTAssertEqual(layout.laneColor(1), 0xF2A12C) // conga
        XCTAssertEqual(layout.laneColor(2), 0xE0A43B) // tumba
    }

    func testPianoBlackVsWhiteColor() {
        let layout = createLaneLayout(exercise(instrument: .piano, events: [event(instrument: .piano, pitch: 60)]))
        XCTAssertEqual(layout.laneColor(39), HighwayPalette.pianoWhiteNoteColor) // C4 white
        XCTAssertEqual(layout.laneColor(40), HighwayPalette.pianoBlackNoteColor) // C#4 black
    }

    // MARK: - Geometry

    func testPadLaneCenterXSpansCentered() {
        let layout = createLaneLayout(exercise(instrument: .conga, events: [event(instrument: .conga)]))
        layout.resize(width: 1000)
        // span = 820, left = 90, laneWidth = 273.33; lane 0 center = 90 + 136.67 = 226.67.
        XCTAssertEqual(layout.laneCenterX(0), 90 + (820.0 / 3) * 0.5, accuracy: 0.001)
        XCTAssertEqual(layout.laneCenterX(2), 90 + (820.0 / 3) * 2.5, accuracy: 0.001)
    }

    func testNoteNameToMidi() {
        XCTAssertEqual(noteNameToMidi("C4"), 60)
        XCTAssertEqual(noteNameToMidi("A0"), 21)
        XCTAssertEqual(noteNameToMidi("Eb3"), 51)
        XCTAssertNil(noteNameToMidi("nonsense"))
    }
}
