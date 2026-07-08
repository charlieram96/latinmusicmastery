import Foundation
import ScoreModel

// Port of `lib/play-sense/types.ts` — the PlaySense game vocabulary. `TimeSignature` is
// reused from ScoreModel (same `[number, number]` wire shape). Session/UI-state types
// (`SessionState`, `CalibrationData`, `AttemptData`) are deliberately not ported here:
// they belong to the session layer (D20+), not the pure scoring core.

/// Port of `Instrument = PercussionInstrument | PitchedInstrument`. Distinct from
/// `ScoreModel.Instrument` (the studio's score-model vocabulary) — the bridge between the
/// two is `scoreToExerciseDefinition`'s instrument map.
public enum Instrument: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    // Percussion
    case conga
    case timbale
    case bongo
    case clave
    case cowbell
    case guiro
    // Pitched / melodic
    case guitar
    case bass
    case piano
    case tres
    case cuatro
    case trumpet
    case saxophone
    case flute
    case violin
}

/// Port of `InstrumentCategory`.
public enum InstrumentCategory: String, Codable, Equatable, Hashable, Sendable {
    case percussion
    case pitched
}

/// Port of `getInstrumentCategory` — classify an instrument as percussion or pitched.
public func getInstrumentCategory(_ instrument: Instrument) -> InstrumentCategory {
    switch instrument {
    case .conga, .timbale, .bongo, .clave, .cowbell, .guiro:
        return .percussion
    case .guitar, .bass, .piano, .tres, .cuatro, .trumpet, .saxophone, .flute, .violin:
        return .pitched
    }
}

/// Port of `Technique`.
public enum Technique: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case open
    case slap
    case mute
    case bass
    case touch
    case rim
    case shell
    case bell
    case tip
    case heel
}

/// Port of `Hand` (`'R' | 'L'`).
public enum Hand: String, Codable, Equatable, Hashable, Sendable {
    case right = "R"
    case left = "L"
}

/// Port of `Difficulty`.
public enum Difficulty: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case beginner
    case intermediate
    case advanced
}

/// Port of `HitGrade`.
public enum HitGrade: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case perfect
    case good
    // `ok` mirrors the TS literal; two letters is the whole name.
    // swiftlint:disable:next identifier_name
    case ok
    case miss
}

/// Port of `TimingFeedback`.
public enum TimingFeedback: String, Codable, Equatable, Hashable, Sendable {
    case early
    case onTime = "on_time"
    case late
}

/// Port of `ExerciseEvent`.
public struct ExerciseEvent: Codable, Equatable, Hashable, Sendable {
    /// Beat position: 1-based, supports decimals for subdivisions (1, 1.5, 2, 2.25...).
    public var beat: Double
    /// Which measure (1-based).
    public var measure: Int
    /// Instrument producing this event.
    public var instrument: Instrument
    /// Technique — scored for percussion when technique scoring is enabled.
    public var technique: Technique
    /// Which hand (for notation stem direction and technique analysis).
    public var hand: Hand
    /// Duration in beats — scored for pitched instruments (sustain).
    public var duration: Double
    /// VexFlow note key for staff position.
    public var vexKey: String
    /// Whether this is an accent (louder expected).
    public var accent: Bool
    /// Expected pitch as MIDI note number (pitched instruments only).
    public var expectedPitch: Int?
    /// Expected note name for display (e.g. "C4", "Eb3").
    public var expectedNoteName: String?
    /// Expected drum surface for PlaySense scoring (e.g. "quinto", "macho").
    public var surface: String?
    /// Chord group id (pitched instruments only). All notes of one strummed chord share
    /// the same id so the scorer can grade them as a set. Single notes are `nil`. Stays
    /// one event per note — only grading collapses the group.
    public var chordId: String?

    public init(
        beat: Double,
        measure: Int,
        instrument: Instrument,
        technique: Technique,
        hand: Hand,
        duration: Double,
        vexKey: String,
        accent: Bool,
        expectedPitch: Int? = nil,
        expectedNoteName: String? = nil,
        surface: String? = nil,
        chordId: String? = nil
    ) {
        self.beat = beat
        self.measure = measure
        self.instrument = instrument
        self.technique = technique
        self.hand = hand
        self.duration = duration
        self.vexKey = vexKey
        self.accent = accent
        self.expectedPitch = expectedPitch
        self.expectedNoteName = expectedNoteName
        self.surface = surface
        self.chordId = chordId
    }
}

