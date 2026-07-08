import Foundation

/// Port of `{ measure: number; beat: number }`, the return shape of `TimeMap.locate`
/// (`components/playsense-studio/shared/time-map/time-map.ts`).
public struct TimeMapLocation: Equatable, Hashable, Sendable {
    public let measure: Int
    public let beat: Double

    public init(measure: Int, beat: Double) {
        self.measure = measure
        self.beat = beat
    }
}

/// Port of the `TimeMap` interface (same source file) — the abstraction between musical
/// position and video time. All four sync methods (tempo, tap, drag, midi) materialize
/// into the same dense waypoint format; consumers only ever depend on this protocol.
public protocol TimeMap: Sendable {
    var id: String { get }
    var method: SyncMethod { get }

    func toVideoTime(_ position: MusicalPositionQN) -> VideoTimeSec
    func toMusicalPosition(_ time: VideoTimeSec) -> MusicalPositionQN
    func locate(_ time: VideoTimeSec) -> TimeMapLocation

    var totalQN: MusicalPositionQN { get }
    var videoStart: VideoTimeSec { get }
    var videoEnd: VideoTimeSec { get }
}
