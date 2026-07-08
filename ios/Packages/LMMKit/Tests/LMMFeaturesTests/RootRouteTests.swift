import XCTest

@testable import LMMData
@testable import LMMFeatures

/// `RootRoute.route(for:)` is the pure decision behind `RootView`'s screen switch, pulled out
/// so the state → screen mapping is testable without instantiating a SwiftUI environment.
final class RootRouteTests: XCTestCase {
    func testLoadingStateRoutesToSplash() {
        XCTAssertEqual(RootRoute.route(for: .loading), .splash)
    }

    func testSignedOutStateRoutesToAuthLanding() {
        XCTAssertEqual(RootRoute.route(for: .signedOut), .authLanding)
    }

    func testSignedInStateRoutesToMainCarryingUserId() {
        let userId = UUID()
        XCTAssertEqual(RootRoute.route(for: .signedIn(userId: userId)), .main(userId: userId))
    }

    func testDifferentSignedInUserIdsProduceDifferentRoutes() {
        let first = RootRoute.route(for: .signedIn(userId: UUID()))
        let second = RootRoute.route(for: .signedIn(userId: UUID()))
        XCTAssertNotEqual(first, second)
    }
}
