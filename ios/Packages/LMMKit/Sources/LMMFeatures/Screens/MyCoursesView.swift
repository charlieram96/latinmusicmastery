import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The My Courses tab: the user's enrollments with their progress. Empty until the user
/// enrolls in something, at which point it points them to the Courses tab.
struct MyCoursesView: View {
    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.appLocale) private var locale
    @Environment(\.selectCoursesTab) private var selectCoursesTab

    @State private var items: [EnrolledCourse] = []
    @State private var styleNames: [UUID: String] = [:]
    @State private var state: LoadState<Void> = .loading

    private struct EnrolledCourse: Identifiable {
        let course: Course
        let progress: Double
        var id: UUID { course.id }
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
        .navigationTitle(lmmString("myCourses.title"))
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        if items.isEmpty {
            EmptyStateView(
                systemImage: "bookmark",
                title: lmmString("myCourses.empty.title"),
                message: lmmString("myCourses.empty.message"),
                actionTitle: lmmString("myCourses.empty.action"),
                action: selectCoursesTab
            )
        } else {
            ScrollView {
                VStack(spacing: LMMSpacing.md) {
                    ForEach(items) { item in
                        CourseCardLink(
                            course: item.course,
                            styleName: item.course.musicalStyleId.flatMap { styleNames[$0] },
                            canAccess: entitlements.canAccess(item.course),
                            isEnrolled: true,
                            progress: item.progress
                        )
                    }
                }
                .padding(.horizontal, LMMSpacing.screen)
                .padding(.vertical, LMMSpacing.md)
            }
        }
    }

    private func load() async {
        state = .loading
        do {
            let enrollments = try await services.progress.myEnrollments()
            let published = try await services.catalog.publishedCourses()
            let styles = try await services.catalog.musicalStyles()
            styleNames = Dictionary(uniqueKeysWithValues: styles.map { ($0.id, $0.displayName(locale)) })

            let byId = Dictionary(uniqueKeysWithValues: published.map { ($0.id, $0) })
            let ordered = enrollments.sorted {
                ($0.lastAccessedAt ?? .distantPast) > ($1.lastAccessedAt ?? .distantPast)
            }
            var resolved: [EnrolledCourse] = []
            for enrollment in ordered {
                guard let course = byId[enrollment.courseId] else { continue }
                let progress = await progressFraction(courseId: course.id)
                resolved.append(EnrolledCourse(course: course, progress: progress))
            }
            items = resolved
            state = .loaded(())
        } catch {
            state = .failed
        }
    }

    private func progressFraction(courseId: UUID) async -> Double {
        guard let structure = try? await services.catalog.courseStructure(courseId: courseId),
              structure.totalItems > 0 else { return 0 }
        return Double(structure.completedItems) / Double(structure.totalItems)
    }
}
