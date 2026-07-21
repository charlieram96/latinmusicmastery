import XCTest

@testable import LMMModels

/// Decoding tests for the billing/entitlement models, backed by synthetic fixtures
/// since `instrument_subscriptions` and `subscription_courses` are auth-gated.
final class EntitlementDecodingTests: XCTestCase {
    func testInstrumentSubscriptionsDecodeFromSyntheticFixture() throws {
        let subs = try FixtureLoader.decode(
            [InstrumentSubscription].self,
            from: "instrument_subscriptions.synthetic.json"
        )
        XCTAssertEqual(subs.count, 5)

        let active = try XCTUnwrap(subs.first { $0.status == .active })
        XCTAssertEqual(active.instrument, "Percussion")
        XCTAssertEqual(active.cancelAtPeriodEnd, false)
        XCTAssertNotNil(active.baseCurrentPeriodEnd)
        XCTAssertNotNil(active.createdAt)

        XCTAssertNotNil(subs.first { $0.status == .canceled })
        XCTAssertNotNil(subs.first { $0.status == .pastDue })
        XCTAssertNotNil(subs.first { $0.status == .incomplete })
    }

    func testSubscriptionStatusUnknownRawValueFallsBackInsteadOfThrowing() throws {
        let subs = try FixtureLoader.decode(
            [InstrumentSubscription].self,
            from: "instrument_subscriptions.synthetic.json"
        )
        let odd = try XCTUnwrap(subs.first { $0.instrument == "Voice" })
        XCTAssertEqual(odd.status, .unknown("FUTURE_STATUS"))
        XCTAssertEqual(odd.status.rawValue, "FUTURE_STATUS")
    }

    func testSubscriptionCoursesDecodeFromSyntheticFixture() throws {
        let rows = try FixtureLoader.decode([SubscriptionCourse].self, from: "subscription_courses.synthetic.json")
        XCTAssertEqual(rows.count, 2)
        XCTAssertNotNil(rows[0].createdAt)
        XCTAssertEqual(rows[0].instrumentSubscriptionId, rows[1].instrumentSubscriptionId)
    }
}
