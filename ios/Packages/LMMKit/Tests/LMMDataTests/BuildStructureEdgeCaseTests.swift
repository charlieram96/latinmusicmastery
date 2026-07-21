import XCTest

@testable import LMMData
import LMMModels

/// Edge cases for `CourseStructure.buildStructure(sections:progress:)` that the main ordering/
/// totals fixture (`course_structure_sections.json`) doesn't cover: a section with zero classes,
/// a class whose `items` key is entirely absent from the fetch (embedded-select rows omit it
/// rather than sending `null` in some PostgREST responses), and a VIDEO item with a `null`
/// `video_duration_seconds` (duration genuinely unknown — must still count as an item without
/// contributing to any duration total). See `course_structure_edge_cases.json`.
final class BuildStructureEdgeCaseTests: XCTestCase {
    private func loadStructure() throws -> CourseStructure {
        let sections = try DataFixtureLoader.decode(
            [CourseSection].self,
            from: "course_structure_edge_cases.json"
        )
        return CourseStructure.buildStructure(sections: sections, progress: [])
    }

    func testEmptySectionHasZeroClassesAndZeroTotals() throws {
        let structure = try loadStructure()
        let emptySection = try XCTUnwrap(structure.sections.first { $0.section.title == "Section Empty" })

        XCTAssertEqual(emptySection.classes, [])
        XCTAssertEqual(emptySection.totalItems, 0)
        XCTAssertEqual(emptySection.completedItems, 0)
    }

    func testClassWithMissingItemsKeyIsGracefullyEmpty() throws {
        let structure = try loadStructure()
        let section = try XCTUnwrap(structure.sections.first { $0.section.title == "Section Edge Cases" })
        let missingItems = try XCTUnwrap(section.classes.first { $0.courseClass.title == "Class Missing Items Key" })

        // The fixture's JSON object for this class has no "items" key at all — decodes to `nil`,
        // and `enrichClass`'s `courseClass.items ?? []` must turn that into a plain empty array
        // rather than crashing or leaving `items` optional.
        XCTAssertNil(missingItems.courseClass.items)
        XCTAssertEqual(missingItems.items, [])
        XCTAssertEqual(missingItems.totalItems, 0)
        XCTAssertEqual(missingItems.completedItems, 0)
        XCTAssertFalse(missingItems.itemsVisible)
    }

    func testVideoItemWithNullDurationCountsAsItemButContributesZeroDuration() throws {
        let structure = try loadStructure()
        let section = try XCTUnwrap(structure.sections.first { $0.section.title == "Section Edge Cases" })
        let nullDurationClass = try XCTUnwrap(
            section.classes.first { $0.courseClass.title == "Class Null Duration Video" }
        )

        XCTAssertTrue(nullDurationClass.itemsVisible)
        XCTAssertEqual(nullDurationClass.totalItems, 1)
        XCTAssertNil(nullDurationClass.items.first?.videoDurationSeconds)

        // Only "Class Visible NonFree"'s 30s video should contribute to the course-wide duration
        // totals in this fixture — the null-duration item counts as an item (above) but adds 0
        // seconds, not merely "less than expected".
        XCTAssertEqual(structure.totalDurationSeconds, 30)
        XCTAssertEqual(structure.completedDurationSeconds, 0)
    }
}
