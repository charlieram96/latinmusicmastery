import Foundation
import LMMData
import NotationUI
import ScoreModel
import TimeMapKit

/// Drives the notation cursor from video time. Given the lesson's score sections, on each video
/// frame it: picks the active/displayed section (``resolveSection``), swaps the loaded score into
/// the ``NotationView`` when the displayed section changes, converts video seconds → score-ms
/// through the section's time map, and moves the playhead. Tap-to-seek runs the inverse (qn →
/// video time) back out through `onSeek`.
///
/// The pure math (section resolution, time-map synthesis, ms/qn conversion) lives in TimeMapKit /
/// ScoreModel / NotationUI and is unit-tested there; this type is the thin imperative wiring that
/// holds the loaded-section cache and the current time map. Mirrors the memoized derivation in
/// `playsense-studio-player.tsx` (activeSection → displaySection → cursorMs → StaffRenderer).
@MainActor
final class NotationSyncDriver {
    /// One lesson section normalized for sync — always shows track 0 (mobile v1, matching the web
    /// default `activeTrackIndex = 0`).
    private struct SyncSection {
        let id: UUID
        let range: SectionRange
        let score: ScoreDocument
        let activeTimeMap: WaypointTimeMap?
        static let trackIndex = 0
    }

    /// Seek the video to a time in seconds (wired to the player by the SwiftUI layer).
    var onSeek: ((Double) -> Void)?

    private weak var notationView: NotationView?
    private let sections: [SyncSection]
    /// Precomputed once from the fixed sections — the per-frame `resolve(at:)` allocates nothing.
    private let resolver: SectionResolver
    private let mode: StaffLayoutMode

    private var loadedIndex = -1
    private var currentTimeMap: WaypointTimeMap?
    private var lastResolvedDuration: Double = 0

    init(sections: [HydratedScoreSection], mode: StaffLayoutMode) {
        self.mode = mode
        self.sections = sections.map {
            SyncSection(
                id: $0.section.id,
                range: SectionRange(
                    videoStartSeconds: $0.section.videoStartSeconds,
                    videoEndSeconds: $0.section.videoEndSeconds
                ),
                score: $0.scoreDocument,
                activeTimeMap: $0.activeTimeMap
            )
        }
        self.resolver = SectionResolver(self.sections.map(\.range))
    }

    /// Bind the view and route its taps to `onSeek` via the current section's time map.
    func attach(_ view: NotationView) {
        notationView = view
        view.onSeekQN = { [weak self] quarter in
            guard let self, let timeMap = self.currentTimeMap else { return }
            self.onSeek?(timeMap.toVideoTime(quarter))
        }
    }

    /// Advance the cursor for a video time (called per frame while playing and on each paused
    /// seek). Idempotent for a given `seconds` — safe to call from both the display link and
    /// SwiftUI's low-frequency updates.
    func onVideoTime(_ seconds: Double, videoDuration: Double) {
        guard !sections.isEmpty, let view = notationView else { return }

        let resolution = resolver.resolve(at: seconds)
        loadIfNeeded(index: resolution.displayIndex, videoDuration: videoDuration, view: view)

        guard let timeMap = currentTimeMap, resolution.displayIndex < sections.count else {
            view.setCursorVisible(false)
            return
        }

        // Hide the cursor in gaps (web-parity v1) — the displayed section's notation stays on
        // screen but the playhead only lives while a section is genuinely active.
        view.setCursorVisible(resolution.hasNotation)
        guard resolution.hasNotation else { return }

        let section = sections[resolution.displayIndex]
        let track = section.score.tracks[SyncSection.trackIndex]
        let quarter = timeMap.toMusicalPosition(seconds)
        let scoreMs = ScoreTime.qnToTrackMs(track: track, score: section.score, qn: quarter)
        view.setCursorTime(scoreMs: scoreMs)
    }

    private func loadIfNeeded(index: Int, videoDuration: Double, view: NotationView) {
        // Re-resolve a synthetic map once the real video duration is known (it stretches the map).
        let durationChanged = currentTimeMap?.method == .tempo
            && sections[safe: index]?.activeTimeMap == nil
            && abs(videoDuration - lastResolvedDuration) > 0.5

        guard index != loadedIndex || durationChanged else { return }
        guard let section = sections[safe: index] else { return }

        if index != loadedIndex {
            loadedIndex = index
            view.load(score: section.score, trackIndex: SyncSection.trackIndex, mode: mode)
        }
        lastResolvedDuration = videoDuration
        currentTimeMap = SyntheticTimeMap.resolve(
            score: section.score,
            trackIndex: SyncSection.trackIndex,
            active: section.activeTimeMap,
            videoDurationSeconds: videoDuration
        )
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
