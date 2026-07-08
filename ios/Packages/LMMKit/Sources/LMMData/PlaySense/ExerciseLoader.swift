import Foundation
import PlaySenseCore

/// Builds the ``ExerciseDefinition`` a PlaySense session grades against, from either of the two
/// score-backed sources the plan calls out:
///
///  1. a standalone published ``PlaySenseSong`` (its `score_document_id`), or
///  2. a `class_items.score_document_id` (a course EXERCISE item).
///
/// Both resolve a `ScoreDocument` via ``ScoreRepository`` and run the shared
/// `scoreToExerciseDefinition` bridge — the same single-source-of-truth conversion the web + studio use.
/// Pure orchestration over the repository; no Supabase types leak out.
public struct ExerciseLoader: Sendable {
    private let scoreRepository: ScoreRepository
    private let songRepository: PlaySenseSongRepository?

    public enum LoaderError: Error, Equatable {
        case scoreDocumentNotFound(UUID)
    }

    public init(scoreRepository: ScoreRepository, songRepository: PlaySenseSongRepository? = nil) {
        self.scoreRepository = scoreRepository
        self.songRepository = songRepository
    }

    /// Entry point 1 — the published standalone songs catalog. Empty when no song repository is wired.
    public func publishedSongs() async throws -> [PlaySenseSong] {
        guard let songRepository else { return [] }
        return try await songRepository.publishedSongs()
    }

    /// Build the graded exercise for a standalone song.
    public func exercise(for song: PlaySenseSong) async throws -> ExerciseDefinition {
        try await exercise(
            scoreDocumentId: song.scoreDocumentId,
            trackIndex: song.trackIndex,
            difficulty: song.difficulty,
            id: song.id.uuidString,
            title: song.title
        )
    }

    /// Entry point 2 — a course EXERCISE item (or any score document id). `trackIndex`/`difficulty` default
    /// to the `scoreToExerciseDefinition` defaults (track 0, intermediate).
    public func exercise(
        scoreDocumentId: UUID,
        trackIndex: Int = 0,
        difficulty: Difficulty = .intermediate,
        audioUrl: String? = nil,
        id: String? = nil,
        title: String? = nil
    ) async throws -> ExerciseDefinition {
        guard let document = try await scoreRepository.scoreDocument(id: scoreDocumentId) else {
            throw LoaderError.scoreDocumentNotFound(scoreDocumentId)
        }
        return scoreToExerciseDefinition(document, options: ScoreToExerciseOptions(
            trackIndex: trackIndex,
            difficulty: difficulty,
            audioUrl: audioUrl,
            id: id,
            title: title
        ))
    }
}
