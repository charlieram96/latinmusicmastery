import XCTest

@testable import LMMData
import LMMModels

/// Unit tests for `CourseStructure.buildStructure(sections:progress:)`, the pure aggregation
/// mirroring `getCourseStructureForStudent` in `app/actions/course-student.ts`.
///
/// Fixture shape (`course_structure_sections.json`): two sections.
///   Section A (order 0): Class A0 (order 0, EMPTY — no items) then Class A1 (order 1, a QUIZ
///     item at order 0 and a VIDEO item — duration 100s — at order 1; the fixture happens to list
///     these two items in ascending `order_index` already, so Class A1 alone doesn't prove the
///     nested item sort — see Class B1 below for that).
///   Section B (order 1): Class B1 (order 0, a VIDEO item — duration 50s — at order 0 and an
///     EXERCISE item at order 1; the fixture lists the EXERCISE item FIRST and the VIDEO item
///     SECOND, i.e. genuinely reversed, so asserting B1's sorted item order is what actually
///     exercises ``CourseStructure/buildStructure(sections:progress:)``'s `.sorted` call).
final class BuildStructureTests: XCTestCase {
    private func loadSections() throws -> [CourseSection] {
        try DataFixtureLoader.decode([CourseSection].self, from: "course_structure_sections.json")
    }

    func testOrdersNestedClassesAndItemsByOrderIndexRegardlessOfInputOrder() throws {
        let sections = try loadSections()
        let structure = CourseStructure.buildStructure(sections: sections, progress: [])

        let sectionA = structure.sections[0]
        // Class A0 (order_index 0) must sort before Class A1 (order_index 1), even though the
        // fixture lists A1 first.
        XCTAssertEqual(sectionA.classes.map(\.courseClass.title), ["Class A0 (empty)", "Class A1"])

        let classA1 = try XCTUnwrap(sectionA.classes.first { $0.courseClass.title == "Class A1" })
        // The Quiz item (order_index 0) must sort before the Video item (order_index 1). Note:
        // the fixture already lists them in this order, so this assertion alone would still pass
        // without the `.sorted` call — see Class B1 below, whose items are genuinely reversed in
        // the fixture, for the assertion that actually proves the nested item sort.
        XCTAssertEqual(classA1.items.map(\.title), ["A1 Quiz", "A1 Video"])

        let sectionB = structure.sections[1]
        let classB1 = try XCTUnwrap(sectionB.classes.first { $0.courseClass.title == "Class B1" })
        // The Video item (order_index 0) must sort before the Exercise item (order_index 1),
        // even though the fixture lists the Exercise item first — deleting the `.sorted` call in
        // `enrichClass` would make this fail (it would come back as ["B1 Exercise", "B1 Video"]).
        XCTAssertEqual(classB1.items.map(\.title), ["B1 Video", "B1 Exercise"])
    }

    func testEmptyClassReportsZeroTotalsAndIsNeverChosenAsNextClass() throws {
        let sections = try loadSections()
        let structure = CourseStructure.buildStructure(sections: sections, progress: [])

        let sectionA = structure.sections[0]
        let emptyClass = try XCTUnwrap(sectionA.classes.first { $0.courseClass.title == "Class A0 (empty)" })
        XCTAssertEqual(emptyClass.totalItems, 0)
        XCTAssertEqual(emptyClass.completedItems, 0)
        XCTAssertFalse(emptyClass.itemsVisible)

        // nextClassId skips the always-empty class (0 completed < 0 total is false) and lands on
        // the first class that actually has an incomplete item.
        let classA1 = try XCTUnwrap(sectionA.classes.first { $0.courseClass.title == "Class A1" })
        XCTAssertEqual(structure.nextClassId, classA1.id)
    }

    func testPartialProgressComputesPerClassPerSectionAndCourseTotals() throws {
        let sections = try loadSections()
        let progress = try DataFixtureLoader.decode(
            [ClassItemProgress].self,
            from: "course_structure_progress_partial.json"
        )
        let structure = CourseStructure.buildStructure(sections: sections, progress: progress)

        let sectionA = structure.sections[0]
        let classA1 = try XCTUnwrap(sectionA.classes.first { $0.courseClass.title == "Class A1" })
        XCTAssertEqual(classA1.totalItems, 2)
        XCTAssertEqual(classA1.completedItems, 1)
        XCTAssertEqual(classA1.completedItemIds, [UUID(uuidString: "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee")!])
        XCTAssertEqual(sectionA.totalItems, 2)
        XCTAssertEqual(sectionA.completedItems, 1)

        let sectionB = structure.sections[1]
        let classB1 = try XCTUnwrap(sectionB.classes.first { $0.courseClass.title == "Class B1" })
        XCTAssertEqual(classB1.totalItems, 2)
        XCTAssertEqual(classB1.completedItems, 1)
        XCTAssertEqual(sectionB.totalItems, 2)
        XCTAssertEqual(sectionB.completedItems, 1)

        XCTAssertEqual(structure.totalItems, 4)
        XCTAssertEqual(structure.completedItems, 2)

        // Duration math only counts VIDEO items with a video_duration_seconds; B1's video was
        // NOT marked complete, so completedDurationSeconds is less than totalDurationSeconds.
        XCTAssertEqual(structure.totalDurationSeconds, 150)
        XCTAssertEqual(structure.completedDurationSeconds, 100)

        // First class (in section+class order) with an incomplete item, even though Class B1
        // also has an incomplete item — nextClassId must be the FIRST one encountered.
        XCTAssertEqual(structure.nextClassId, classA1.id)

        // progressMap is keyed by class_item_id and defaults `completed` to false.
        let a1QuizId = UUID(uuidString: "eeeeeeee-0002-4eee-8eee-eeeeeeeeeeee")!
        XCTAssertEqual(structure.progressMap[a1QuizId]?.completed, false)
        let a1VideoId = UUID(uuidString: "eeeeeeee-0001-4eee-8eee-eeeeeeeeeeee")!
        XCTAssertEqual(structure.progressMap[a1VideoId]?.completed, true)
        XCTAssertEqual(structure.progressMap[a1VideoId]?.lastPositionSeconds, 100)
    }

    func testAllItemsCompletedYieldsNilNextClassId() throws {
        let sections = try loadSections()
        let progress = try DataFixtureLoader.decode(
            [ClassItemProgress].self,
            from: "course_structure_progress_all_complete.json"
        )
        let structure = CourseStructure.buildStructure(sections: sections, progress: progress)

        XCTAssertNil(structure.nextClassId)
        XCTAssertEqual(structure.totalItems, structure.completedItems)
        XCTAssertEqual(structure.totalDurationSeconds, structure.completedDurationSeconds)
    }

    func testEmptyProgressPicksFirstNonEmptyClassAsNext() throws {
        let sections = try loadSections()
        let structure = CourseStructure.buildStructure(sections: sections, progress: [])

        let sectionA = structure.sections[0]
        let classA1 = try XCTUnwrap(sectionA.classes.first { $0.courseClass.title == "Class A1" })
        XCTAssertEqual(structure.nextClassId, classA1.id)
        XCTAssertEqual(structure.completedItems, 0)
    }
}
