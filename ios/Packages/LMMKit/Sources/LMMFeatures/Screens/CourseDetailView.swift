import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// A course's detail screen: hero, progress, a Continue action into the next class, and the
/// curriculum broken out by section. Opening a course enrolls the user (matching the web),
/// and tapping a class the user can't reach opens the reader-compliant locked sheet rather
/// than the viewer.
struct CourseDetailView: View {
    let courseId: UUID

    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.appLocale) private var locale

    @State private var course: Course?
    @State private var structure: CourseStructure?
    @State private var styleName: String?
    @State private var state: LoadState<Void> = .loading
    @State private var lockedSheetShown = false
    @State private var didEnroll = false

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
                if let course, let structure {
                    content(course: course, structure: structure)
                }
            }
        }
        .background(LMMColor.background)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .sheet(isPresented: $lockedSheetShown) {
            LockedContentSheet(courseName: course.map { $0.displayTitle(locale) })
        }
    }

    private func content(course: Course, structure: CourseStructure) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.lg) {
                hero(course: course)
                progressBlock(course: course, structure: structure)
                curriculum(course: course, structure: structure)
            }
            .padding(.horizontal, LMMSpacing.screen)
            .padding(.bottom, LMMSpacing.xl)
        }
    }

    // MARK: Hero

    private func hero(course: Course) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .fill(LMMColor.warmGradient)
                .aspectRatio(16.0 / 9.0, contentMode: .fit)
                .overlay(
                    Image(systemName: "music.note")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(LMMColor.onPrimary.opacity(0.85))
                )
                .overlay {
                    if let url = course.thumbnailUrl.flatMap(URL.init(string:)) {
                        AsyncImage(url: url) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                Color.clear
                            }
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous))

            HStack(spacing: LMMSpacing.xs) {
                if let styleName {
                    Badge(.style(styleName))
                }
                if let instrument = CoursePresentation.instrumentLabel(course.instrument) {
                    Badge(.instrument(instrument))
                }
            }

            Text(course.displayTitle(locale))
                .font(LMMFont.title)
                .foregroundStyle(LMMColor.foreground)

            if let description = course.displayDescription(locale), !description.isEmpty {
                Text(description)
                    .font(LMMFont.callout)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.top, LMMSpacing.xs)
    }

    // MARK: Progress + Continue

    private func progressBlock(course: Course, structure: CourseStructure) -> some View {
        VStack(spacing: LMMSpacing.md) {
            HStack(spacing: LMMSpacing.md) {
                ProgressRing(progress: progressFraction(structure), lineWidth: 7)
                    .frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
                    Text(lmmFormat("course.progressCount", structure.completedItems, structure.totalItems))
                        .font(LMMFont.headline)
                        .foregroundStyle(LMMColor.foreground)
                    Text(CoursePresentation.classesLabel(count: structure.sections.reduce(0) { $0 + $1.classes.count }))
                        .font(LMMFont.subheadline)
                        .foregroundStyle(LMMColor.mutedForeground)
                }
                Spacer()
            }

            if let nextClassId = structure.nextClassId {
                NavigationLink(value: CatalogRoute.classViewer(courseId: course.id, classId: nextClassId)) {
                    Text(structure.completedItems == 0 ? lmmString("course.start") : lmmString("course.continue"))
                }
                .buttonStyle(.lmmPrimary)
            }
        }
        .padding(LMMSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .fill(LMMColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    private func progressFraction(_ structure: CourseStructure) -> Double {
        structure.totalItems > 0 ? Double(structure.completedItems) / Double(structure.totalItems) : 0
    }

    // MARK: Curriculum

    private func curriculum(course: Course, structure: CourseStructure) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.lg) {
            SectionHeader(
                eyebrow: lmmString("course.curriculum.eyebrow"),
                title: lmmString("course.curriculum.title")
            )
            ForEach(structure.sections) { section in
                VStack(alignment: .leading, spacing: LMMSpacing.sm) {
                    if structure.sections.count > 1 {
                        Text(section.section.displayTitle(locale))
                            .font(LMMFont.headline)
                            .foregroundStyle(LMMColor.foreground)
                    }
                    VStack(spacing: 0) {
                        ForEach(Array(section.classes.enumerated()), id: \.element.id) { index, enriched in
                            classRow(course: course, enriched: enriched)
                            if index < section.classes.count - 1 {
                                Divider().overlay(LMMColor.border)
                            }
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                            .fill(LMMColor.surface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                            .strokeBorder(LMMColor.border, lineWidth: 1)
                    )
                }
            }
        }
    }

    @ViewBuilder
    private func classRow(course: Course, enriched: CourseStructure.EnrichedClass) -> some View {
        let locked = enriched.isLocked(entitlements: entitlements.entitlements, course: course)
        let content = ClassRowContent(
            title: enriched.courseClass.displayTitle(locale),
            subtitle: rowSubtitle(enriched),
            state: rowState(enriched: enriched, locked: locked),
            isFree: enriched.courseClass.isFree == true && !locked
        )
        if locked {
            Button { lockedSheetShown = true } label: { content }
                .buttonStyle(.plain)
        } else {
            NavigationLink(value: CatalogRoute.classViewer(courseId: course.id, classId: enriched.id)) {
                content
            }
            .buttonStyle(.plain)
        }
    }

    private func rowSubtitle(_ enriched: CourseStructure.EnrichedClass) -> String {
        var parts: [String] = [CoursePresentation.itemsLabel(count: enriched.totalItems)]
        let duration = enriched.items.reduce(0) { $0 + ($1.videoDurationSeconds ?? 0) }
        if let minutes = CoursePresentation.minutesLabel(seconds: duration) {
            parts.append(minutes)
        }
        return parts.joined(separator: " · ")
    }

    private func rowState(enriched: CourseStructure.EnrichedClass, locked: Bool) -> ClassRowContent.State {
        if locked { return .locked }
        if enriched.totalItems > 0, enriched.completedItems >= enriched.totalItems { return .completed }
        if enriched.completedItems > 0 { return .inProgress }
        return .available
    }

    // MARK: Loading

    private func load() async {
        state = .loading
        do {
            async let detail = services.catalog.courseDetail(id: courseId)
            async let structureResult = services.catalog.courseStructure(courseId: courseId)
            async let styles = services.catalog.musicalStyles()
            let loadedCourse = try await detail
            let loadedStructure = try await structureResult
            let styleList = try await styles

            course = loadedCourse
            structure = loadedStructure
            styleName = loadedCourse?.musicalStyleId.flatMap { id in
                styleList.first { $0.id == id }?.displayName(locale)
            }
            state = .loaded(())
            await enrollIfNeeded()
        } catch {
            state = .failed
        }
    }

    /// Enrolls the user on first open, mirroring the web's behavior. Fire-and-forget: a
    /// failure here never blocks viewing the course.
    private func enrollIfNeeded() async {
        guard !didEnroll else { return }
        didEnroll = true
        try? await services.progress.enroll(courseId: courseId)
    }
}
