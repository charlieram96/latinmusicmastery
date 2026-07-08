import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The real lesson viewer: loads the (cached) ``CourseStructure``, renders the class's items with
/// an item switcher, per-type bodies (video player, quiz placeholder, exercise/jam fallback), and
/// a footer to move between items or mark the current one complete. Locked classes show the
/// reader-compliant locked message inline instead of any item body.
struct ClassViewerView: View {
    let courseId: UUID
    let classId: UUID

    @Environment(AppServices.self) private var services
    @Environment(EntitlementsStore.self) private var entitlements
    @Environment(\.appLocale) private var locale

    @State private var state: LoadState<Void> = .loading
    @State private var course: Course?
    @State private var content: ClassViewerContent?
    @State private var navigator = ClassItemNavigator(count: 0)
    @State private var completedIds: Set<UUID> = []
    @State private var locked = false
    @State private var classTitle = ""

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
                loadedBody
            }
        }
        .background(LMMColor.background)
        .navigationTitle(classTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    // MARK: Loaded

    @ViewBuilder
    private var loadedBody: some View {
        if locked {
            lockedInline
        } else if let content, !content.items.isEmpty {
            VStack(spacing: 0) {
                if content.items.count > 1 {
                    itemSwitcher(content)
                }
                ScrollView {
                    itemContent(content.items[navigator.index])
                        .padding(.horizontal, LMMSpacing.screen)
                        .padding(.vertical, LMMSpacing.lg)
                }
                footer(content)
            }
        } else {
            emptyState
        }
    }

    private var lockedInline: some View {
        ScrollView {
            LockedContentBody(courseName: course.map { $0.displayTitle(locale) })
                .padding(.top, LMMSpacing.xxl)
                .padding(.horizontal, LMMSpacing.screen)
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            systemImage: "tray",
            title: lmmString("viewer.empty.title"),
            message: lmmString("viewer.empty.message")
        )
    }

    // MARK: Item switcher

    private func itemSwitcher(_ content: ClassViewerContent) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: LMMSpacing.xs) {
                ForEach(Array(content.items.enumerated()), id: \.element.id) { index, item in
                    let isActive = index == navigator.index
                    Button {
                        navigator.select(index)
                    } label: {
                        let symbol = completedIds.contains(item.id)
                            ? "checkmark.circle.fill"
                            : itemSymbol(item.itemType)
                        HStack(spacing: LMMSpacing.xxs) {
                            Image(systemName: symbol)
                                .font(.system(size: 12, weight: .semibold))
                            Text("\(index + 1)")
                                .font(LMMFont.caption)
                        }
                        .foregroundStyle(isActive ? LMMColor.onPrimary : LMMColor.foreground)
                        .padding(.horizontal, LMMSpacing.sm)
                        .padding(.vertical, LMMSpacing.xs)
                        .background(
                            Capsule().fill(isActive ? LMMColor.primary : LMMColor.secondary)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(lmmFormat("viewer.part.a11y", index + 1, content.items.count))
                }
            }
            .padding(.horizontal, LMMSpacing.screen)
            .padding(.vertical, LMMSpacing.sm)
        }
        .background(LMMColor.background)
        .overlay(alignment: .bottom) { Divider().overlay(LMMColor.border) }
    }

    // MARK: Item content

    @ViewBuilder
    private func itemContent(_ item: ClassItem) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            Text(lmmFormat("viewer.part.label", navigator.index + 1, (content?.items.count ?? 1)))
                .lmmEyebrow()
            Text(item.displayTitle(locale))
                .font(LMMFont.title2)
                .foregroundStyle(LMMColor.foreground)

            itemMedia(item)

            if item.itemType == .video, let description = item.displayDescription(locale), !description.isEmpty {
                aboutSection(description)
            }

            let paragraphs = RichContentText.paragraphs(from: item.richContent)
            if !paragraphs.isEmpty {
                VStack(alignment: .leading, spacing: LMMSpacing.sm) {
                    ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, para in
                        Text(para)
                            .font(LMMFont.body)
                            .foregroundStyle(LMMColor.foreground.opacity(0.9))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func itemMedia(_ item: ClassItem) -> some View {
        switch item.itemType {
        case .video:
            if item.videoUrl != nil {
                LessonVideoPlayerView(
                    item: item,
                    resolver: services.mediaResolver,
                    resumeSeconds: resumePosition(item),
                    alreadyComplete: completedIds.contains(item.id),
                    defaultSubtitle: locale == .es ? .es : .en,
                    onPersistPosition: { seconds in persistPosition(itemId: item.id, seconds: seconds) },
                    onReachedCompletion: { markComplete(item.id) }
                )
                .id(item.id)
            } else {
                videoUnavailable
            }
        case .quiz:
            QuizRunnerView(itemId: item.id)
                .id(item.id)
        case .exercise, .jamSession:
            ExerciseJamFallbackCard(item: item, resolver: services.mediaResolver)
        case .unknown:
            videoUnavailable
        }
    }

    private var videoUnavailable: some View {
        RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
            .fill(LMMColor.surfaceSunken)
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .overlay(
                Image(systemName: "video.slash")
                    .font(.system(size: 32))
                    .foregroundStyle(LMMColor.mutedForeground)
            )
    }

    private func aboutSection(_ description: String) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.xs) {
            Text(lmmString("viewer.about.title")).lmmEyebrow(color: LMMColor.mutedForeground)
            Text(description)
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.foreground.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Footer

    private func footer(_ content: ClassViewerContent) -> some View {
        let item = content.items[navigator.index]
        let isComplete = completedIds.contains(item.id)
        return HStack(spacing: LMMSpacing.sm) {
            Button {
                navigator.goPrevious()
            } label: {
                Image(systemName: "chevron.left")
            }
            .buttonStyle(.lmmSecondary)
            .disabled(!navigator.canGoPrevious)

            Button {
                if !isComplete { markComplete(item.id) }
            } label: {
                Label(
                    isComplete ? lmmString("viewer.completed") : lmmString("viewer.markComplete"),
                    systemImage: isComplete ? "checkmark.circle.fill" : "circle"
                )
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.lmmPrimary)
            .disabled(isComplete)

            Button {
                navigator.goNext()
            } label: {
                Image(systemName: "chevron.right")
            }
            .buttonStyle(.lmmSecondary)
            .disabled(!navigator.canGoNext)
        }
        .padding(.horizontal, LMMSpacing.screen)
        .padding(.vertical, LMMSpacing.sm)
        .background(LMMColor.surface)
        .overlay(alignment: .top) { Divider().overlay(LMMColor.border) }
    }
}

// MARK: - Helpers & loading

private extension ClassViewerView {
    func itemSymbol(_ type: ClassItemType) -> String {
        switch type {
        case .video: return "play.fill"
        case .quiz: return "checklist"
        case .exercise: return "figure.strengthtraining.traditional"
        case .jamSession: return "music.mic"
        case .unknown: return "square"
        }
    }

    private func resumePosition(_ item: ClassItem) -> Int? {
        if let server = content?.resumePositions[item.id] { return server }
        let stored = UserDefaults.standard.integer(forKey: Self.positionKey(item.id))
        return stored > 0 ? stored : nil
    }

    private static func positionKey(_ itemId: UUID) -> String { "pos.\(itemId.uuidString)" }

    private func persistPosition(itemId: UUID, seconds: Int) {
        UserDefaults.standard.set(seconds, forKey: Self.positionKey(itemId))
        Task { try? await services.progress.updatePosition(itemId: itemId, seconds: seconds) }
    }

    private func markComplete(_ itemId: UUID) {
        guard !completedIds.contains(itemId) else { return }
        completedIds.insert(itemId)
        Task {
            try? await services.progress.markComplete(itemId: itemId)
            // Refresh the structure cache so the sidebar/progress ring reflect the new completion.
            _ = try? await services.catalog.courseStructure(courseId: courseId)
        }
    }

    // MARK: Load

    private func load() async {
        state = .loading
        do {
            async let structureResult = services.catalog.courseStructure(courseId: courseId)
            async let detailResult = services.catalog.courseDetail(id: courseId)
            let structure = try await structureResult
            let loadedCourse = try await detailResult

            guard let derived = ClassViewerContent.derive(from: structure, classId: classId) else {
                state = .failed
                return
            }

            course = loadedCourse
            content = derived
            completedIds = derived.completedItemIds
            navigator = ClassItemNavigator(count: derived.items.count)

            let enriched = enrichedClass(in: structure)
            classTitle = enriched?.courseClass.displayTitle(locale) ?? ""

            // Locked when the class returned no items because RLS gated them.
            if let loadedCourse, let enriched {
                locked = enriched.isLocked(entitlements: entitlements.entitlements, course: loadedCourse)
            } else {
                locked = false
            }

            state = .loaded(())
        } catch {
            state = .failed
        }
    }

    private func enrichedClass(in structure: CourseStructure) -> CourseStructure.EnrichedClass? {
        structure.sections.flatMap(\.classes).first { $0.id == classId }
    }
}
