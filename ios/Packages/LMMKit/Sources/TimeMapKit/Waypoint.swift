import Foundation

/// Port of `MusicalPositionQN` (`components/playsense-studio/shared/time-map/time-map.ts`).
public typealias MusicalPositionQN = Double

/// Port of `VideoTimeSec` (same source file).
public typealias VideoTimeSec = Double

/// Port of `SyncMethod` (same source file) — how a time map's waypoints were produced.
/// Persisted verbatim as `score_time_maps.method`.
public enum SyncMethod: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case tempo
    case tap
    case drag
    case midi
}

/// Port of `Waypoint` (same source file) — one (musical position, video time) pair.
public struct Waypoint: Codable, Equatable, Hashable, Sendable {
    public var musicalPositionQN: MusicalPositionQN
    public var videoTimeSeconds: VideoTimeSec
    /// Denormalized for "jump to measure 17" without recomputing. `nil` measure/beat is
    /// valid — some waypoints (e.g. a `tap`-sync anchor between beats) don't fall exactly
    /// on one.
    public var measureNumber: Int?
    public var beatInMeasure: Double?

    public init(
        musicalPositionQN: MusicalPositionQN,
        videoTimeSeconds: VideoTimeSec,
        measureNumber: Int? = nil,
        beatInMeasure: Double? = nil
    ) {
        self.musicalPositionQN = musicalPositionQN
        self.videoTimeSeconds = videoTimeSeconds
        self.measureNumber = measureNumber
        self.beatInMeasure = beatInMeasure
    }
}
