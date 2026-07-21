import AVFoundation
import QuartzCore
import UIKit

/// A per-frame playback clock for the video-synced notation cursor. While the video is playing a
/// `CADisplayLink` reads `AVPlayer.currentTime()` on every screen refresh and forwards the seconds
/// to `onFrame` — far smoother than the model's ~4 Hz `addPeriodicTimeObserver` heartbeat, which
/// is the reason the web needed RAF interpolation over its 4 Hz `timeupdate` (we read the true
/// clock each frame instead).
///
/// It does NOT own or observe the player's play/pause state — the SwiftUI layer drives `setActive`
/// off B6's `LessonVideoPlayerModel.isPlaying` (which already KVOs `timeControlStatus`), so there
/// is exactly one source of truth for "is playing". The per-frame path allocates nothing: the
/// stored `onFrame` closure is reused and `step()` reads a value type.
@MainActor
final class VideoTransportClock {
    /// Called each frame with the current playback time in seconds. Reused every tick.
    var onFrame: ((Double) -> Void)?

    private weak var player: AVPlayer?
    private var displayLink: CADisplayLink?

    init(player: AVPlayer) {
        self.player = player
    }

    /// Start or stop the per-frame pump. Idempotent — safe to call on every `isPlaying` change.
    func setActive(_ active: Bool) {
        if active { start() } else { stop() }
    }

    private func start() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(step))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    /// Push one frame immediately (used on a paused seek so the cursor tracks the scrubber even
    /// when the display link isn't running).
    func tickOnce() {
        emit()
    }

    @objc private func step() {
        emit()
    }

    private func emit() {
        guard let player else { return }
        let seconds = player.currentTime().seconds
        guard seconds.isFinite else { return }
        onFrame?(seconds)
    }

    deinit {
        displayLink?.invalidate()
    }
}