/// Port of `ExerciseDefinition`.
public struct ExerciseDefinition: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var description: String
    public var instrument: Instrument
    public var bpm: Double
    public var timeSignature: TimeSignature
    public var swing: Double
    public var difficulty: Difficulty
    public var measures: Int
    public var loopCount: Int
    public var events: [ExerciseEvent]
    public var audioUrl: String?

    public init(
        id: String,
        title: String,
        description: String,
        instrument: Instrument,
        bpm: Double,
        timeSignature: TimeSignature,
        swing: Double,
        difficulty: Difficulty,
        measures: Int,
        loopCount: Int,
        events: [ExerciseEvent],
        audioUrl: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.instrument = instrument
        self.bpm = bpm
        self.timeSignature = timeSignature
        self.swing = swing
        self.difficulty = difficulty
        self.measures = measures
        self.loopCount = loopCount
        self.events = events
        self.audioUrl = audioUrl
    }
}

/// Port of `AttemptStats`.
public struct AttemptStats: Codable, Equatable, Sendable {
    public var score: Double
    public var accuracy: Double
    public var perfectCount: Int
    public var goodCount: Int
    public var okCount: Int
    public var missCount: Int
    public var extraHits: Int
    public var maxCombo: Int
    public var maxStreak: Int
    public var avgOffsetMs: Double
    public var tempoDriftMs: Double
    public var durationSeconds: Double
    /// Pitch accuracy percentage for pitched instruments (`nil` if not applicable).
    public var pitchAccuracy: Double?

    public init(
        score: Double,
        accuracy: Double,
        perfectCount: Int,
        goodCount: Int,
        okCount: Int,
        missCount: Int,
        extraHits: Int,
        maxCombo: Int,
        maxStreak: Int,
        avgOffsetMs: Double,
        tempoDriftMs: Double,
        durationSeconds: Double,
        pitchAccuracy: Double?
    ) {
        self.score = score
        self.accuracy = accuracy
        self.perfectCount = perfectCount
        self.goodCount = goodCount
        self.okCount = okCount
        self.missCount = missCount
        self.extraHits = extraHits
        self.maxCombo = maxCombo
        self.maxStreak = maxStreak
        self.avgOffsetMs = avgOffsetMs
        self.tempoDriftMs = tempoDriftMs
        self.durationSeconds = durationSeconds
        self.pitchAccuracy = pitchAccuracy
    }
}

/// Port of `OnsetEvent` — one detected hit from the audio/BLE pipeline.
public struct OnsetEvent: Codable, Equatable, Sendable {
    public var timestamp: Double
    public var energy: Double
    /// Detected frequency in Hz at onset (pitched instruments).
    public var frequency: Double?
    /// Detected MIDI note number at onset.
    public var midiNote: Int?
    /// Which drum surface was hit — set by the PlaySense BLE device only.
    public var surface: String?
    /// 12-bin pitch-class chroma vector (normalized to max) computed from a short
    /// post-onset window. Set only for chordal instruments; used for chord scoring.
    public var chroma: [Double]?

    public init(
        timestamp: Double,
        energy: Double,
        frequency: Double? = nil,
        midiNote: Int? = nil,
        surface: String? = nil,
        chroma: [Double]? = nil
    ) {
        self.timestamp = timestamp
        self.energy = energy
        self.frequency = frequency
        self.midiNote = midiNote
        self.surface = surface
        self.chroma = chroma
    }
}

/// Port of `ToleranceWindows` (all values in milliseconds).
public struct ToleranceWindows: Codable, Equatable, Sendable {
    public var perfect: Double
    public var good: Double
    // Mirrors the TS field name; two letters is the whole name.
    // swiftlint:disable:next identifier_name
    public var ok: Double

    // swiftlint:disable:next identifier_name
    public init(perfect: Double, good: Double, ok: Double) {
        self.perfect = perfect
        self.good = good
        self.ok = ok
    }
}
