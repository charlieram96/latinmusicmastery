import AVFoundation
import LMMData
import LMMDesignSystem
import LMMModels
import SwiftUI

/// The lesson video player: an `AVPlayerLayer` surface with a fully custom SwiftUI control
/// overlay. Resolves the playback URL through the injected ``MediaURLResolver``, restores the
/// resume position, and tears the player down on disappear.
struct LessonVideoPlayerView: View {
    let item: ClassItem
    let resolver: MediaURLResolver
    let resumeSeconds: Int?
    let alreadyComplete: Bool
    let defaultSubtitle: SubtitleLang?
    var onPersistPosition: (@MainActor (Int) -> Void)?
    var onReachedCompletion: (@MainActor () -> Void)?
    /// Handed the player model once it's built, so a container (C18 video-synced notation) can
    /// drive the notation cursor off the very same `AVPlayer` — the player keeps owning the model.
    var onModelReady: (@MainActor (LessonVideoPlayerModel) -> Void)?

    @State private var model: LessonVideoPlayerModel?
    @State private var loadFailed = false
    @State private var controlsVisible = true
    @State private var hideWorkItem: DispatchWorkItem?
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            if let model {
                player(model)
            } else if loadFailed {
                failure
            } else {
                loading
            }
        }
        .aspectRatio(16.0 / 9.0, contentMode: .fit)
        .frame(maxWidth: .infinity)
        .background(Color.black)
        .clipShape(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous))
        .task(id: item.id) { await setup() }
        .onDisappear { model?.flushPosition(); model?.teardown() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { model?.flushPosition() }
        }
    }

    // MARK: Surface

    @ViewBuilder
    private func player(_ model: LessonVideoPlayerModel) -> some View {
        PlayerSurface(
            model: model,
            role: .inline,
            controlsVisible: $controlsVisible,
            onInteraction: bumpControls,
            onToggleFullscreen: { toggleFullscreen(model) }
        )
        .fullScreenCover(isPresented: fullscreenBinding(model)) {
            FullscreenPlayer(model: model, onExit: { toggleFullscreen(model) })
        }
    }

    private var loading: some View {
        LoadingView().tint(.white)
    }

    private var failure: some View {
        VStack(spacing: LMMSpacing.sm) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 28))
                .foregroundStyle(.white.opacity(0.8))
            Text(lmmString("viewer.video.unavailable"))
                .font(LMMFont.subheadline)
                .foregroundStyle(.white.opacity(0.8))
                .multilineTextAlignment(.center)
        }
        .padding(LMMSpacing.lg)
    }

    // MARK: Setup / teardown

    private func setup() async {
        guard model == nil else { return }
        do {
            let url = try await resolver.resolve(item)
            let created = LessonVideoPlayerModel(
                url: url,
                resumeSeconds: resumeSeconds,
                alreadyComplete: alreadyComplete,
                defaultSubtitle: defaultSubtitle
            )
            created.onPersistPosition = onPersistPosition
            created.onReachedCompletion = onReachedCompletion
            model = created
            onModelReady?(created)
            await created.loadSubtitles(subtitleTracks())
        } catch {
            loadFailed = true
        }
    }

    private func subtitleTracks() -> [LessonSubtitleTrack] {
        ClassItemSubtitle.parse(item.subtitles).compactMap { entry in
            guard let url = URL(string: entry.src) else { return nil }
            return LessonSubtitleTrack(
                lang: SubtitleLang(code: entry.lang),
                label: SubtitleLanguages.label(for: entry.lang),
                url: url
            )
        }
    }

    // MARK: Controls auto-hide

    private func bumpControls() {
        controlsVisible = true
        hideWorkItem?.cancel()
        guard let model, model.isPlaying else { return }
        let work = DispatchWorkItem { controlsVisible = false }
        hideWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: work)
    }

    private func toggleFullscreen(_ model: LessonVideoPlayerModel) {
        model.isFullscreen.toggle()
    }

    private func fullscreenBinding(_ model: LessonVideoPlayerModel) -> Binding<Bool> {
        Binding(get: { model.isFullscreen }, set: { model.isFullscreen = $0 })
    }
}

/// The shared player surface (video layer + first-play button + control overlay + caption
/// overlay), reused inline and fullscreen. Building the control state here keeps the two call
/// sites identical.
private struct PlayerSurface: View {
    let model: LessonVideoPlayerModel
    let role: PlayerLayerView.Role
    @Binding var controlsVisible: Bool
    var onInteraction: () -> Void = {}
    var onToggleFullscreen: () -> Void = {}

