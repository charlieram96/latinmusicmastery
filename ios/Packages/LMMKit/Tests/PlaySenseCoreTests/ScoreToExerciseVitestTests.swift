import Foundation
import ScoreModel
import XCTest

@testable import PlaySenseCore

/// Port of `lib/play-sense/__tests__/score-to-exercise.test.ts`, case-for-case. The input
/// scores are the same handwritten fixtures (committed for the C12 round-trip suite in
/// `ScoreModelTests/Fixtures`) the vitest suite builds from `score-fixtures.ts`.
final class ScoreToExerciseVitestTests: XCTestCase {
    private func loadScore(_ filename: String) throws -> ScoreDocument {
        try JSONDecoder().decode(ScoreDocument.self, from: FixtureLoader.scoreModelFixtureData(filename))
    }

    // MARK: guitar (pitched)

    func testCarriesTempoTimeSignatureAndMeasureCountFromTheScore() throws {
        let exercise = scoreToExerciseDefinition(
            try loadScore("guitar_lick_fixture.json"),
            options: ScoreToExerciseOptions(audioUrl: "v.mp4")
        )
        XCTAssertEqual(exercise.bpm, 120)
        XCTAssertEqual(exercise.timeSignature, TimeSignature(numerator: 4, denominator: 4))
        XCTAssertEqual(exercise.measures, 2)
        XCTAssertEqual(exercise.instrument, .guitar)
        XCTAssertEqual(exercise.audioUrl, "v.mp4")
    }

    func testEmitsOneEventPerNote() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("guitar_lick_fixture.json"))
        XCTAssertEqual(exercise.events.count, 8)
    }

    func testPlacesQuarterNotesOnBeats1To4OfEachMeasure() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("guitar_lick_fixture.json"))
        let measure1 = exercise.events.filter { $0.measure == 1 }
        XCTAssertEqual(measure1.map(\.beat), [1, 2, 3, 4])
        XCTAssertTrue(measure1.allSatisfy { $0.duration == 1 })
    }

    func testSetsExpectedPitchAndNoteNameForPitchedNotes() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("guitar_lick_fixture.json"))
        XCTAssertEqual(exercise.events[0].expectedPitch, 60) // C4
        XCTAssertEqual(exercise.events[0].expectedNoteName, "C4")
        XCTAssertEqual(exercise.events[0].vexKey, "c/4")
        XCTAssertNil(exercise.events[0].surface)
    }

    // MARK: conga (percussion)

    func testMapsPercCongaToConga() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("conga_tumbao_fixture.json"))
        XCTAssertEqual(exercise.instrument, .conga)
        XCTAssertEqual(exercise.bpm, 100)
    }

    func testEmitsSixStruckEventsPerBarSkippingRests() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("conga_tumbao_fixture.json"))
        XCTAssertEqual(exercise.events.count, 12)
    }

    func testPlacesEighthNotesOnTheRightSubBeats() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("conga_tumbao_fixture.json"))
        let measure1 = exercise.events.filter { $0.measure == 1 }
        XCTAssertEqual(measure1.map(\.beat), [1, 2, 2.5, 3, 4, 4.5])
        XCTAssertTrue(measure1.allSatisfy { $0.duration == 0.5 })
    }

    func testMapsStrokesToTechniqueAndDrumSurface() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("conga_tumbao_fixture.json"))
        let measure1 = exercise.events.filter { $0.measure == 1 }
        // slap (62) on beat 1
        XCTAssertEqual(measure1[0].technique, .slap)
        XCTAssertEqual(measure1[0].surface, "quinto")
        XCTAssertEqual(measure1[0].vexKey, "g/5")
        // open high (64) on beat 2
        XCTAssertEqual(measure1[1].technique, .open)
        XCTAssertEqual(measure1[1].surface, "quinto")
        // open-low (63) on beat 3 → conga surface
        XCTAssertEqual(measure1[3].surface, "conga")
        // percussion has no pitch
        XCTAssertNil(measure1[0].expectedPitch)
    }

    // MARK: track selection

    func testSelectsTheRequestedTrackFromAMultiTrackScore() throws {
        let exercise = scoreToExerciseDefinition(
            try loadScore("son_montuno_fixture.json"),
            options: ScoreToExerciseOptions(trackIndex: 1)
        )
        XCTAssertEqual(exercise.instrument, .bass)
        // bass plays 2 notes per bar across 4 bars = 8 events
        XCTAssertEqual(exercise.events.count, 8)
        XCTAssertTrue(exercise.events.allSatisfy { $0.expectedPitch != nil })
    }

    func testDefaultsToTrack0AndExpandsChordsToOneEventPerNote() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("son_montuno_fixture.json"))
        XCTAssertEqual(exercise.instrument, .tres)
        // each bar: 2 chords of 3 notes = 6 events, x4 bars = 24
        XCTAssertEqual(exercise.events.count, 24)
    }

    func testTagsTheThreeNotesOfEachChordWithASharedChordId() throws {
        let exercise = scoreToExerciseDefinition(try loadScore("son_montuno_fixture.json"))
        // Every event belongs to a chord here, so all carry a chordId.
        XCTAssertTrue(exercise.events.allSatisfy { $0.chordId != nil })
        // 24 events / 3 notes per chord = 8 distinct chord groups.
        let groups = Set(exercise.events.compactMap(\.chordId))
        XCTAssertEqual(groups.count, 8)
        // Each group has exactly 3 notes.
        for group in groups {
            XCTAssertEqual(exercise.events.filter { $0.chordId == group }.count, 3)
        }
    }
}
