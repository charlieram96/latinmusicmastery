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

    /// Backs the `TabView` selection so other tabs (e.g. My Courses' empty state) can switch
    /// the shell to a different tab programmatically.
    private enum Tab: Hashable {
        case home, courses, myCourses, profile
    }

    @State private var selectedTab: Tab = .home

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.home"), systemImage: "house.fill") }
            .tag(Tab.home)

            NavigationStack {
                CoursesView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.courses"), systemImage: "square.grid.2x2.fill") }
            .tag(Tab.courses)

            NavigationStack {
                MyCoursesView().catalogDestinations()
            }
            .tabItem { Label(lmmString("tab.myCourses"), systemImage: "bookmark.fill") }
            .tag(Tab.myCourses)
            .environment(\.selectCoursesTab) { selectedTab = .courses }

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label(lmmString("tab.profile"), systemImage: "person.crop.circle.fill") }
            .tag(Tab.profile)
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

private struct SelectCoursesTabKey: EnvironmentKey {
    static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    /// Lets a tab's content switch `MainTabView`'s selection to the Courses tab — used by My
    /// Courses' empty state "Browse courses" action. Defaults to a no-op so anything rendered
    /// outside `MainTabView` (previews, tests) doesn't need to supply it.
    var selectCoursesTab: () -> Void {
        get { self[SelectCoursesTabKey.self] }
        set { self[SelectCoursesTabKey.self] = newValue }
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
                ClassViewerView(courseId: courseId, classId: classId)
            }
        }
    }
}

extension View {
    func catalogDestinations() -> some View {
        modifier(CatalogDestinations())
    }
}
