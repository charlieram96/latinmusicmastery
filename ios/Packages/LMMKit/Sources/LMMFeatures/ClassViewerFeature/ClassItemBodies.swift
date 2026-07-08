import AVFoundation
import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// EXERCISE / JAM_SESSION fallback (web's non-PlaySense branch): description, bpm/key badges, an
/// audio player when `audio_url` is present, and a "coming soon" note when a score is attached.
struct ExerciseJamFallbackCard: View {
    let item: ClassItem
    let resolver: MediaURLResolver
    @Environment(\.appLocale) private var locale
    @State private var audioURL: URL?

    private var isJam: Bool { item.itemType == .jamSession }

    var body: some View {
        InfoCard(
            systemImage: isJam ? "music.mic" : "figure.strengthtraining.traditional",
            iconColor: isJam ? LMMColor.terracotta : LMMColor.success,
            title: lmmString(isJam ? "viewer.jam.title" : "viewer.exercise.title")
        ) {
            VStack(alignment: .leading, spacing: LMMSpacing.sm) {
                if let audioURL {
                    SimpleAudioPlayerView(url: audioURL)
                }

                if item.bpm != nil || item.keySignature != nil {
                    HStack(spacing: LMMSpacing.xs) {
                        if let bpm = item.bpm {
                            Badge(.style(lmmFormat("viewer.meta.bpm", bpm)))
                        }
                        if let key = item.keySignature, !key.isEmpty {
                            Badge(.style(lmmFormat("viewer.meta.key", key)))
                        }
                    }
                }

                if let description = item.displayDescription(locale), !description.isEmpty {
                    Text(description)
                        .font(LMMFont.callout)
                        .foregroundStyle(LMMColor.mutedForeground)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if item.scoreDocumentId != nil {
                    #if DEBUG
                    // D23 beta: EXERCISE items with an attached score route to the grading stage (behind
                    // DEBUG until D24's highway replaces the plain stage). Release builds still show the
                    // "coming soon" note.
                    NavigationLink {
                        PlaySenseExerciseLauncher(item: item)
                    } label: {
                        Label("Play (beta)", systemImage: "waveform.path")
                            .font(LMMFont.caption)
                            .foregroundStyle(LMMColor.primary)
                    }
                    #else
                    Label(lmmString("viewer.playsense.comingSoon"), systemImage: "waveform.path")
                        .font(LMMFont.caption)
                        .foregroundStyle(LMMColor.mutedForeground)
                    #endif
                }
            }
        }
        .task(id: item.id) {
            // Reset first: without this, a slow-resolving future item can still be awaiting
            // when the user has already navigated on, and its eventual result would land on
            // whatever the *next* `.task(id:)` run left behind (or worse, momentarily keep
            // showing the *previous* item's player while this one resolves).
            audioURL = nil
            audioURL = await Self.resolvedAudioURL(item: item, resolver: resolver)
        }
    }

    /// Resolves the backing-audio URL through the injected ``MediaURLResolver`` — never
    /// `item.audioUrl` directly — so a future signed-URL resolver applies here too, matching how
    /// ``LessonVideoPlayerView`` resolves the video URL. `nil` when the item has no audio or the
    /// resolver fails; the card simply omits the player.
    static func resolvedAudioURL(item: ClassItem, resolver: MediaURLResolver) async -> URL? {
        try? await resolver.resolveAudio(item)
    }
}

/// A small titled card matching the curriculum surface styling.
struct InfoCard<Content: View>: View {
    let systemImage: String
    let iconColor: Color
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.sm) {
            Label {
                Text(title).font(LMMFont.headline).foregroundStyle(LMMColor.foreground)
            } icon: {
                Image(systemName: systemImage).foregroundStyle(iconColor)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(LMMSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous).fill(LMMColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }
}

/// A minimal audio player (play/pause + elapsed) for jam-session / exercise backing audio.
struct SimpleAudioPlayerView: View {
    let url: URL
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var elapsed: Double = 0
    @State private var observer: Any?

    var body: some View {
        HStack(spacing: LMMSpacing.sm) {
            Button {
                toggle()
            } label: {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(LMMColor.primary)
            }
            .accessibilityLabel(Text(isPlaying ? "Pause audio" : "Play audio"))

            Text(PlayerControlBar.fmt(elapsed))
                .font(.system(.subheadline, design: .default).monospacedDigit())
                .foregroundStyle(LMMColor.mutedForeground)
            Spacer()
            Image(systemName: "waveform")
                .foregroundStyle(LMMColor.mutedForeground.opacity(0.6))
        }
        .padding(LMMSpacing.sm)
        .background(RoundedRectangle(cornerRadius: LMMRadius.md).fill(LMMColor.surfaceSunken))
        .task { setup() }
        .onDisappear { teardown() }
    }

    private func setup() {
        guard player == nil else { return }
        let avPlayer = AVPlayer(url: url)
        observer = avPlayer.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { time in
            elapsed = time.seconds
        }
        player = avPlayer
    }

    private func toggle() {
        guard let player else { return }
        if isPlaying { player.pause() } else { player.play() }
        isPlaying.toggle()
    }

    private func teardown() {
        if let observer { player?.removeTimeObserver(observer) }
        player?.pause()
        player = nil
    }
}
