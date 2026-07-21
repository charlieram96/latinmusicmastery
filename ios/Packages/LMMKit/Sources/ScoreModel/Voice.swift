import Foundation

/// Port of `Voice` (`components/playsense-studio/shared/score-model/types.ts`).
public struct Voice: Codable, Equatable, Hashable, Sendable {
    /// 1-based voice number within the measure.
    public var number: Int
    public var events: [MusicalEvent]

    public init(number: Int, events: [MusicalEvent]) {
        self.number = number
        self.events = events
    }
}
