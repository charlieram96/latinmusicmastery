import Foundation
import LMMData

/// Pure mapping from `AuthState` to the screen the app's root scene should show. Pulled out of
/// `RootView`'s body so the routing decision is unit-testable without a SwiftUI environment.
public enum RootRoute: Equatable {
    case splash
    case authLanding
    case main(userId: UUID)

    public static func route(for state: AuthState) -> RootRoute {
        switch state {
        case .loading:
            return .splash
        case .signedOut:
            return .authLanding
        case .signedIn(let userId):
            return .main(userId: userId)
        }
    }
}
