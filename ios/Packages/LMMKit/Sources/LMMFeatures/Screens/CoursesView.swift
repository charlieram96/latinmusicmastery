import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The Courses browse tab: an adaptive grid of published courses with a title search and an
/// instrument filter row. Access state (free / locked / enrolled) comes from the shared
/// `EntitlementsStore`, so cards reflect what the signed-in user can actually reach.
struct CoursesView: View {
    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.appLocale) private var locale

    @State private var courses: [Course] = []
    @State private var styleNames: [UUID: String] = [:]
    @State private var enrolledCourseIds: Set<UUID> = []
    @State private var searchText = ""
    @State private var selectedInstrument: String?
    @State private var state: LoadState<Void> = .loading

    private let columns = [GridItem(.adaptive(minimum: 160), spacing: LMMSpacing.md)]

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
        .navigationTitle(lmmString("courses.title"))
        .searchable(text: $searchText, prompt: lmmString("courses.search.prompt"))
        .task { if courses.isEmpty { await load() } }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.md) {
                if !instruments.isEmpty {
                    instrumentFilter
                }
                if filteredCourses.isEmpty {
                    EmptyStateView(
                        systemImage: "magnifyingglass",
                        title: lmmString("courses.empty.title"),
                        message: lmmString("courses.empty.message")
                    )
                    .padding(.top, LMMSpacing.xxl)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: LMMSpacing.md) {
                        ForEach(filteredCourses) { course in
                            CourseCardLink(
                                course: course,
                                styleName: course.musicalStyleId.flatMap { styleNames[$0] },
                                canAccess: entitlements.canAccess(course),
                                isEnrolled: enrolledCourseIds.contains(course.id),
                                progress: nil
                            )
                        }
                    }
                    .padding(.horizontal, LMMSpacing.screen)
                }
            }
            .padding(.top, LMMSpacing.xs)
            .padding(.bottom, LMMSpacing.xl)
        }
    }

    private var instrumentFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: LMMSpacing.xs) {
                filterChip(title: lmmString("courses.filter.all"), value: nil)
                ForEach(instruments, id: \.self) { instrument in
                    filterChip(title: CoursePresentation.instrumentLabel(instrument) ?? instrument, value: instrument)
                }
            }
            .padding(.horizontal, LMMSpacing.screen)
        }
    }

    private func filterChip(title: String, value: String?) -> some View {
        let isSelected = selectedInstrument == value
        let fill = isSelected ? AnyShapeStyle(LMMColor.warmGradient) : AnyShapeStyle(LMMColor.secondary)
        return Button {
            selectedInstrument = value
        } label: {
            Text(title)
                .font(LMMFont.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? LMMColor.onPrimary : LMMColor.foreground)
                .padding(.horizontal, LMMSpacing.md)
                .padding(.vertical, LMMSpacing.xs)
                .background(Capsule().fill(fill))
        }
        .buttonStyle(.plain)
    }

    private var instruments: [String] {
        Set(courses.compactMap { $0.instrument?.isEmpty == false ? $0.instrument : nil })
            .sorted()
    }

    private var filteredCourses: [Course] {
        courses.filter { course in
            let matchesInstrument = selectedInstrument == nil || course.instrument == selectedInstrument
            let matchesSearch = searchText.isEmpty
                || course.displayTitle(locale).localizedCaseInsensitiveContains(searchText)
            return matchesInstrument && matchesSearch
        }
    }

    private func load() async {
        state = .loading
        do {
            let published = try await services.catalog.publishedCourses()
            let styles = try await services.catalog.musicalStyles()
            let enrollments = (try? await services.progress.myEnrollments()) ?? []
            styleNames = Dictionary(uniqueKeysWithValues: styles.map { ($0.id, $0.displayName(locale)) })
            courses = published
            enrolledCourseIds = Set(enrollments.map(\.courseId))
            state = .loaded(())
        } catch {
            state = .failed
        }
    }
}
