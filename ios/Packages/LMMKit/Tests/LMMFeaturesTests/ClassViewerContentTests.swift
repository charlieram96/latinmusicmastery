import XCTest

@testable import LMMData
@testable import LMMFeatures
@testable import LMMModels

/// Unit tests for the class viewer's two pure derivations from ``CourseStructure``:
/// item-switcher ordering and per-item completion state (``ClassViewerContent``), plus the
/// bounded ``ClassItemNavigator``.
final class ClassViewerContentTests: XCTestCase {
    private let classId = UUID()
    private let videoId = UUID()
    private let quizId = UUID()

    /// A class whose items are listed OUT of order_index order in the fixture, so a correct
    /// derivation must re-sort them.
    private func makeStructure(completedVideo: Bool = false, resumeSeconds: Int? = nil) -> CourseStructure {
        let courseId = UUID()
        let sectionId = UUID()
        let video = makeItem(id: videoId, type: .video, order: 0, title: "Watch")
        let quiz = makeItem(id: quizId, type: .quiz, order: 1, title: "Check")
        // Reversed on purpose: quiz (order 1) before video (order 0).
        let klass = makeClass(id: classId, sectionId: sectionId, items: [quiz, video])
        let section = makeSection(id: sectionId, courseId: courseId, classes: [klass])

        var progress: [ClassItemProgress] = []
        if completedVideo {
            progress.append(makeProgress(itemId: videoId, completed: true, position: resumeSeconds))
        } else if let resumeSeconds {
            progress.append(makeProgress(itemId: videoId, completed: false, position: resumeSeconds))
        }
        return CourseStructure.buildStructure(sections: [section], progress: progress)
    }

    func testDeriveLocatesClassAndOrdersItemsByOrderIndex() {
        let content = ClassViewerContent.derive(from: makeStructure(), classId: classId)
        let unwrapped = try? XCTUnwrap(content)
        XCTAssertEqual(unwrapped?.items.map(\.title), ["Watch", "Check"])
    }

    func testDeriveReturnsNilForUnknownClass() {
        XCTAssertNil(ClassViewerContent.derive(from: makeStructure(), classId: UUID()))
    }

    func testCompletionDerivedFromProgress() {
        let content = ClassViewerContent.derive(from: makeStructure(completedVideo: true), classId: classId)!
        XCTAssertTrue(content.isComplete(videoId))
        XCTAssertFalse(content.isComplete(quizId))
        XCTAssertEqual(content.completedItemIds, [videoId])
    }

    func testResumePositionsCarriedFromProgressMap() {
        let content = ClassViewerContent.derive(from: makeStructure(resumeSeconds: 42), classId: classId)!
        XCTAssertEqual(content.resumePositions[videoId], 42)
        XCTAssertNil(content.resumePositions[quizId])
    }

    // MARK: Navigator

    func testNavigatorClampsInitialIndex() {
        XCTAssertEqual(ClassItemNavigator(index: 99, count: 3).index, 2)
        XCTAssertEqual(ClassItemNavigator(index: -5, count: 3).index, 0)
        XCTAssertEqual(ClassItemNavigator(index: 0, count: 0).index, 0)
    }

    func testNavigatorBoundsAndMovement() {
        var nav = ClassItemNavigator(count: 3)
        XCTAssertFalse(nav.canGoPrevious)
        XCTAssertTrue(nav.canGoNext)
        nav.goNext(); XCTAssertEqual(nav.index, 1)
        nav.goNext(); XCTAssertEqual(nav.index, 2)
        nav.goNext(); XCTAssertEqual(nav.index, 2) // clamped at the end
        XCTAssertFalse(nav.canGoNext)
        nav.goPrevious(); XCTAssertEqual(nav.index, 1)
        nav.select(0); XCTAssertEqual(nav.index, 0)
        nav.select(10); XCTAssertEqual(nav.index, 2) // clamped
    }

    // MARK: Factories

    private func makeItem(id: UUID, type: ClassItemType, order: Int, title: String) -> ClassItem {
        ClassItem(
            id: id, classId: classId, itemType: type, title: title, titleEs: nil,
            description: nil, descriptionEs: nil, orderIndex: order, richContent: nil,
            videoUrl: type == .video ? "https://example.com/v.m4v" : nil, videoDurationSeconds: 100,
            audioUrl: nil, soundsliceEmbedUrl: nil, subtitles: nil,
            bpm: nil, keySignature: nil, scoreDocumentId: nil, activeTimeMapId: nil,
            exerciseTimeMapId: nil, exerciseVideoUrl: nil, exerciseVideoStartSeconds: 0,
            question: nil, questionType: nil, options: nil, correctAnswer: nil, explanation: nil,
            createdAt: nil, updatedAt: nil
        )
    }

    private func makeClass(id: UUID, sectionId: UUID, items: [ClassItem]) -> CourseClass {
        CourseClass(
            id: id, sectionId: sectionId, title: "Class", titleEs: nil, description: nil,
            descriptionEs: nil, orderIndex: 0, isFree: true, createdAt: nil, updatedAt: nil, items: items
        )
    }

    private func makeSection(id: UUID, courseId: UUID, classes: [CourseClass]) -> CourseSection {
        CourseSection(
            id: id, courseId: courseId, title: "Section", titleEs: nil, description: nil,
            descriptionEs: nil, orderIndex: 0, createdAt: nil, updatedAt: nil, classes: classes
        )
    }

    private func makeProgress(itemId: UUID, completed: Bool, position: Int?) -> ClassItemProgress {
        ClassItemProgress(
            id: UUID(), userId: UUID(), classItemId: itemId, completed: completed,
            completedAt: nil, lastPositionSeconds: position, createdAt: nil, updatedAt: nil
        )
    }
}
