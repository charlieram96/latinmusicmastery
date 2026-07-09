import LMMModels
import ScoreModel
import SnapshotTesting
import SwiftUI
import XCTest

@testable import LMMData
@testable import LMMFeatures

/// D27 "Practice Songs" surface coverage: a snapshot of the empty state (today's shipped reality —
/// `play_sense_songs` has zero rows in prod) driven through the real load path with a fake, empty
/// repository, plus a fixture-driven snapshot proving real song rows (title + difficulty pill) render
/// when the repository returns some — using `FakeSongRepository` instead of touching Supabase. Both
/// go through the real `.task` async load path (mounted in a live `UIWindow` and spun until settled,
/// same pattern `PlaySenseExerciseLauncherTests` uses for an `AppServices`-dependent view) rather than
/// snapshotting the view's initial (pre-load) state.
@MainActor
final class PracticeSongsViewTests: XCTestCase {
    func testEmptyStateSnapshot() async throws {
        let host = try await mountPracticeSongsView(songs: [])
        assertSnapshot(of: host.controller, as: .image(precision: 0.98, perceptualPrecision: 0.97))
        host.tearDown()
    }

    func testListRendersSongsFromRepositoryFixture() async throws {
        let songs = [
            PlaySenseSong(
                id: UUID(), scoreDocumentId: UUID(), title: "Tumbao Básico",
                difficulty: .beginner, trackIndex: 0, isPublished: true, orderIndex: 0
            ),
            PlaySenseSong(
                id: UUID(), scoreDocumentId: UUID(), title: "Son Montuno Groove",
                difficulty: .advanced, trackIndex: 0, isPublished: true, orderIndex: 1
            )
        ]
        let host = try await mountPracticeSongsView(songs: songs)
        assertSnapshot(of: host.controller, as: .image(precision: 0.98, perceptualPrecision: 0.97))
        host.tearDown()
    }

    // MARK: - Harness

    private struct Host {
        let controller: UIHostingController<AnyView>
        let window: UIWindow

        func tearDown() {
            controller.beginAppearanceTransition(false, animated: false)
            controller.endAppearanceTransition()
            window.isHidden = true
        }
    }

    /// Mounts `PracticeSongsView` (wrapped in a `NavigationStack`, matching how `MainTabView` presents
    /// it) with a `FakeSongRepository` returning `songs`, then spins the run loop until the async
    /// `.task` load settles — same pattern `PlaySenseExerciseLauncherTests` uses for an
    /// `AppServices`-dependent view.
    private func mountPracticeSongsView(songs: [PlaySenseSong]) async throws -> Host {
        let services = AppServices(
            catalog: ThrowingCatalogRepository(),
            progress: ThrowingProgressRepository(),
            entitlements: ThrowingEntitlementsRepository(),
            quiz: ThrowingQuizRepository(),
            score: ThrowingScoreRepository(),
            cache: ResponseCache(),
            songs: FakeSongRepository(songs: songs)
        )
        let body = AnyView(
            NavigationStack { PracticeSongsView() }
                .environment(services)
                .frame(width: 390, height: 844)
        )

        let host = UIHostingController(rootView: body)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = host
        window.makeKeyAndVisible()
        host.beginAppearanceTransition(true, animated: false)
        host.endAppearanceTransition()
        window.layoutIfNeeded()

        // The fakes resolve synchronously (no real network), so a short fixed spin is enough for the
        // `.task` to run to completion and for SwiftUI to re-render with the loaded state.
        let deadline = Date().addingTimeInterval(0.5)
        while Date() < deadline {
            window.layoutIfNeeded()
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
            await Task.yield()
        }
        window.layoutIfNeeded()

        return Host(controller: host, window: window)
    }
}

// MARK: - Fakes

private struct FakeSongRepository: PlaySenseSongRepository {
    let songs: [PlaySenseSong]
    func publishedSongs() async throws -> [PlaySenseSong] { songs }
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

private struct ThrowingScoreRepository: ScoreRepository {
    func scoreDocument(id: UUID) async throws -> ScoreDocument? { throw StubUnused() }
    func scoreSections(classItemId: UUID) async throws -> [HydratedScoreSection] { throw StubUnused() }
}
