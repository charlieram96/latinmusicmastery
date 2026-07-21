import Foundation
import PlaySenseCore
import ScoreModel
import XCTest

@testable import LMMData

/// Covers both ``ExerciseLoader`` entry points — a standalone ``PlaySenseSong`` and a class-item score
/// document id — plus the not-found error path. Uses in-memory fakes; the score → exercise mapping itself
/// is golden-tested in `PlaySenseCoreTests`, so this only pins the loader's routing/option-passing.
final class ExerciseLoaderTests: XCTestCase {

    private func emptyScore(title: String) -> ScoreDocument {
        ScoreDocument(
            title: title,
            sourceFormat: .native,
            initialTempo: 96,
            initialTimeSignature: TimeSignature(numerator: 3, denominator: 4),
            initialKeyFifths: 0,
            tracks: []
        )
    }

    func testLoadsExerciseForSong() async throws {
        let docId = UUID()
        let songId = UUID()
        let loader = ExerciseLoader(
            scoreRepository: FakeScoreRepository(documents: [docId: emptyScore(title: "Guajira")]),
            songRepository: FakeSongRepository(songs: [])
        )
        let song = PlaySenseSong(
            id: songId,
            scoreDocumentId: docId,
            title: "Guajira Song",
            difficulty: .advanced,
            trackIndex: 2,
            isPublished: true,
            orderIndex: 0
        )

        let exercise = try await loader.exercise(for: song)

        XCTAssertEqual(exercise.id, songId.uuidString, "song id flows into the ExerciseDefinition id")
        XCTAssertEqual(exercise.title, "Guajira Song")
        XCTAssertEqual(exercise.difficulty, .advanced)
        XCTAssertEqual(exercise.bpm, 96)
        XCTAssertEqual(exercise.timeSignature.numerator, 3)
    }

    func testLoadsExerciseForClassItemScoreDocument() async throws {
        let docId = UUID()
        let loader = ExerciseLoader(
            scoreRepository: FakeScoreRepository(documents: [docId: emptyScore(title: "Son Montuno")])
        )

        let exercise = try await loader.exercise(
            scoreDocumentId: docId,
            trackIndex: 0,
            difficulty: .beginner,
            id: "class-item-1",
            title: "Exercise 1"
        )

        XCTAssertEqual(exercise.id, "class-item-1")
        XCTAssertEqual(exercise.title, "Exercise 1")
        XCTAssertEqual(exercise.difficulty, .beginner)
    }

    func testMissingScoreDocumentThrows() async {
        let loader = ExerciseLoader(scoreRepository: FakeScoreRepository(documents: [:]))
        let missing = UUID()
        do {
            _ = try await loader.exercise(scoreDocumentId: missing)
            XCTFail("expected scoreDocumentNotFound")
        } catch let error as ExerciseLoader.LoaderError {
            XCTAssertEqual(error, .scoreDocumentNotFound(missing))
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    func testPublishedSongsEmptyWithoutSongRepository() async throws {
        let loader = ExerciseLoader(scoreRepository: FakeScoreRepository(documents: [:]))
        let songs = try await loader.publishedSongs()
        XCTAssertTrue(songs.isEmpty)
    }

    func testPublishedSongsFromRepository() async throws {
        let song = PlaySenseSong(
            id: UUID(), scoreDocumentId: UUID(), title: "A", difficulty: .intermediate,
            trackIndex: 0, isPublished: true, orderIndex: 0
        )
        let loader = ExerciseLoader(
            scoreRepository: FakeScoreRepository(documents: [:]),
            songRepository: FakeSongRepository(songs: [song])
        )
        let songs = try await loader.publishedSongs()
        XCTAssertEqual(songs, [song])
    }
}

// MARK: - Fakes

private struct FakeScoreRepository: ScoreRepository {
    let documents: [UUID: ScoreDocument]

    func scoreDocument(id: UUID) async throws -> ScoreDocument? { documents[id] }
    func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection] { [] }
}

private struct FakeSongRepository: PlaySenseSongRepository {
    let songs: [PlaySenseSong]
    func publishedSongs() async throws -> [PlaySenseSong] { songs }
}
