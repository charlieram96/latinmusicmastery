import LMMDesignSystem
import SwiftUI

/// The custom, warm-dark control bar for the lesson player — a pure view driven entirely by a
/// value ``State`` plus action closures, so it renders (and snapshot-tests) without an
/// `AVPlayer`. Mirrors the web `lesson-video-player.tsx` control row: play/pause, ±10s skip, a
/// buffered scrubber with A/B loop markers and a drag-preview time, elapsed/remaining, a speed
/// menu, A/B loop controls, a captions menu, AirPlay, and fullscreen.
struct PlayerControlBar: View {
    struct State: Equatable {
        var currentSeconds: Double = 0
        var durationSeconds: Double = 0
        var bufferedSeconds: Double = 0
        var isPlaying: Bool = false
        var playbackRate: Double = 1
        var loopAPct: Double?
        var loopBPct: Double?
        var loopEnabled: Bool = false
        var loopHasEndpoints: Bool = false
        var loopValid: Bool = false
        var subtitleLabels: [String] = []
        var activeSubtitleLabel: String?
        var isFullscreen: Bool = false
    }

    let state: State
    var onPlayPause: () -> Void = {}
    var onSkipBack: () -> Void = {}
    var onSkipForward: () -> Void = {}
    var onScrub: (Double) -> Void = { _ in }
    var onScrubPreview: (Double?) -> Void = { _ in }
    var onSetSpeed: (Double) -> Void = { _ in }
    var onSetLoopA: () -> Void = {}
    var onSetLoopB: () -> Void = {}
    var onToggleLoop: () -> Void = {}
    var onClearLoop: () -> Void = {}
    var onSelectSubtitle: (String?) -> Void = { _ in }
    var onToggleFullscreen: () -> Void = {}
    var airPlay: AnyView?

    private static let speeds = LessonVideoPlayerModel.speeds

    private var playedPct: Double {
        state.durationSeconds > 0 ? state.currentSeconds / state.durationSeconds : 0
    }

    private var bufferedPct: Double {
        state.durationSeconds > 0 ? state.bufferedSeconds / state.durationSeconds : 0
    }

    var body: some View {
        VStack(spacing: LMMSpacing.xs) {
            scrubber
            controlRow
        }
        .padding(.horizontal, LMMSpacing.xs)
        .padding(.top, LMMSpacing.xl)
        .padding(.bottom, LMMSpacing.xs)
        .background(
            LinearGradient(
                colors: [.black.opacity(0.85), .black.opacity(0.35), .clear],
                startPoint: .bottom,
                endPoint: .top
            )
        )
    }

    // MARK: Scrubber

    private var scrubber: some View {
        ScrubberBar(
            playedPct: playedPct,
            bufferedPct: bufferedPct,
            loopAPct: state.loopAPct,
            loopBPct: state.loopBPct,
            durationSeconds: state.durationSeconds,
            onScrub: onScrub,
            onPreview: onScrubPreview
        )
        .frame(height: 16)
    }

    // MARK: Control row

    private var controlRow: some View {
        HStack(spacing: 1) {
            ControlIconButton(
                system: state.isPlaying ? "pause.fill" : "play.fill",
                label: state.isPlaying ? "Pause" : "Play",
                action: onPlayPause
            )
            ControlIconButton(system: "gobackward.10", label: "Back 10 seconds", action: onSkipBack)
            ControlIconButton(system: "goforward.10", label: "Forward 10 seconds", action: onSkipForward)

            Text("\(Self.fmt(state.currentSeconds)) / \(Self.fmt(state.durationSeconds))")
                .font(.system(size: 11, weight: .medium).monospacedDigit())
                .foregroundStyle(.white.opacity(0.9))
                .padding(.leading, LMMSpacing.xxs)
                .lineLimit(1)
                .fixedSize()
                .layoutPriority(1)

            Spacer(minLength: 0)

            loopControls
            speedMenu
            if !state.subtitleLabels.isEmpty { captionsMenu }
            if let airPlay {
                airPlay.frame(width: 30, height: 34)
            }
            ControlIconButton(
                system: fullscreenSymbol,
                label: state.isFullscreen ? "Exit fullscreen" : "Fullscreen",
                action: onToggleFullscreen
            )
        }
    }

    private var fullscreenSymbol: String {
        state.isFullscreen
            ? "arrow.down.right.and.arrow.up.left"
            : "arrow.up.left.and.arrow.down.right"
    }

