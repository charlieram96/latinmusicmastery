import Foundation

/// Port of `SectionRange` (`lib/playsense-studio/active-section.ts`).
public struct SectionRange: Equatable, Hashable, Sendable {
    /// `nil` start = always eligible (the synthetic single-section case).
    public let videoStartSeconds: VideoTimeSec?
    /// `nil` end = open-ended (stays active to the end of the video).
    public let videoEndSeconds: VideoTimeSec?

    public init(videoStartSeconds: VideoTimeSec?, videoEndSeconds: VideoTimeSec?) {
        self.videoStartSeconds = videoStartSeconds
        self.videoEndSeconds = videoEndSeconds
    }
}

/// Port of `pickActiveSection` (`lib/playsense-studio/active-section.ts`).
///
/// A video lesson carries multiple scored sections, each valid over a video time-range.
/// Given the current video time, picks which section's notation to show (or `-1` → none).
/// Pure, so it can be unit-tested in isolation.
///
/// Index of the section active at video time `time`, or `-1` if none. Among eligible
/// sections (start <= time <= end), the one with the LATEST start wins, so adjacent or
/// overlapping sections resolve deterministically.
public func pickActiveSection(_ sections: [SectionRange], at time: VideoTimeSec) -> Int {
    var best = -1
    var bestStart = -Double.infinity

    for (index, section) in sections.enumerated() {
        let startsOk = section.videoStartSeconds.map { time >= $0 } ?? true
        let endsOk = section.videoEndSeconds.map { time <= $0 } ?? true
        guard startsOk, endsOk else { continue }

        let startValue = section.videoStartSeconds ?? -Double.infinity
        if startValue >= bestStart {
            bestStart = startValue
            best = index
        }
    }

    return best
}
