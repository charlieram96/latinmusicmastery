import XCTest

@testable import LMMData
@testable import LMMFeatures
@testable import LMMModels

/// Unit tests for ``ExerciseJamFallbackCard/resolvedAudioURL(item:resolver:)`` — the EXERCISE /
/// JAM_SESSION fallback's backing-audio derivation. This must always go through the injected
/// ``MediaURLResolver`` (never read `item.audioUrl` directly) so a future signed-URL resolver
/// applies here too, exactly as ``LessonVideoPlayerView`` already does for video.
final class ExerciseJamFallbackCardTests: XCTestCase {
    func testResolvedAudioURLRoutesThroughResolverNotRawAudioUrl() async {
        let marker = URL(string: "https://cdn.example.com/resolved/marker.m4a")!
        let spy = SpyMediaURLResolver(audioURLToReturn: marker)
        // The raw stored URL deliberately differs from the marker so the assertion fails if the
        // implementation ever reverts to reading `item.audioUrl` directly.
        let item = makeItem(audioUrl: "https://raw.example.com/should-not-be-used.m4a")

        let resolved = await ExerciseJamFallbackCard.resolvedAudioURL(item: item, resolver: spy)

        XCTAssertEqual(resolved, marker)
        let callCount = await spy.resolveAudioCallCount
        XCTAssertEqual(callCount, 1)
        let lastItemId = await spy.lastAudioItemId
        XCTAssertEqual(lastItemId, item.id)
    }

    func testResolvedAudioURLIsNilWhenResolverThrows() async {
        let spy = SpyMediaURLResolver(audioError: MediaURLError.noAudioURL)
        let item = makeItem(audioUrl: nil)

        let resolved = await ExerciseJamFallbackCard.resolvedAudioURL(item: item, resolver: spy)

        XCTAssertNil(resolved)
        let callCount = await spy.resolveAudioCallCount
        XCTAssertEqual(callCount, 1)
    }

    // MARK: Factory

    private func makeItem(audioUrl: String?) -> ClassItem {
        ClassItem(
            id: UUID(), classId: UUID(), itemType: .exercise, title: "Exercise", titleEs: nil,
            description: nil, descriptionEs: nil, orderIndex: 0, richContent: nil,
            videoUrl: nil, videoDurationSeconds: nil, audioUrl: audioUrl, soundsliceEmbedUrl: nil,
            subtitlesEnUrl: nil, subtitlesEsUrl: nil, bpm: nil, keySignature: nil,
            scoreDocumentId: nil, activeTimeMapId: nil, exerciseTimeMapId: nil,
            exerciseVideoUrl: nil, exerciseVideoStartSeconds: 0, question: nil, questionType: nil,
            options: nil, correctAnswer: nil, explanation: nil, createdAt: nil, updatedAt: nil
        )
    }
}

/// Records every call so tests can assert the resolver — not `item.audioUrl` — is the source of
/// the URL handed to the player.
private actor SpyMediaURLResolver: MediaURLResolver {
    private(set) var resolveAudioCallCount = 0
    private(set) var lastAudioItemId: UUID?
    private let audioURLToReturn: URL?
    private let audioError: Error?

    init(audioURLToReturn: URL? = nil, audioError: Error? = nil) {
        self.audioURLToReturn = audioURLToReturn
        self.audioError = audioError
    }

    func resolve(_ item: ClassItem) async throws -> URL {
        throw MediaURLError.noVideoURL
    }

    func resolveAudio(_ item: ClassItem) async throws -> URL {
        resolveAudioCallCount += 1
        lastAudioItemId = item.id
        if let audioError { throw audioError }
        guard let audioURLToReturn else { throw MediaURLError.noAudioURL }
        return audioURLToReturn
    }
}
