import Foundation

/// Port of `ExpectedEvent` (`scoring.ts`).
public struct ExpectedEvent: Codable, Equatable, Sendable {
    public var eventIndex: Int
    /// Seconds.
    public var timestamp: Double
    /// Expected MIDI note number for pitched instruments.
    public var expectedPitch: Int?
    /// Expected technique for percussion technique scoring.
    public var expectedTechnique: String?
    /// Expected duration in seconds for sustain scoring.
    public var expectedDurationSec: Double?
    /// Expected drum surface for PlaySense scoring.
    public var expectedSurface: String?
    /// Chord group id — all notes of one chord share it (pitched instruments only).
    public var chordId: String?

    public init(
        eventIndex: Int,
        timestamp: Double,
        expectedPitch: Int? = nil,
        expectedTechnique: String? = nil,
        expectedDurationSec: Double? = nil,
        expectedSurface: String? = nil,
        chordId: String? = nil
    ) {
        self.eventIndex = eventIndex
        self.timestamp = timestamp
        self.expectedPitch = expectedPitch
        self.expectedTechnique = expectedTechnique
        self.expectedDurationSec = expectedDurationSec
        self.expectedSurface = expectedSurface
        self.chordId = chordId
    }
}
