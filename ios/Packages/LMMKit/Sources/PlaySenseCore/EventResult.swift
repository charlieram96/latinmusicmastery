import Foundation

/// The TS `EventResult.pitchCorrect` tri-state (`boolean | null | undefined`), modeled
/// explicitly because `computeStats` treats the three absent-ish states differently:
/// `undefined` (``notApplicable``) is EXCLUDED from the pitchAccuracy denominator, while
/// `null` (``unknown``) counts in the denominator but not the numerator.
public enum PitchJudgment: Equatable, Hashable, Sendable {
    /// TS `undefined` — not a pitched slot at all (e.g. `greedyMatch` results).
    case notApplicable
    /// TS `null` — a pitched-capable slot whose pitch couldn't be judged (also what
    /// `gradeSingleOnset` reports for percussion).
    case unknown
    /// TS `true`.
    case correct
    /// TS `false`.
    case wrong
}

/// Port of `EventResult`. Optional fields collapse TS `undefined`/`null` into `nil`
/// except `pitchCorrect`, whose tri-state is behavioral (see ``PitchJudgment``).
public struct EventResult: Equatable, Sendable {
    public var eventIndex: Int
    public var grade: HitGrade
    public var offsetMs: Double?
    public var timing: TimingFeedback?
    public var onsetEnergy: Double?
    /// Detected pitch in Hz (pitched instruments only).
    public var detectedPitch: Double?
    /// Whether the detected pitch matched the expected note (tri-state — see type docs).
    public var pitchCorrect: PitchJudgment
    /// Cents offset from expected pitch (-50 to +50).
    public var pitchCents: Double?
    /// Whether the detected technique matched (percussion).
    public var techniqueCorrect: Bool?
    /// Duration held in beats (pitched instruments).
    public var durationHeld: Double?
    /// Whether the correct drum surface was hit (PlaySense mode).
    public var surfaceCorrect: Bool?
    /// Which drum surface was actually hit (PlaySense mode).
    public var detectedSurface: String?

    public init(
        eventIndex: Int,
        grade: HitGrade,
        offsetMs: Double?,
        timing: TimingFeedback?,
        onsetEnergy: Double?,
        detectedPitch: Double? = nil,
        pitchCorrect: PitchJudgment = .notApplicable,
        pitchCents: Double? = nil,
        techniqueCorrect: Bool? = nil,
        durationHeld: Double? = nil,
        surfaceCorrect: Bool? = nil,
        detectedSurface: String? = nil
    ) {
        self.eventIndex = eventIndex
        self.grade = grade
        self.offsetMs = offsetMs
        self.timing = timing
        self.onsetEnergy = onsetEnergy
        self.detectedPitch = detectedPitch
        self.pitchCorrect = pitchCorrect
        self.pitchCents = pitchCents
        self.techniqueCorrect = techniqueCorrect
        self.durationHeld = durationHeld
        self.surfaceCorrect = surfaceCorrect
        self.detectedSurface = detectedSurface
    }
}

extension EventResult: Codable {
    private enum CodingKeys: String, CodingKey {
        case eventIndex
        case grade
        case offsetMs
        case timing
        case onsetEnergy
        case detectedPitch
        case pitchCorrect
        case pitchCents
        case techniqueCorrect
        case durationHeld
        case surfaceCorrect
        case detectedSurface
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        eventIndex = try container.decode(Int.self, forKey: .eventIndex)
        grade = try container.decode(HitGrade.self, forKey: .grade)
        offsetMs = try container.decodeIfPresent(Double.self, forKey: .offsetMs)
        timing = try container.decodeIfPresent(TimingFeedback.self, forKey: .timing)
        onsetEnergy = try container.decodeIfPresent(Double.self, forKey: .onsetEnergy)
        detectedPitch = try container.decodeIfPresent(Double.self, forKey: .detectedPitch)
        // The tri-state: key absent (TS undefined) vs explicit null vs bool.
        if !container.contains(.pitchCorrect) {
            pitchCorrect = .notApplicable
        } else if try container.decodeNil(forKey: .pitchCorrect) {
            pitchCorrect = .unknown
        } else {
            pitchCorrect = try container.decode(Bool.self, forKey: .pitchCorrect) ? .correct : .wrong
        }
        pitchCents = try container.decodeIfPresent(Double.self, forKey: .pitchCents)
        techniqueCorrect = try container.decodeIfPresent(Bool.self, forKey: .techniqueCorrect)
        durationHeld = try container.decodeIfPresent(Double.self, forKey: .durationHeld)
        surfaceCorrect = try container.decodeIfPresent(Bool.self, forKey: .surfaceCorrect)
        detectedSurface = try container.decodeIfPresent(String.self, forKey: .detectedSurface)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventIndex, forKey: .eventIndex)
        try container.encode(grade, forKey: .grade)
        // These three are always present on the TS wire (null for a miss).
        try container.encode(offsetMs, forKey: .offsetMs)
        try container.encode(timing, forKey: .timing)
        try container.encode(onsetEnergy, forKey: .onsetEnergy)
        try container.encodeIfPresent(detectedPitch, forKey: .detectedPitch)
        switch pitchCorrect {
        case .notApplicable:
            break // TS undefined → key absent
        case .unknown:
            try container.encodeNil(forKey: .pitchCorrect)
        case .correct:
            try container.encode(true, forKey: .pitchCorrect)
        case .wrong:
            try container.encode(false, forKey: .pitchCorrect)
        }
        try container.encodeIfPresent(pitchCents, forKey: .pitchCents)
        try container.encodeIfPresent(techniqueCorrect, forKey: .techniqueCorrect)
        try container.encodeIfPresent(durationHeld, forKey: .durationHeld)
        try container.encodeIfPresent(surfaceCorrect, forKey: .surfaceCorrect)
        try container.encodeIfPresent(detectedSurface, forKey: .detectedSurface)
    }
}