    var body: some View {
        ZStack {
            PlayerLayerView(model: model, role: role)
                .contentShape(Rectangle())
                .onTapGesture {
                    if model.hasStarted {
                        controlsVisible.toggle()
                        onInteraction()
                    } else {
                        model.play()
                        onInteraction()
                    }
                }

            captionOverlay

            if !model.hasStarted {
                firstPlayButton
            }

            VStack {
                Spacer()
                if controlsVisible || !model.hasStarted {
                    controlBar
                        .transition(.opacity)
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: controlsVisible)
        .onChange(of: model.isPlaying) { _, _ in onInteraction() }
    }

    private var firstPlayButton: some View {
        Button {
            model.play()
            onInteraction()
        } label: {
            ZStack {
                Circle().fill(LMMColor.primary.opacity(0.92)).frame(width: 72, height: 72)
                Image(systemName: "play.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(.white)
                    .offset(x: 2)
            }
        }
        .accessibilityLabel(Text(verbatim: "Play video"))
    }

    @ViewBuilder
    private var captionOverlay: some View {
        if let cue = model.activeCueText, model.activeSubtitle != nil {
            VStack {
                Spacer()
                Text(cue)
                    .font(.system(.callout, design: .default).weight(.medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, LMMSpacing.sm)
                    .padding(.vertical, LMMSpacing.xxs)
                    .background(RoundedRectangle(cornerRadius: LMMRadius.sm).fill(.black.opacity(0.6)))
                    .padding(.bottom, controlsVisible ? 96 : LMMSpacing.lg)
                    .padding(.horizontal, LMMSpacing.md)
            }
            .allowsHitTesting(false)
        }
    }

    private var controlBar: some View {
        PlayerControlBar(
            state: controlState,
            onPlayPause: { model.togglePlayPause(); onInteraction() },
            onSkipBack: { model.skip(-10); onInteraction() },
            onSkipForward: { model.skip(10); onInteraction() },
            onScrub: { pct in model.seek(to: pct * model.durationSeconds); onInteraction() },
            onScrubPreview: { _ in },
            onSetSpeed: { model.setPlaybackRate($0); onInteraction() },
            onSetLoopA: { model.setLoopA(); onInteraction() },
            onSetLoopB: { model.setLoopB(); onInteraction() },
            onToggleLoop: { model.toggleLoopEnabled(); onInteraction() },
            onClearLoop: { model.clearLoop(); onInteraction() },
            onSelectSubtitle: { label in
                let lang = model.availableSubtitles.first { $0.label == label }?.lang
                model.setActiveSubtitle(lang)
                onInteraction()
            },
            onToggleFullscreen: onToggleFullscreen,
            airPlay: AnyView(AirPlayRoutePicker())
        )
    }

    private var controlState: PlayerControlBar.State {
        let duration = model.durationSeconds
        func pct(_ seconds: Double?) -> Double? {
            guard let seconds, duration > 0 else { return nil }
            return seconds / duration
        }
        return PlayerControlBar.State(
            currentSeconds: model.currentSeconds,
            durationSeconds: duration,
            bufferedSeconds: model.bufferedSeconds,
            isPlaying: model.isPlaying,
            playbackRate: model.playbackRate,
            loopAPct: pct(model.loop.pointA),
            loopBPct: pct(model.loop.pointB),
            loopEnabled: model.loop.isEnabled,
            loopHasEndpoints: model.loop.pointA != nil || model.loop.pointB != nil,
            loopValid: model.loop.isValid,
            subtitleLabels: model.availableSubtitles.map(\.label),
            activeSubtitleLabel: model.activeSubtitle?.label,
            isFullscreen: model.isFullscreen
        )
    }
}

/// Fullscreen presentation of the same model. The inline layer detaches while this is up (see
/// ``PlayerLayerView``), so one `AVPlayer` never feeds two layers.
private struct FullscreenPlayer: View {
    let model: LessonVideoPlayerModel
    let onExit: () -> Void
    @State private var controlsVisible = true

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            PlayerSurface(
                model: model,
                role: .fullscreen,
                controlsVisible: $controlsVisible,
                onToggleFullscreen: onExit
            )
        }
        .statusBarHidden(true)
        .onDisappear { model.isFullscreen = false }
    }
}
