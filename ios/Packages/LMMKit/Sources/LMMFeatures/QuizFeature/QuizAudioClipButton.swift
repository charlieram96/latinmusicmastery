import AVFoundation
import LMMDesignSystem
import SwiftUI

/// A compact play/pause control for a short answer-option clip — the web's `AudioChoicePlayer`.
/// Deliberately tiny (icon only, no scrubber/elapsed) since it lives inside an option tile.
struct QuizAudioClipButton: View {
    let url: URL
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var endObserver: NSObjectProtocol?

    var body: some View {
        Button {
            toggle()
        } label: {
            Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                .font(.system(size: 28))
                .foregroundStyle(LMMColor.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(isPlaying ? lmmString("quiz.pause") : lmmString("quiz.play")))
        .onDisappear { teardown() }
    }

    private func toggle() {
        let avPlayer = player ?? makePlayer()
        if isPlaying {
            avPlayer.pause()
            isPlaying = false
        } else {
            avPlayer.seek(to: .zero)
            avPlayer.play()
            isPlaying = true
        }
    }

    private func makePlayer() -> AVPlayer {
        let avPlayer = AVPlayer(url: url)
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: avPlayer.currentItem,
            queue: .main
        ) { _ in
            isPlaying = false
        }
        player = avPlayer
        return avPlayer
    }

    private func teardown() {
        player?.pause()
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        player = nil
        isPlaying = false
    }
}
