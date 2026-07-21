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
public struct Waypoint: Equatable, Hashable, Sendable {
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

extension Waypoint: Codable {
    private enum CodingKeys: String, CodingKey {
        case musicalPositionQN
        case videoTimeSeconds
        case measureNumber
        case beatInMeasure
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        musicalPositionQN = try container.decode(MusicalPositionQN.self, forKey: .musicalPositionQN)
        videoTimeSeconds = try container.decode(VideoTimeSec.self, forKey: .videoTimeSeconds)
        // `measureNumber`/`beatInMeasure` are required-but-nullable in the TS model
        // (`number | null`), same nuance as `Track.tuning`/`Track.channel`. `decodeIfPresent`
        // tolerates a key that's flat-out missing too, in case an older writer ever omitted it.
        measureNumber = try container.decodeIfPresent(Int.self, forKey: .measureNumber)
        beatInMeasure = try container.decodeIfPresent(Double.self, forKey: .beatInMeasure)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(musicalPositionQN, forKey: .musicalPositionQN)
        try container.encode(videoTimeSeconds, forKey: .videoTimeSeconds)
        // Deliberately `encode`, not `encodeIfPresent`: these two are required-but-nullable
        // in the TS model, so a `nil` here must round-trip to an explicit JSON `null` (what
        // `JSON.stringify` produces for a JS `null` property) rather than an omitted key
        // (what it produces for `undefined` — which these fields are never assigned). Same
        // fix as `Track.tuning`/`Track.channel` (see that type's `encode(to:)`).
        try container.encode(measureNumber, forKey: .measureNumber)
        try container.encode(beatInMeasure, forKey: .beatInMeasure)
    }
}
