import LMMData
import PlaySenseCore
import SwiftUI

/// Routes the app's root scene based on `AuthService.state`. The actual state → screen mapping
/// lives in the pure, testable `RootRoute.route(for:)`.
public struct RootView: View {
    @Environment(AuthService.self) private var authService
    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.scenePhase) private var scenePhase

    public init() {}

    public var body: some View {
        Group {
            switch RootRoute.route(for: authService.state) {
            case .splash:
                SplashView()
            case .authLanding:
                AuthLandingView()
            case .main:
                MainTabView()
            }
        }
        .onChange(of: authService.state) { _, newState in
            if newState == .signedOut {
                // A different account must not inherit this session's access or cached data.
                entitlements.clear()
                Task { await services.cache.clearOnSignOut() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            Self.handleScenePhaseChange(phase, attemptSink: services.attemptSink)
        }
    }
}

extension RootView {
    /// D26 fix round 1, finding 2: the ONLY foreground-drain trigger used to live in
    /// `StagePlayerView`'s own `scenePhase` hook (`SessionCoordinator.handleForegrounding()` →
    /// `attemptSink.drainPending()`), which never fires unless a PlaySense stage session happens to
    /// be the screen on screen when the app returns to foreground — foregrounding from Home,
    /// Courses, My Courses, or Profile silently skipped it, so anything stuck in the offline queue
    /// (D26) from an earlier failed save could sit for an entire app session before the next ranked
    /// take opportunistically drained it (`record(...)`'s own drain-first step).
    ///
    /// `RootView` is mounted for the ENTIRE app lifetime (splash → auth landing → signed-in shell —
    /// see `body`'s `switch`), so it is the one place guaranteed to observe every foreground
    /// transition regardless of what's on screen. `services.attemptSink` is `AppServices`' `let`
    /// property — the SAME `OfflineAttemptQueue` instance built once in `SupabaseService
    /// .makeLiveRepositories()` and handed to every `StagePlayerView` via `PlaySenseExerciseLauncher`
    /// (`services.attemptSink`), so this drains the identical queue `SessionCoordinator` records
    /// into — not a second, divergent instance.
    ///
    /// A `static func` (not inlined in `body`) purely so `RootViewForegroundDrainTests` can drive it
    /// directly with a spy sink: this package has no view-inspection dependency to drive `scenePhase`
    /// through the real view hierarchy, so the seam is this pure function instead.
    static func handleScenePhaseChange(_ phase: ScenePhase, attemptSink: PlaySenseAttemptSink) {
        guard phase == .active else { return }
        Task { @MainActor in await attemptSink.drainPending() }
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