    private var loopControls: some View {
        HStack(spacing: 0) {
            ControlTextButton(text: "A", label: "Set loop start", active: state.loopAPct != nil, action: onSetLoopA)
            ControlTextButton(text: "B", label: "Set loop end", active: state.loopBPct != nil, action: onSetLoopB)
            ControlIconButton(
                system: "repeat",
                label: "Toggle loop",
                active: state.loopEnabled,
                disabled: !state.loopValid,
                action: onToggleLoop
            )
            if state.loopHasEndpoints {
                ControlIconButton(system: "arrow.counterclockwise", label: "Clear loop", action: onClearLoop)
            }
        }
    }

    private var speedMenu: some View {
        Menu {
            ForEach(Self.speeds, id: \.self) { speed in
                Button {
                    onSetSpeed(speed)
                } label: {
                    Label(Self.speedLabel(speed), systemImage: state.playbackRate == speed ? "checkmark" : "")
                }
            }
        } label: {
            Text(Self.speedLabel(state.playbackRate))
                .font(.system(size: 12, weight: .bold).monospacedDigit())
                .foregroundStyle(state.playbackRate == 1 ? .white.opacity(0.9) : LMMColor.primary)
                .frame(width: 34, height: 34)
        }
        .accessibilityLabel("Playback speed")
    }

    private var captionsMenu: some View {
        Menu {
            Button {
                onSelectSubtitle(nil)
            } label: {
                Label("Off", systemImage: state.activeSubtitleLabel == nil ? "checkmark" : "")
            }
            ForEach(state.subtitleLabels, id: \.self) { label in
                Button {
                    onSelectSubtitle(label)
                } label: {
                    Label(label, systemImage: state.activeSubtitleLabel == label ? "checkmark" : "")
                }
            }
        } label: {
            Image(systemName: state.activeSubtitleLabel == nil ? "captions.bubble" : "captions.bubble.fill")
                .foregroundStyle(state.activeSubtitleLabel == nil ? .white.opacity(0.9) : LMMColor.primary)
                .frame(width: 34, height: 34)
        }
        .accessibilityLabel("Subtitles")
    }

    // MARK: Formatting

    static func fmt(_ seconds: Double) -> String {
        let total = Int(seconds.isFinite && seconds > 0 ? seconds : 0)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    static func speedLabel(_ rate: Double) -> String {
        rate == rate.rounded() ? "\(Int(rate))x" : "\(rate)x"
    }
}

// MARK: - Scrubber

private struct ScrubberBar: View {
    let playedPct: Double
    let bufferedPct: Double
    let loopAPct: Double?
    let loopBPct: Double?
    let durationSeconds: Double
    let onScrub: (Double) -> Void
    let onPreview: (Double?) -> Void

    @SwiftUI.State private var hoverPct: Double?

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.2)).frame(height: 4)
                Capsule().fill(.white.opacity(0.28)).frame(width: width * bufferedPct, height: 4)
                if let aPct = loopAPct, let bPct = loopBPct, bPct > aPct {
                    Capsule()
                        .fill(LMMColor.gold.opacity(0.45))
                        .frame(width: width * (bPct - aPct), height: 4)
                        .offset(x: width * aPct)
                }
                Capsule().fill(LMMColor.primary).frame(width: width * playedPct, height: 4)
                loopMarker(loopAPct, width: width)
                loopMarker(loopBPct, width: width)
                Circle()
                    .fill(LMMColor.primary)
                    .frame(width: 13, height: 13)
                    .offset(x: width * playedPct - 6.5)
                if let hoverPct {
                    Text(PlayerControlBar.fmt(hoverPct * durationSeconds))
                        .font(.system(size: 10, weight: .medium).monospacedDigit())
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Capsule().fill(.black.opacity(0.9)))
                        .foregroundStyle(.white)
                        .offset(x: min(max(width * hoverPct - 20, 0), width - 40), y: -20)
                }
            }
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let pct = min(max(value.location.x / width, 0), 1)
                        hoverPct = pct
                        onPreview(pct)
                        onScrub(pct)
                    }
                    .onEnded { _ in
                        hoverPct = nil
                        onPreview(nil)
                    }
            )
        }
    }

    @ViewBuilder
    private func loopMarker(_ pct: Double?, width: CGFloat) -> some View {
        if let pct {
            Rectangle()
                .fill(LMMColor.gold)
                .frame(width: 2, height: 12)
                .offset(x: width * pct - 1)
        }
    }
}

// MARK: - Buttons

private struct ControlIconButton: View {
    let system: String
    let label: String
    var active: Bool = false
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(active ? LMMColor.primary : .white.opacity(0.9))
                .frame(width: 30, height: 34)
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}

private struct ControlTextButton: View {
    let text: String
    let label: String
    var active: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(active ? LMMColor.primary : .white.opacity(0.9))
                .frame(width: 22, height: 34)
        }
        .accessibilityLabel(label)
    }
}
