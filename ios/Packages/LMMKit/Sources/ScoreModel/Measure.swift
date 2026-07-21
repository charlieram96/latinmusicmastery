import Foundation

/// Port of `Measure` (`components/playsense-studio/shared/score-model/types.ts`).
public struct Measure: Codable, Equatable, Hashable, Sendable {
    /// 1-based measure number.
    public var number: Int
    /// Optional time-signature change at this measure.
    public var timeSignature: TimeSignature?
    /// Optional tempo change at the start of this measure (quarter-note BPM).
    public var tempoChange: Double?
    /// Optional key signature change (fifths, -7..7).
    public var keyFifths: Int?
    /// Voices within this measure. The editor permits max 2 in schema v1.
    public var voices: [Voice]

    public init(
        number: Int,
        timeSignature: TimeSignature? = nil,
        tempoChange: Double? = nil,
        keyFifths: Int? = nil,
        voices: [Voice]
    ) {
        self.number = number
        self.timeSignature = timeSignature
        self.tempoChange = tempoChange
        self.keyFifths = keyFifths
        self.voices = voices
    }
}
