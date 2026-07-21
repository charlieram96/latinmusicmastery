import XCTest

@testable import LMMData
import LMMModels

/// Branch matrix for `CourseStructure.EnrichedClass.isLocked(entitlements:course:)`: the client's
/// "Gated" signal — a non-free class whose items came back empty is presumed RLS-gated, UNLESS
/// the class is actually free (then it's just empty, not gated) or the viewer already has access
/// to the parent course.
///
/// Classes come from `course_structure_edge_cases.json` (run through `buildStructure`, not
/// constructed in-line) so this exercises the same code path production does:
///   - "Class Visible NonFree" — non-free, one item — covers `itemsVisible == true`.
///   - "Class Empty NonFree" — non-free, zero items — covers the "presumed gated" branch, probed
///     with different `Entitlements` to cover entitled / unentitled / admin.
///   - "Class Empty Free" — free, zero items — covers "empty, not gated".
///
/// The course side reuses `entitlement_courses.json`'s "Salsa Timbal" genre course (non-
/// fundamentals, gated purely on `unlockedCourseIds`), the same fixture `EntitlementsCanAccessTests`
/// uses for `Entitlements.canAccess`.
final class CourseStructureIsLockedTests: XCTestCase {
    private func loadStructure() throws -> CourseStructure {
        let sections = try DataFixtureLoader.decode(
            [CourseSection].self,
            from: "course_structure_edge_cases.json"
        )
        return CourseStructure.buildStructure(sections: sections, progress: [])
    }

    private func loadCourse() throws -> Course {
        let courses = try DataFixtureLoader.decode([Course].self, from: "entitlement_courses.json")
        return try XCTUnwrap(courses.first { $0.slug == "salsa-timbal" })
    }

    private func enrichedClass(
        _ structure: CourseStructure,
        titled title: String
    ) throws -> CourseStructure.EnrichedClass {
        try XCTUnwrap(structure.sections.flatMap(\.classes).first { $0.courseClass.title == title })
    }

    func testItemsVisibleIsNeverLockedRegardlessOfEntitlements() throws {
        let structure = try loadStructure()
        let course = try loadCourse()
        let visibleNonFree = try enrichedClass(structure, titled: "Class Visible NonFree")
        XCTAssertTrue(visibleNonFree.itemsVisible)

        // No access whatsoever — still not locked, because the guard short-circuits on
        // `itemsVisible` before entitlements are even consulted.
        XCTAssertFalse(visibleNonFree.isLocked(entitlements: Entitlements(), course: course))
    }

    func testNonFreeEmptyClassIsNotLockedWhenViewerIsEntitled() throws {
        let structure = try loadStructure()
        let course = try loadCourse()
        let emptyNonFree = try enrichedClass(structure, titled: "Class Empty NonFree")
        XCTAssertFalse(emptyNonFree.itemsVisible)

        let entitled = Entitlements(unlockedCourseIds: [course.id])
        XCTAssertFalse(emptyNonFree.isLocked(entitlements: entitled, course: course))
    }

    func testNonFreeEmptyClassIsLockedWhenViewerIsNotEntitled() throws {
        let structure = try loadStructure()
        let course = try loadCourse()
        let emptyNonFree = try enrichedClass(structure, titled: "Class Empty NonFree")

        XCTAssertTrue(emptyNonFree.isLocked(entitlements: Entitlements(), course: course))
    }

    func testFreeEmptyClassIsNeverLockedBecauseItsJustEmptyNotGated() throws {
        let structure = try loadStructure()
        let course = try loadCourse()
        let emptyFree = try enrichedClass(structure, titled: "Class Empty Free")
        XCTAssertFalse(emptyFree.itemsVisible)

        // Zero access, yet not locked — a FREE class with no items is genuinely empty, not gated.
        XCTAssertFalse(emptyFree.isLocked(entitlements: Entitlements(), course: course))
    }

    func testAdminOverridesLockOnNonFreeEmptyClass() throws {
        let structure = try loadStructure()
        let course = try loadCourse()
        let emptyNonFree = try enrichedClass(structure, titled: "Class Empty NonFree")

        let admin = Entitlements(isAdmin: true)
        XCTAssertFalse(emptyNonFree.isLocked(entitlements: admin, course: course))
    }
}
