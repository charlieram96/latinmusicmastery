import XCTest

@testable import LMMModels

/// Decoding tests for the per-user models, all backed by synthetic fixtures since
/// these tables are auth-gated and unreadable via the anon key.
final class UserModelDecodingTests: XCTestCase {
    func testProfilesDecodeFromSyntheticFixture() throws {
        let profiles = try FixtureLoader.decode([Profile].self, from: "profiles.synthetic.json")
        XCTAssertEqual(profiles.count, 2)

        let ana = try XCTUnwrap(profiles.first { $0.email == "student@example.com" })
        XCTAssertEqual(ana.fullName, "Ana Torres")
        XCTAssertEqual(ana.isAdmin, false)
        XCTAssertNotNil(ana.createdAt)

        let admin = try XCTUnwrap(profiles.first { $0.isAdmin == true })
        XCTAssertNil(admin.fullName)
        XCTAssertNil(admin.createdAt)
    }

    func testClassItemProgressDecodesFromSyntheticFixture() throws {
        let rows = try FixtureLoader.decode([ClassItemProgress].self, from: "class_item_progress.synthetic.json")
        XCTAssertEqual(rows.count, 2)

        let completed = try XCTUnwrap(rows.first { $0.completed == true })
        XCTAssertEqual(completed.lastPositionSeconds, 245)
        XCTAssertNotNil(completed.completedAt)
        XCTAssertNotNil(completed.createdAt)

        let inProgress = try XCTUnwrap(rows.first { $0.completed == false })
        XCTAssertNil(inProgress.lastPositionSeconds)
        XCTAssertNil(inProgress.completedAt)
    }

    func testCourseEnrollmentsDecodeFromSyntheticFixture() throws {
        let rows = try FixtureLoader.decode([CourseEnrollment].self, from: "course_enrollments.synthetic.json")
        XCTAssertEqual(rows.count, 2)
        XCTAssertNotNil(rows[0].enrolledAt)
        XCTAssertNotNil(rows[0].lastAccessedAt)
        XCTAssertNil(rows[1].enrolledAt)
    }

    func testUserAchievementsDecodeFromSyntheticFixture() throws {
        let rows = try FixtureLoader.decode([UserAchievement].self, from: "user_achievements.synthetic.json")
        XCTAssertEqual(rows.count, 2)

        let streak = try XCTUnwrap(rows.first { $0.achievementKey == "seven_day_streak" })
        XCTAssertNil(streak.unlockedAt)

        let firstClass = try XCTUnwrap(rows.first { $0.achievementKey == "first_class_completed" })
        XCTAssertNotNil(firstClass.unlockedAt)
    }
}
