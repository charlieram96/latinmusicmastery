import XCTest

@testable import ScoreModel

/// Case-for-case port of `components/playsense-studio/shared/__tests__/serialization.test.ts`.
/// Test names mirror the `it(...)` descriptions from that file.
final class SerializationTests: XCTestCase {
    private func loadFixture(_ filename: String) throws -> ScoreDocument {
        try ScoreDocument.parse(FixtureLoader.data(filename))
    }

    // MARK: - parseScoreDocument — fixtures round-trip

    func testGuitarLickFixtureParsesAndReSerializes() throws {
        let fixture = try loadFixture("guitar_lick_fixture.json")
        let parsed = try ScoreDocument.parse(fixture.serialized())
        XCTAssertEqual(parsed.title, "C Major Scale Ascending")
        XCTAssertEqual(parsed.tracks.count, 1)
        XCTAssertEqual(parsed.tracks[0].measures.count, 2)
    }

    func testCongaTumbaoFixtureParsesWithRhythmGridDefaultView() throws {
        let fixture = try loadFixture("conga_tumbao_fixture.json")
        let parsed = try ScoreDocument.parse(fixture.serialized())
        XCTAssertEqual(parsed.tracks[0].defaultView, .rhythmGrid)
        XCTAssertEqual(parsed.tracks[0].instrument, .percConga)
    }

    func testSonMontunoFixtureParsesWithMultipleTracksAndTempoChange() throws {
        let fixture = try loadFixture("son_montuno_fixture.json")
        let parsed = try ScoreDocument.parse(fixture.serialized())
        XCTAssertEqual(parsed.tracks.count, 3)
        XCTAssertEqual(parsed.tracks[0].measures[2].tempoChange, 110)
    }

    // MARK: - parseScoreDocument — rejection paths

    func testRejectsUnknownSchemaVersion() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        bad.schemaVersion = 99
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            guard let validationError = error as? ScoreDocumentValidationError else {
                return XCTFail("expected ScoreDocumentValidationError, got \(error)")
            }
            XCTAssertTrue(validationError.isUnsupportedSchemaVersion)
        }
    }

    func testRejectsNegativeTempo() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        bad.initialTempo = -120
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }

    func testRejectsMidiOutOfRange() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        guard case .note(var note) = bad.tracks[0].measures[0].voices[0].events[0] else {
            return XCTFail("expected the first event to be a note")
        }
        note.midi = 200
        bad.tracks[0].measures[0].voices[0].events[0] = .note(note)
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }

    func testRejectsEmptyTracksArray() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        bad.tracks = []
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }

    func testRejectsEmptyVoicesInAMeasure() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        bad.tracks[0].measures[0].voices = []
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }

    func testRejectsKeySignatureOutsideRange() throws {
        var bad = try loadFixture("guitar_lick_fixture.json")
        bad.initialKeyFifths = 8
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }

    // MARK: - parseScoreDocument — discriminated union

    func testAcceptsAChordEventWithAtLeastTwoNotes() throws {
        let parsed = try loadFixture("son_montuno_fixture.json")
        let firstEvent = parsed.tracks[0].measures[0].voices[0].events[0]
        XCTAssertEqual(firstEvent.kind, .chord)
    }

    func testRejectsChordEventsWithOnlyOneNote() throws {
        var bad = try loadFixture("son_montuno_fixture.json")
        guard case .chord(var chord) = bad.tracks[0].measures[0].voices[0].events[0] else {
            return XCTFail("expected the first event to be a chord")
        }
        chord.notes = [ChordNote(midi: 60)]
        bad.tracks[0].measures[0].voices[0].events[0] = .chord(chord)
        XCTAssertThrowsError(try ScoreDocument.parse(bad.serialized())) { error in
            XCTAssertTrue(error is ScoreDocumentValidationError)
        }
    }
}
