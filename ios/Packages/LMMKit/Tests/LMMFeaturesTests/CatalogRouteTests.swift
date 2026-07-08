import XCTest

@testable import LMMFeatures

/// `CatalogRoute` is the value pushed onto each tab's `NavigationStack`. It's a plain enum so
/// its identity/equality — which SwiftUI relies on to de-duplicate and match destinations —
/// is testable directly.
final class CatalogRouteTests: XCTestCase {
    func testSameCourseRoutesAreEqual() {
        let id = UUID()
        XCTAssertEqual(CatalogRoute.course(id), CatalogRoute.course(id))
    }

    func testDifferentCoursesAreNotEqual() {
        XCTAssertNotEqual(CatalogRoute.course(UUID()), CatalogRoute.course(UUID()))
    }

    func testCourseAndClassViewerAreDistinct() {
        let courseId = UUID()
        let classId = UUID()
        XCTAssertNotEqual(
            CatalogRoute.course(courseId),
            CatalogRoute.classViewer(courseId: courseId, classId: classId)
        )
    }

    func testClassViewerCarriesBothIdentifiers() {
        let courseId = UUID()
        let classId = UUID()
        let route = CatalogRoute.classViewer(courseId: courseId, classId: classId)
        XCTAssertEqual(route, .classViewer(courseId: courseId, classId: classId))
        XCTAssertNotEqual(route, .classViewer(courseId: classId, classId: courseId))
    }
}
