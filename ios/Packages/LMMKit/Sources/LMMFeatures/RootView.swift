import LMMData
import SwiftUI

/// Routes the app's root scene based on `AuthService.state`. The actual state → screen mapping
/// lives in the pure, testable `RootRoute.route(for:)`.
public struct RootView: View {
    @Environment(AuthService.self) private var authService

    public init() {}

    public var body: some View {
        switch RootRoute.route(for: authService.state) {
        case .splash:
            SplashView()
        case .authLanding:
            AuthLandingView()
        case .main:
            MainPlaceholderView()
        }
    }
}

/// Shown once, briefly, while `AuthService` restores (or fails to find) a persisted session.
private struct SplashView: View {
    var body: some View {
        ProgressView()
            .controlSize(.large)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
    }
}
