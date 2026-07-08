import LMMData
import LMMDesignSystem
import SwiftUI

/// The signed-in app shell: four tabs, each owning its own `NavigationStack`. Replaces the
/// old `MainPlaceholderView`.
///
/// Entitlements refresh here — once when the shell appears (i.e. on sign-in) and again each
/// time the app returns to the foreground — so access state stays current without every
/// screen re-fetching it.
public struct MainTabView: View {
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.scenePhase) private var scenePhase

    public init() {}

    public var body: some View {
        TabView {
            NavigationStack {
                HomeView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.home"), systemImage: "house.fill") }

            NavigationStack {
                CoursesView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.courses"), systemImage: "square.grid.2x2.fill") }

            NavigationStack {
                MyCoursesView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.myCourses"), systemImage: "bookmark.fill") }

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label(lmmString("tab.profile"), systemImage: "person.crop.circle.fill") }
        }
        .tint(LMMColor.primary)
        .environment(\.appLocale, .current)
        .task { await entitlements.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await entitlements.refresh() }
            }
        }
    }
}

/// Registers the shared `CatalogRoute` destinations on a `NavigationStack`'s content so any
/// tab can push a course or the (placeholder) class viewer.
struct CatalogDestinations: ViewModifier {
    func body(content: Content) -> some View {
        content.navigationDestination(for: CatalogRoute.self) { route in
            switch route {
            case .course(let courseId):
                CourseDetailView(courseId: courseId)
            case .classViewer(let courseId, let classId):
                ClassViewerPlaceholderView(courseId: courseId, classId: classId)
            }
        }
    }
}

extension View {
    func catalogDestinations() -> some View {
        modifier(CatalogDestinations())
    }
}
