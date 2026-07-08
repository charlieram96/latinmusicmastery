import LMMData
import LMMDesignSystem
import LMMModels
import NotationUI
import SwiftUI

/// The media body for a VIDEO lesson item: the B6 video player, plus — when the item carries
/// score sections (``ScoreRepository/scoreSections(classItemId:)``) — a video-synced notation
/// panel beside/below it. On a compact width (iPhone) it stacks (video 16:9 on top, notation in a
/// horizontally-scrolling strip below); on a regular width (iPad) it splits side-by-side with a
/// draggable divider, the notation wrapped with pinch zoom. A plain video item (no sections) falls
/// straight through to the unchanged ``LessonVideoPlayerView``.
///
/// Sections load only here, for an already-unlocked item (the class viewer gates locked classes
/// before any body renders, and RLS gates the rows regardless).
struct VideoNotationBody: View {
    let item: ClassItem
    let resolver: MediaURLResolver
    let resumeSeconds: Int?
    let alreadyComplete: Bool
    let defaultSubtitle: SubtitleLang?
    var onPersistPosition: (@MainActor (Int) -> Void)?
    var onReachedCompletion: (@MainActor () -> Void)?

    @Environment(AppServices.self) private var services
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var model: LessonVideoPlayerModel?
    @State private var sections: [HydratedScoreSection] = []
    @State private var splitFraction: CGFloat = 0.5
    @State private var dragStartFraction: CGFloat?

    private var isRegular: Bool { horizontalSizeClass == .regular }

    var body: some View {
        Group {
            if !sections.isEmpty, let model {
                if isRegular {
                    splitLayout(model: model)
                } else {
                    stackedLayout(model: model)
                }
            } else {
                videoPlayer
            }
        }
        .task(id: item.id) { await loadSections() }
    }

    // MARK: Layouts

    private func stackedLayout(model: LessonVideoPlayerModel) -> some View {
        VStack(spacing: LMMSpacing.sm) {
            videoPlayer
            notationPanel(model: model, mode: .scroll)
                .frame(height: 220)
        }
    }

    private func splitLayout(model: LessonVideoPlayerModel) -> some View {
        GeometryReader { proxy in
            let dividerWidth: CGFloat = 12
            let available = proxy.size.width - dividerWidth
            let videoWidth = max(0, available * splitFraction)
            HStack(spacing: 0) {
                videoPlayer
                    .frame(width: videoWidth)
                divider(totalWidth: available)
                notationPanel(model: model, mode: .wrapped)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 360)
    }

    private func divider(totalWidth: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(LMMColor.border)
            .frame(width: 4)
            .frame(maxHeight: .infinity)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    .onChanged { value in
                        guard totalWidth > 0 else { return }
                        // `translation` is cumulative from the drag's start, so anchor to the
                        // fraction captured when the drag began (clamped 0.3–0.7).
                        let start = dragStartFraction ?? splitFraction
                        dragStartFraction = start
                        splitFraction = min(0.7, max(0.3, start + value.translation.width / totalWidth))
                    }
                    .onEnded { _ in dragStartFraction = nil }
            )
            .accessibilityLabel(Text(verbatim: "Resize video and notation"))
    }

    // MARK: Pieces

    private var videoPlayer: some View {
        LessonVideoPlayerView(
            item: item,
            resolver: resolver,
            resumeSeconds: resumeSeconds,
            alreadyComplete: alreadyComplete,
            defaultSubtitle: defaultSubtitle,
            onPersistPosition: onPersistPosition,
            onReachedCompletion: onReachedCompletion,
            onModelReady: { model = $0 }
        )
        .id(item.id)
    }

    private func notationPanel(model: LessonVideoPlayerModel, mode: StaffLayoutMode) -> some View {
        SyncedNotationView(
            sections: sections,
            model: model,
            mode: mode,
            currentSeconds: model.currentSeconds,
            isPlaying: model.isPlaying,
            durationSeconds: model.durationSeconds
        )
        .clipShape(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    // MARK: Load

    private func loadSections() async {
        sections = []
        guard item.itemType == .video else { return }
        let loaded = (try? await services.score.scoreSections(classItemId: item.id)) ?? []
        // Only sections that actually have notation are worth showing.
        sections = loaded.filter { !$0.scoreDocument.tracks.isEmpty }
    }
}
