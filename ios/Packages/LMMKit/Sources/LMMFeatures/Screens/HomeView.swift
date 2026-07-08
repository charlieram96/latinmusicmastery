import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The signed-in landing tab: a personal greeting, a "continue learning" card for the most
/// recent enrollment that still has a next class, and a horizontal teaser of published
/// courses. Kept deliberately light so it loads fast.
struct HomeView: View {
    @Environment(AuthService.self) private var auth
    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.appLocale) private var locale

    @State private var greetingName: String?
    @State private var courses: [Course] = []
    @State private var styleNames: [UUID: String] = [:]
    @State private var enrolledCourseIds: Set<UUID> = []
    @State private var continueItem: ContinueItem?
    @State private var state: LoadState<Void> = .loading

    private struct ContinueItem: Equatable {
        let course: Course
        let completed: Int
        let total: Int
        var progress: Double { total > 0 ? Double(completed) / Double(total) : 0 }
    }

    var body: some View {
        Group {
            switch state {
            case .loading:
                LoadingView()
            case .failed:
                ErrorView(
                    title: lmmString("error.generic.title"),
                    message: lmmString("error.generic.message"),
                    retryTitle: lmmString("error.retry")
                ) { Task { await load() } }
            case .loaded:
                content
            }
        }
        .background(LMMColor.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .task { if courses.isEmpty { await load() } }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.xl) {
                header
                if let continueItem {
                    continueSection(continueItem)
                }
                browseSection
            }
            .padding(.horizontal, LMMSpacing.screen)
            .padding(.top, LMMSpacing.md)
            .padding(.bottom, LMMSpacing.xl)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.xs) {
            Text(lmmString("home.eyebrow")).lmmEyebrow()
            Text(greeting)
                .font(LMMFont.display)
                .foregroundStyle(LMMColor.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var greeting: String {
        if let name = greetingName, !name.isEmpty {
            return lmmFormat("home.greeting", name)
        }
        return lmmString("home.greeting.generic")
    }

    private func continueSection(_ item: ContinueItem) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            SectionHeader(
                eyebrow: lmmString("home.continue.eyebrow"),
                title: lmmString("home.continue.title")
            )
            NavigationLink(value: CatalogRoute.course(item.course.id)) {
                ContinueCard(
                    title: item.course.displayTitle(locale),
                    imageURL: item.course.thumbnailUrl.flatMap(URL.init(string:)),
                    progress: item.progress,
                    subtitle: lmmFormat("course.progressCount", item.completed, item.total)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var browseSection: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            SectionHeader(
                eyebrow: lmmString("home.browse.eyebrow"),
                title: lmmString("home.browse.title")
            )
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: LMMSpacing.md) {
                    ForEach(courses.prefix(8)) { course in
                        CourseCardLink(
                            course: course,
                            styleName: course.musicalStyleId.flatMap { styleNames[$0] },
                            canAccess: entitlements.canAccess(course),
                            isEnrolled: enrolledCourseIds.contains(course.id),
                            progress: nil
                        )
                        .frame(width: 230)
                    }
                }
                .padding(.horizontal, 2)
            }
            .padding(.horizontal, -LMMSpacing.screen)
            .padding(.leading, LMMSpacing.screen)
        }
    }

    private func load() async {
        state = .loading
        do {
            let published = try await services.catalog.publishedCourses()
            let styles = try await services.catalog.musicalStyles()
            let enrollments = (try? await services.progress.myEnrollments()) ?? []
            let profile = try? await auth.currentProfile()

            styleNames = Dictionary(uniqueKeysWithValues: styles.map { ($0.id, $0.displayName(locale)) })
            courses = published
            enrolledCourseIds = Set(enrollments.map(\.courseId))
            greetingName = profile?.fullName?.split(separator: " ").first.map(String.init)
            continueItem = await resolveContinueItem(enrollments: enrollments, published: published)
            state = .loaded(())
        } catch {
            state = .failed
        }
    }

    /// Picks the most-recently-accessed enrollment whose course is still published and has a
    /// next unfinished class. Caps structure lookups so the home load stays fast.
    private func resolveContinueItem(
        enrollments: [CourseEnrollment],
        published: [Course]
    ) async -> ContinueItem? {
        let byId = Dictionary(uniqueKeysWithValues: published.map { ($0.id, $0) })
        let ordered = enrollments.sorted {
            ($0.lastAccessedAt ?? .distantPast) > ($1.lastAccessedAt ?? .distantPast)
        }
        for enrollment in ordered.prefix(3) {
            guard let course = byId[enrollment.courseId] else { continue }
            guard let structure = try? await services.catalog.courseStructure(courseId: course.id) else { continue }
            if structure.nextClassId != nil, structure.totalItems > 0 {
                return ContinueItem(
                    course: course,
                    completed: structure.completedItems,
                    total: structure.totalItems
                )
            }
        }
        return nil
    }
}
