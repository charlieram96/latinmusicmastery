import XCTest

@testable import LMMData
import LMMModels

/// Truth table for `Entitlements.canAccess`, the pure port of `lib/subscriptions.ts`'s
/// `canAccessCourse` / the SQL `has_course_access` function.
///
/// Fixture (`entitlement_courses.json`) rows:
///   1. Percussion Fundamentals — fundamentals, instrument = Percussion.
///   2. Salsa Timbal — genre course, instrument = Timbal, has a musical_style_id.
///   3. Orphaned Course — instrument = nil.
///   4. Genre Course Without musical_style_id — genre course, instrument = Bass, but
///      musical_style_id is nil (proves genre gating never looks at musical_style_id).
final class EntitlementsCanAccessTests: XCTestCase {
    private func loadCourses() throws -> [Course] {
        try DataFixtureLoader.decode([Course].self, from: "entitlement_courses.json")
    }

    private func course(_ courses: [Course], slug: String) throws -> Course {
        try XCTUnwrap(courses.first { $0.slug == slug })
    }

    func testAdminBypassesEverything() throws {
        let courses = try loadCourses()
        let entitlements = Entitlements(isAdmin: true)
        for course in courses {
            XCTAssertTrue(entitlements.canAccess(course), "admin should access \(course.slug)")
        }
    }

    func testCourseWithNilInstrumentIsAlwaysDenied() throws {
        let courses = try loadCourses()
        let orphaned = try course(courses, slug: "orphaned-course")
        // Even with every other entitlement wide open, an instrument-less course is denied.
        let entitlements = Entitlements(
            activeInstruments: ["Percussion", "Timbal", "Bass"],
            unlockedCourseIds: [orphaned.id]
        )
        XCTAssertFalse(entitlements.canAccess(orphaned))
    }

    func testFundamentalsCourseAllowedWithMatchingActiveInstrumentSubscription() throws {
        let courses = try loadCourses()
        let fundamentals = try course(courses, slug: "percussion-fundamentals")
        let entitlements = Entitlements(activeInstruments: ["Percussion"])
        XCTAssertTrue(entitlements.canAccess(fundamentals))
    }

    func testFundamentalsCourseDeniedWithoutMatchingSubscription() throws {
        let courses = try loadCourses()
        let fundamentals = try course(courses, slug: "percussion-fundamentals")
        let entitlements = Entitlements(activeInstruments: ["Bass"])
        XCTAssertFalse(entitlements.canAccess(fundamentals))

        let noSubs = Entitlements()
        XCTAssertFalse(noSubs.canAccess(fundamentals))
    }

    func testGenreCourseAllowedWhenUnlocked() throws {
        let courses = try loadCourses()
        let genre = try course(courses, slug: "salsa-timbal")
        let entitlements = Entitlements(unlockedCourseIds: [genre.id])
        XCTAssertTrue(entitlements.canAccess(genre))
    }

    func testGenreCourseDeniedWhenNotUnlocked_evenWithMatchingInstrumentSubscription() throws {
        let courses = try loadCourses()
        let genre = try course(courses, slug: "salsa-timbal")
        // Holding an active Timbal instrument subscription is NOT sufficient on its own — genre
        // courses require an explicit unlock row (`subscription_courses`).
        let entitlements = Entitlements(activeInstruments: ["Timbal"])
        XCTAssertFalse(entitlements.canAccess(genre))
    }

    func testGenreCourseGatingIgnoresMusicalStyleId() throws {
        // A genre course with a nil musical_style_id still gates on unlockedCourseIds exactly
        // like one that has a musical_style_id — canAccessCourse never inspects musical_style_id.
        let courses = try loadCourses()
        let genreNoStyle = try course(courses, slug: "genre-course-without-style")
        XCTAssertNil(genreNoStyle.musicalStyleId)

        XCTAssertFalse(Entitlements().canAccess(genreNoStyle))
        XCTAssertTrue(Entitlements(unlockedCourseIds: [genreNoStyle.id]).canAccess(genreNoStyle))
    }
}
