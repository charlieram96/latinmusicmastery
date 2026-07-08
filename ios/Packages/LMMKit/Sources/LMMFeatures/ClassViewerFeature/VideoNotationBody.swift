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
    /// Committed video/notation split (regular width). Updated only when a divider drag ENDS.
    @State private var splitFraction: CGFloat = 0.5
    /// The container's measured width, read via a zero-impact background reader so the divider's
    /// fraction math has a total width without wrapping the whole body in a greedy `GeometryReader`
    /// (that ancestor would differ between the plain and split shapes → remount the player).
    @State private var containerWidth: CGFloat = 0
    /// Live divider translation, held in gesture state so a cancelled/interrupted drag auto-resets
    /// to zero (no stale anchor left behind — the old `dragStartFraction` was only cleared in
    /// `onEnded`, so a cancelled gesture stranded it).
    @GestureState private var dragTranslation: CGFloat = 0

    private var isRegular: Bool { horizontalSizeClass == .regular }
    private var showNotation: Bool { !sections.isEmpty && model != nil }
    /// Split side-by-side only when there's notation to show AND the width is regular (iPad).
    private var isSplit: Bool { showNotation && isRegular }

    private static let dividerWidth: CGFloat = 12

    var body: some View {
        content
            // Measure width without a layout-shaping ancestor (background never affects size).
            .background(
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { containerWidth = proxy.size.width }
                        .onChange(of: proxy.size.width) { _, width in containerWidth = width }
                }
            )
            .task(id: item.id) { await loadSections() }
    }

    /// The player lives at ONE structural position (always the first child) so it is NEVER
    /// remounted when sections arrive — an `AnyLayout` swaps the container between vertical (stack)
    /// and horizontal (split) shapes while preserving every child's identity, and the notation is
    /// simply appended as a second child. A remount here would re-resolve the URL and visibly
    /// reload/re-buffer the video the instant a scored lesson's sections finished loading.
    @ViewBuilder
    private var content: some View {
        let layout = isSplit
            ? AnyLayout(HStackLayout(spacing: 0))
            : AnyLayout(VStackLayout(spacing: showNotation ? LMMSpacing.sm : 0))
        layout {
            videoPlayer
                .frame(width: isSplit ? videoWidth : nil)
            if showNotation, let model {
                if isSplit { divider }
                notationPanel(model: model, mode: isSplit ? .wrapped : .scroll)
                    .frame(height: isSplit ? nil : 220)
                    .frame(maxWidth: isSplit ? .infinity : nil)
            }
        }
        .frame(height: isSplit ? 360 : nil)
    }

    // MARK: Split geometry

    /// Available width for the two panes (container minus the divider gutter).
    private var splitAvailable: CGFloat { max(0, containerWidth - Self.dividerWidth) }

    /// Effective split fraction while a drag is in flight = committed fraction + live translation,
    /// clamped 0.3–0.7. When the drag ends the committed `splitFraction` absorbs it; when it is
    /// cancelled `dragTranslation` auto-resets, so the panes snap cleanly back — no stale anchor.
    private var effectiveFraction: CGFloat {
        guard splitAvailable > 0 else { return splitFraction }
        return min(0.7, max(0.3, splitFraction + dragTranslation / splitAvailable))
    }

    private var videoWidth: CGFloat { max(0, splitAvailable * effectiveFraction) }

    private var divider: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(LMMColor.border)
            .frame(width: 4)
            .frame(maxHeight: .infinity)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
            .gesture(
                DragGesture()
                    // `translation` is cumulative from the drag's start; holding it in gesture
                    // state means an interrupted/cancelled drag resets it to 0 automatically.
                    .updating($dragTranslation) { value, state, _ in state = value.translation.width }
                    .onEnded { value in
                        guard splitAvailable > 0 else { return }
                        splitFraction = min(0.7, max(0.3, splitFraction + value.translation.width / splitAvailable))
                    }
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
        // Stable explicit identity keyed on the item — preserves (does not defeat) identity across
        // the AnyLayout shape change, since the id is constant for a given lesson item.
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
        // This fires for EVERY video item, including the many plain (unscored) ones — deliberate.
        // The catalog rows carry no "has sections" flag, so there is no cheap existence signal to
        // gate on; the query itself is the check. It's cheap after the first hit: the repository
        // caches the result under the 5-min `catalogTTL`, so re-opening an item (or a plain video
        // with an empty result) is served from memory, not the network.
        let loaded = (try? await services.score.scoreSections(classItemId: item.id)) ?? []
        // Only sections that actually have notation are worth showing.
        sections = loaded.filter { !$0.scoreDocument.tracks.isEmpty }
    }
}
