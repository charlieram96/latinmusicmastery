import Foundation
import ScoreModel

/// Port of `playsense-studio-player.tsx`'s `buildTimeMap` synthesis branch — the fixed-tempo
/// fallback used when a section has NO published time map (the brief's map-less-section question).
///
/// Web parity: a section without an `active_time_map` still shows a moving cursor. The video is
/// assumed to play at the score's own tempo — the first event sits at video t=0 and the last beat
/// lands at either the video's real duration (if known) or the score's tempo-derived duration,
/// whichever is larger (so a longer video never clamps the notation short). This yields a 2-
/// waypoint linear map; `WaypointTimeMap` extrapolates its single slope outside the range.
public enum SyntheticTimeMap {
    /// Returns `active` verbatim when present; otherwise synthesizes a fixed-tempo map for
    /// `trackIndex` of `score`. `nil` when no usable notation exists (no track / no measures /
    /// zero-length), in which case the caller shows no cursor.
    public static func resolve(
        score: ScoreDocument,
        trackIndex: Int,
        active: WaypointTimeMap?,
        videoDurationSeconds: Double
    ) -> WaypointTimeMap? {
        if let active { return active }

        guard trackIndex >= 0, trackIndex < score.tracks.count else { return nil }
        let track = score.tracks[trackIndex]
        guard let firstMeasure = track.measures.first, let lastMeasure = track.measures.last else { return nil }

        let totalQN = ScoreTime.trackDurationQN(track: track, score: score)
        guard totalQN > 0 else { return nil }

        let tempoBasedSeconds = ScoreTime.qnToTrackMs(track: track, score: score, qn: totalQN) / 1000
        let endVideoSeconds = videoDurationSeconds > 0
            ? max(videoDurationSeconds, tempoBasedSeconds)
            : tempoBasedSeconds
        guard endVideoSeconds > 0 else { return nil }

        let waypoints = [
            Waypoint(musicalPositionQN: 0, videoTimeSeconds: 0, measureNumber: firstMeasure.number, beatInMeasure: 1),
            Waypoint(
                musicalPositionQN: totalQN, videoTimeSeconds: endVideoSeconds,
                measureNumber: lastMeasure.number, beatInMeasure: 1
            )
        ]
        return try? WaypointTimeMap(id: "synthetic", method: .tempo, waypoints: waypoints)
    }
}
