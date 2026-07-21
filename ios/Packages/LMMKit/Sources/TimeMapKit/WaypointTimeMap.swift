import Foundation

/// Port of the error paths `WaypointTimeMap`'s constructor throws (same source file as
/// ``WaypointTimeMap``) — a plain `Error` there too, not a Zod-style structured type.
public struct WaypointTimeMapError: Error, Equatable, Sendable, LocalizedError {
    public let message: String

    public init(_ message: String) {
        self.message = message
    }

    public var errorDescription: String? { message }
}

/// Port of `WaypointTimeMap` (`components/playsense-studio/shared/time-map/time-map.ts`) —
/// the single runtime implementation backing every sync method.
///
/// Edge handling:
///   - Before the first waypoint: extrapolate using the first interval's slope.
///   - After the last waypoint: extrapolate using the last interval's slope.
///   - Requires >= 2 waypoints to construct.
///
/// A `struct` (not the TS `class`) per this task's value-semantics mandate — once
/// constructed the waypoint list never changes, so there is no mutable reference identity
/// to preserve.
public struct WaypointTimeMap: TimeMap, Equatable, Sendable {
    public let id: String
    public let method: SyncMethod

    /// Sorted ascending by `musicalPositionQN`.
    private let waypoints: [Waypoint]

    public init(id: String, method: SyncMethod, waypoints: [Waypoint]) throws {
        guard waypoints.count >= 2 else {
            throw WaypointTimeMapError(
                "WaypointTimeMap requires at least 2 waypoints (got \(waypoints.count))."
            )
        }

        let sorted = waypoints.sorted { $0.musicalPositionQN < $1.musicalPositionQN }

        for index in 1..<sorted.count {
            if sorted[index].musicalPositionQN == sorted[index - 1].musicalPositionQN {
                throw WaypointTimeMapError(
                    "WaypointTimeMap waypoints have duplicate musical positions "
                        + "at qn=\(sorted[index].musicalPositionQN)."
                )
            }
            if sorted[index].videoTimeSeconds <= sorted[index - 1].videoTimeSeconds {
                throw WaypointTimeMapError(
                    "WaypointTimeMap waypoints must have strictly increasing video time "
                        + "(qn=\(sorted[index].musicalPositionQN))."
                )
            }
        }

        self.id = id
        self.method = method
        self.waypoints = sorted
    }

    public var totalQN: MusicalPositionQN {
        waypoints[waypoints.count - 1].musicalPositionQN - waypoints[0].musicalPositionQN
    }

    public var videoStart: VideoTimeSec { waypoints[0].videoTimeSeconds }
    public var videoEnd: VideoTimeSec { waypoints[waypoints.count - 1].videoTimeSeconds }

    public func toVideoTime(_ position: MusicalPositionQN) -> VideoTimeSec {
        if position <= waypoints[0].musicalPositionQN {
            return Self.interpolate(position, waypoints[0], waypoints[1], direction: .qnToTime)
        }
        if position >= waypoints[waypoints.count - 1].musicalPositionQN {
            return Self.interpolate(
                position, waypoints[waypoints.count - 2], waypoints[waypoints.count - 1], direction: .qnToTime
            )
        }

        let index = Self.bisectByQN(waypoints, position)
        return Self.interpolate(position, waypoints[index], waypoints[index + 1], direction: .qnToTime)
    }

    public func toMusicalPosition(_ time: VideoTimeSec) -> MusicalPositionQN {
        if time <= waypoints[0].videoTimeSeconds {
            return Self.interpolate(time, waypoints[0], waypoints[1], direction: .timeToQN)
        }
        if time >= waypoints[waypoints.count - 1].videoTimeSeconds {
            return Self.interpolate(
                time, waypoints[waypoints.count - 2], waypoints[waypoints.count - 1], direction: .timeToQN
            )
        }

        let index = Self.bisectByVideoTime(waypoints, time)
        return Self.interpolate(time, waypoints[index], waypoints[index + 1], direction: .timeToQN)
    }

    public func locate(_ time: VideoTimeSec) -> TimeMapLocation {
        if time <= waypoints[0].videoTimeSeconds {
            return Self.measureBeat(of: waypoints[0])
        }
        if time >= waypoints[waypoints.count - 1].videoTimeSeconds {
            return Self.measureBeat(of: waypoints[waypoints.count - 1])
        }

        let index = Self.bisectByVideoTime(waypoints, time)
        // Snap to the nearer of the two surrounding waypoints — measure/beat is
        // denormalized, not interpolated, so picking the closest is the right semantics
        // for "which measure/beat is currently sounding".
        let left = waypoints[index]
        let right = waypoints[index + 1]
        return abs(time - left.videoTimeSeconds) <= abs(right.videoTimeSeconds - time)
            ? Self.measureBeat(of: left)
            : Self.measureBeat(of: right)
    }

    private enum InterpolationDirection {
        case qnToTime
        case timeToQN
    }

    private static func interpolate(
        _ value: Double,
        _ lower: Waypoint,
        _ upper: Waypoint,
        direction: InterpolationDirection
    ) -> Double {
        switch direction {
        case .qnToTime:
            let slope = (upper.videoTimeSeconds - lower.videoTimeSeconds)
                / (upper.musicalPositionQN - lower.musicalPositionQN)
            return lower.videoTimeSeconds + (value - lower.musicalPositionQN) * slope
        case .timeToQN:
            let slope = (upper.musicalPositionQN - lower.musicalPositionQN)
                / (upper.videoTimeSeconds - lower.videoTimeSeconds)
            return lower.musicalPositionQN + (value - lower.videoTimeSeconds) * slope
        }
    }

    private static func bisectByQN(_ waypoints: [Waypoint], _ position: Double) -> Int {
        var low = 0
        var high = waypoints.count - 1
        while high - low > 1 {
            let mid = (low + high) / 2
            if waypoints[mid].musicalPositionQN <= position { low = mid } else { high = mid }
        }
        return low
    }

    private static func bisectByVideoTime(_ waypoints: [Waypoint], _ time: Double) -> Int {
        var low = 0
        var high = waypoints.count - 1
        while high - low > 1 {
            let mid = (low + high) / 2
            if waypoints[mid].videoTimeSeconds <= time { low = mid } else { high = mid }
        }
        return low
    }

    private static func measureBeat(of waypoint: Waypoint) -> TimeMapLocation {
        TimeMapLocation(measure: waypoint.measureNumber ?? 0, beat: waypoint.beatInMeasure ?? 0)
    }
}
