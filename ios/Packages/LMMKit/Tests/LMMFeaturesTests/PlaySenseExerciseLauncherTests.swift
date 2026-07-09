@testable import LMMData
@testable import LMMModels
import PlaySenseCore
import ScoreModel
import SwiftUI
import XCTest

@testable import LMMFeatures

/// D26 web-parity coverage: finishing/loading a PlaySense EXERCISE session must never itself mark
/// `class_item_progress` complete — on the web, `ScoreExerciseGame`/`ExerciseView` never call
/// `markClassItemComplete` (only the generic "Mark as completed" footer button and, separately, a
/// finished comprehension quiz do). This proves the iOS launcher — now released in ALL builds,
/// not just DEBUG — never touches `ProgressRepository` while resolving/showing the stage, using a
/// `RecordingProgressRepository` that fails the test the instant `markComplete` is called.
@MainActor
final class PlaySenseExerciseLauncherTests: XCTestCase {
    func testLoadingAScoredExerciseNeverMarksClassItemComplete() async throws {
        let docId = UUID()
        let scoreRepo = RecordingScoreRepository(document: Self.emptyScore, documentId: docId)
        let progressRepo = RecordingProgressRepository()
        let services = AppServices(
            catalog: ThrowingCatalogRepository(),
            progress: progressRepo,
            entitlements: ThrowingEntitlementsRepository(),
            quiz: ThrowingQuizRepository(),
            score: scoreRepo,
            cache: ResponseCache(),
            mediaResolver: PassthroughMediaURLResolver()
        )

        let item = Self.exerciseItem(scoreDocumentId: docId)
        let body = PlaySenseExerciseLauncher(item: item)
            .environment(services)
            .frame(width: 390, height: 844)

        let host = UIHostingController(rootView: body)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host
        window.makeKeyAndVisible()
        host.beginAppearanceTransition(true, animated: false)
        host.endAppearanceTransition()
        window.layoutIfNeeded()

        await spin(until: { scoreRepo.didLoad }, window: window, timeout: 5)
        await spin(seconds: 0.3, window: window) // give the stage a beat to compose

        XCTAssertTrue(scoreRepo.didLoad, "the exercise load path should have run")
        XCTAssertEqual(
            progressRepo.markCompleteCallCount, 0,
            "PlaySenseExerciseLauncher must never call markComplete — completion stays the generic footer button"
        )

        host.beginAppearanceTransition(false, animated: false)
        host.endAppearanceTransition()
        window.isHidden = true
    }

    // MARK: - Helpers

    private static let emptyScore = ScoreDocument(
        title: "Test", sourceFormat: .native, initialTempo: 100,
        initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
        initialKeyFifths: 0, tracks: []
    )

    private static func exerciseItem(scoreDocumentId: UUID) -> ClassItem {
        ClassItem(
            id: UUID(), classId: UUID(), itemType: .exercise, title: "Test exercise", titleEs: nil,
            description: nil, descriptionEs: nil, orderIndex: 0, richContent: nil,
            videoUrl: nil, videoDurationSeconds: nil,
            audioUrl: nil, soundsliceEmbedUrl: nil, subtitlesEnUrl: nil, subtitlesEsUrl: nil,
            bpm: nil, keySignature: nil, scoreDocumentId: scoreDocumentId, activeTimeMapId: nil,
            exerciseTimeMapId: nil, exerciseVideoUrl: nil, exerciseVideoStartSeconds: 0,
            question: nil, questionType: nil, options: nil, correctAnswer: nil, explanation: nil,
            createdAt: nil, updatedAt: nil
        )
    }

    private func spin(until condition: () -> Bool, window: UIWindow, timeout: TimeInterval) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            window.layoutIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
            await Task.yield()
        }
        window.layoutIfNeeded()
    }

    private func spin(seconds: TimeInterval, window: UIWindow) async {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            window.layoutIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
            await Task.yield()
        }
    }
}

// MARK: - Fakes

private final class RecordingScoreRepository: ScoreRepository, @unchecked Sendable {
    private let document: ScoreDocument
    private let documentId: UUID
    private(set) var didLoad = false

    init(document: ScoreDocument, documentId: UUID) {
        self.document = document
        self.documentId = documentId
    }

    func scoreDocument(id: UUID) async throws -> ScoreDocument? {
        didLoad = true
        return id == documentId ? document : nil
    }

    func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection] { [] }
}

private final class RecordingProgressRepository: ProgressRepository, @unchecked Sendable {
    private(set) var markCompleteCallCount = 0

    func markComplete(itemId: UUID) async throws { markCompleteCallCount += 1 }
    func updatePosition(itemId: UUID, seconds: Int) async throws {}
    func enroll(courseId: UUID) async throws {}
    func myEnrollments() async throws -> [CourseEnrollment] { [] }
    func achievements() async throws -> [UserAchievement] { [] }
}

private struct StubUnused: Error {}

private struct ThrowingCatalogRepository: CatalogRepository {
    func countries() async throws -> [Country] { throw StubUnused() }
    func musicalStyles() async throws -> [MusicalStyle] { throw StubUnused() }
    func publishedCourses() async throws -> [Course] { throw StubUnused() }
    func courseDetail(id: UUID) async throws -> Course? { throw StubUnused() }
    func courseStructure(courseId: UUID) async throws -> CourseStructure { throw StubUnused() }
}

private struct ThrowingEntitlementsRepository: EntitlementsRepository {
    func refresh() async throws -> Entitlements { throw StubUnused() }
}

private struct ThrowingQuizRepository: QuizRepository {
    func questions(classItemId: UUID) async throws -> [QuizQuestion] { throw StubUnused() }
}
