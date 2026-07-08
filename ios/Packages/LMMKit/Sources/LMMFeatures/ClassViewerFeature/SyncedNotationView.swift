import LMMData
import NotationUI
import SwiftUI

/// SwiftUI bridge that puts a video-synced ``NotationView`` on screen: it owns the
/// ``VideoTransportClock`` (per-frame cursor pump) and the ``NotationSyncDriver`` (section
/// switching + ms/qn math), wiring both to B6's ``LessonVideoPlayerModel`` so the notation tracks
/// the exact same `AVPlayer` the video renders.
///
/// Per-frame updates flow through the display link straight into the driver — never through
/// SwiftUI — so playback drives no view invalidation. `updateUIView` only handles the low-
/// frequency edges: toggling the clock on play/pause and nudging one frame on a paused seek.
struct SyncedNotationView: UIViewRepresentable {
    let sections: [HydratedScoreSection]
    let model: LessonVideoPlayerModel
    let mode: StaffLayoutMode
    /// Passed in so a change re-invokes `updateUIView` (SwiftUI observes it in the parent), letting
    /// a paused seek move the cursor even while the display link is idle.
    let currentSeconds: Double
    let isPlaying: Bool
    let durationSeconds: Double

    func makeCoordinator() -> Coordinator {
        Coordinator(sections: sections, mode: mode, model: model)
    }

    func makeUIView(context: Context) -> NotationView {
        let view = NotationView()
        view.baseStaffSpacePoints = mode == .wrapped ? 11 : 12
        context.coordinator.attach(view)
        // Prime the first frame so the cursor appears before playback starts.
        context.coordinator.driver.onVideoTime(currentSeconds, videoDuration: durationSeconds)
        return view
    }

    func updateUIView(_ uiView: NotationView, context: Context) {
        context.coordinator.clock.setActive(isPlaying)
        // While playing, the display link is authoritative; only drive from SwiftUI when paused
        // (a scrub / skip / resume-restore) so the cursor still follows.
        if !isPlaying {
            context.coordinator.driver.onVideoTime(currentSeconds, videoDuration: durationSeconds)
        }
    }

    static func dismantleUIView(_ uiView: NotationView, coordinator: Coordinator) {
        coordinator.clock.stop()
    }

    @MainActor
    final class Coordinator {
        let driver: NotationSyncDriver
        let clock: VideoTransportClock

        init(sections: [HydratedScoreSection], mode: StaffLayoutMode, model: LessonVideoPlayerModel) {
            self.driver = NotationSyncDriver(sections: sections, mode: mode)
            self.clock = VideoTransportClock(player: model.player)
            driver.onSeek = { [weak model] seconds in model?.seek(to: seconds) }
            clock.onFrame = { [weak driver, weak model] seconds in
                driver?.onVideoTime(seconds, videoDuration: model?.durationSeconds ?? 0)
            }
        }

        func attach(_ view: NotationView) {
            driver.attach(view)
        }
    }
}
