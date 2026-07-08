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
        // Keep the clock bound to the CURRENT model's player. Post-fix the player view is no longer
        // remounted when sections load, so the model is stable and this is a no-op — but if a model
        // is ever reassigned under us, re-point the clock rather than silently pumping a stale,
        // detached `AVPlayer` (the coordinator captured the first model's player at makeCoordinator).
        context.coordinator.bind(model: model)
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
        private(set) var clock: VideoTransportClock
        private var model: LessonVideoPlayerModel

        init(sections: [HydratedScoreSection], mode: StaffLayoutMode, model: LessonVideoPlayerModel) {
            self.driver = NotationSyncDriver(sections: sections, mode: mode)
            self.model = model
            self.clock = VideoTransportClock(player: model.player)
            wire(to: model)
        }

        /// Re-point the clock + seek at `newModel` if the model instance changed. The player view
        /// no longer remounts on section load, so this should never fire; the assertion catches a
        /// regression in that guarantee, and the rebuild keeps the cursor correct if it ever does.
        func bind(model newModel: LessonVideoPlayerModel) {
            guard newModel !== model else { return }
            assertionFailure("SyncedNotationView model reassigned after mount — player was remounted")
            clock.stop()
            model = newModel
            clock = VideoTransportClock(player: newModel.player)
            wire(to: newModel)
        }

        private func wire(to model: LessonVideoPlayerModel) {
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
