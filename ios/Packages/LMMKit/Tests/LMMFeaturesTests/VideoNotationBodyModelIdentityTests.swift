@testable import LMMData
@testable import LMMModels
import ScoreModel
import SwiftUI
import TimeMapKit
import XCTest

@testable import LMMFeatures

/// Regression guard for the C18 player-remount bug: when a scored lesson's sections finish
/// loading, the `LessonVideoPlayerView` must NOT be torn down and rebuilt (which would re-resolve
/// the URL and visibly reload/re-buffer the video). We prove it by counting model constructions —
/// the player builds exactly one ``LessonVideoPlayerModel`` per lesson, and section arrival (which
/// flips the layout from plain video to stacked video+notation) must not bump that count.
@MainActor
final class VideoNotationBodyModelIdentityTests: XCTestCase {
    func testOpeningScoredLessonConstructsExactlyOneModel() async throws {
        LessonVideoPlayerModel.debugInitCount = 0

        let score = SectionScoreStub.stub
        let section = HydratedScoreSection(
            section: ScoreSection(
                id: UUID(), classItemId: UUID(), scoreDocumentId: UUID(),
                activeTimeMapId: nil, draftTimeMapId: nil, sectionIndex: 0, label: nil,
                videoStartSeconds: 0, videoEndSeconds: 30
            ),
            scoreDocument: score,
            activeTimeMap: nil
        )
        let scoreRepo = StubScoreRepository(sections: [section])
        let services = AppServices(
            catalog: ThrowingCatalogRepository(),
            progress: ThrowingProgressRepository(),
            entitlements: ThrowingEntitlementsRepository(),
            quiz: ThrowingQuizRepository(),
            score: scoreRepo,
            cache: ResponseCache(),
            mediaResolver: PassthroughMediaURLResolver()
        )

        let item = Self.videoItem
        let body = VideoNotationBody(
            item: item,
            resolver: PassthroughMediaURLResolver(),
            resumeSeconds: nil,
            alreadyComplete: false,
            defaultSubtitle: nil
        )
        .environment(services)
        .frame(width: 390, height: 700) // compact width → stacked layout

        let host = UIHostingController(rootView: body)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host
        window.makeKeyAndVisible()
        host.beginAppearanceTransition(true, animated: false)
        host.endAppearanceTransition()
        window.layoutIfNeeded()

        // Wait for the player's `.task` to build the model AND the section fetch to resolve, then
        // give SwiftUI room to re-render the layout flip (the moment a remount would occur).
        await spin(until: { LessonVideoPlayerModel.debugInitCount >= 1 && scoreRepo.didLoadSections },
                   window: window, timeout: 5)
        await spin(seconds: 0.6, window: window) // let the sections-loaded re-render settle

        XCTAssertTrue(scoreRepo.didLoadSections, "the section fetch should have run")
        XCTAssertEqual(
            LessonVideoPlayerModel.debugInitCount, 1,
            "the player was remounted when sections loaded — a scored lesson must build ONE model"
        )

        host.beginAppearanceTransition(false, animated: false)
        host.endAppearanceTransition()
        window.isHidden = true
    }

    // MARK: - Helpers

    private static let videoItem = ClassItem(
        id: UUID(), classId: UUID(), itemType: .video, title: "Scored lesson", titleEs: nil,
        description: nil, descriptionEs: nil, orderIndex: 0, richContent: nil,
        videoUrl: "https://example.com/lesson.m4v", videoDurationSeconds: 100,
        audioUrl: nil, soundsliceEmbedUrl: nil, subtitles: nil,
        bpm: nil, keySignature: nil, scoreDocumentId: nil, activeTimeMapId: nil,
        exerciseTimeMapId: nil, exerciseVideoUrl: nil, exerciseVideoStartSeconds: 0,
        question: nil, questionType: nil, options: nil, correctAnswer: nil, explanation: nil,
        createdAt: nil, updatedAt: nil
    )

    /// Spin the main run loop until `condition` holds or `timeout` elapses.
    private func spin(until condition: () -> Bool, window: UIWindow, timeout: TimeInterval) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            window.layoutIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
            await Task.yield()
        }
        window.layoutIfNeeded()
    }

    /// Spin the main run loop for a fixed duration, laying out each turn.
    private func spin(seconds: TimeInterval, window: UIWindow) async {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            window.layoutIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
            await Task.yield()
        }
    }
}

// MARK: - Stubs

private enum SectionScoreStub {
    /// A minimal but non-empty score (one track, whole notes) so `VideoNotationBody`'s
    /// `!tracks.isEmpty` filter keeps the section.
    static let stub: ScoreDocument = {
        let bar = [MusicalEvent.note(Note(durationQN: 4, midi: 60))]
        let measures = (1...2).map { Measure(number: $0, voices: [Voice(number: 1, events: bar)]) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil,
            stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: measures
        )
        return ScoreDocument(
            title: "S", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0, tracks: [track]
        )
    }()
}

private final class StubScoreRepository: ScoreRepository, @unchecked Sendable {
    private let sections: [HydratedScoreSection]
    private(set) var didLoadSections = false

    init(sections: [HydratedScoreSection]) { self.sections = sections }

    func scoreDocument(id: UUID) async throws -> ScoreDocument? { nil }

    func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection] {
        didLoadSections = true
        return sections
    }
}

private struct StubUnused: Error {}

private struct ThrowingCatalogRepository: CatalogRepository {
    func countries() async throws -> [Country] { throw StubUnused() }
    func musicalStyles() async throws -> [MusicalStyle] { throw StubUnused() }
    func publishedCourses() async throws -> [Course] { throw StubUnused() }
    func courseDetail(id: UUID) async throws -> Course? { throw StubUnused() }
    func courseStructure(courseId: UUID) async throws -> CourseStructure { throw StubUnused() }
}

private struct ThrowingProgressRepository: ProgressRepository {
    func markComplete(itemId: UUID) async throws { throw StubUnused() }
    func updatePosition(itemId: UUID, seconds: Int) async throws { throw StubUnused() }
    func enroll(courseId: UUID) async throws { throw StubUnused() }
    func myEnrollments() async throws -> [CourseEnrollment] { throw StubUnused() }
    func achievements() async throws -> [UserAchievement] { throw StubUnused() }
}

private struct ThrowingEntitlementsRepository: EntitlementsRepository {
    func refresh() async throws -> Entitlements { throw StubUnused() }
}

private struct ThrowingQuizRepository: QuizRepository {
    func questions(classItemId: UUID) async throws -> [QuizQuestion] { throw StubUnused() }
}
