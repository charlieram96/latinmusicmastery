import Foundation
import ScoreModel

@testable import PlaySenseCore

// Decodable harnesses for the golden fixture files. Each mirrors the JSON emitted by the
// scratchpad generator (see Fixtures/README.md). Inputs decode into the real PlaySenseCore
// types (ExpectedEvent, OnsetEvent, EventResult, …) so the parity tests exercise the same
// Codable path the app will use.

// MARK: - gradeSingleOnset

struct GradeSingleOnsetFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: Output
    }

    struct Input: Decodable {
        let onsetTimestamp: Double
        let onsetEnergy: Double
        let expectedEvents: [ExpectedEvent]
        let matchedIndices: [Int]
        let difficulty: Difficulty
        let calibrationOffsetSec: Double
        let widenMs: Double
        let instrumentCategory: InstrumentCategory
        let detectedMidiNote: Int?
        let detectedFrequency: Double?
        let detectedSurface: String?
    }

    struct Output: Decodable {
        let result: EventResult?
        let matchedIndices: [Int]
    }
}

// MARK: - gradeChordOnset

struct GradeChordOnsetFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: Output
    }

    struct Input: Decodable {
        let onsetTimestamp: Double
        let onsetEnergy: Double
        let expectedEvents: [ExpectedEvent]
        let matchedIndices: [Int]
        let chordId: String
        let difficulty: Difficulty
        let calibrationOffsetSec: Double
        let widenMs: Double
        let chroma: [Double]?
    }

    struct Output: Decodable {
        let results: [EventResult]
        let matchedIndices: [Int]
    }
}

// MARK: - greedyMatch

struct GreedyMatchFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: Output
    }

    struct Input: Decodable {
        let expectedEvents: [ExpectedEvent]
        let detectedOnsets: [OnsetEvent]
        let difficulty: Difficulty
        let calibrationOffsetSec: Double
        let widenMs: Double
    }

    struct Output: Decodable {
        let results: [EventResult]
    }
}

// MARK: - matchOnsetToExpected

struct MatchOnsetToExpectedFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: Output
    }

    struct Input: Decodable {
        let onsetTimestamp: Double
        let expectedEvents: [ExpectedEvent]
        let matchedIndices: [Int]
        let difficulty: Difficulty
        let calibrationOffsetSec: Double
        let widenMs: Double
    }

    struct Output: Decodable {
        let matchedEventIndex: Int?
    }
}

// MARK: - computeStats

struct ComputeStatsFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: AttemptStats
    }

    struct Input: Decodable {
        let results: [EventResult]
        let extraHits: Int
        let durationSeconds: Double
    }
}

// MARK: - exercise-utils

struct ExerciseUtilsFixture: Decodable {
    let seed: Int
    let beatToTimestamp: [BeatToTimestampCase]
    let generateExpectedTimestamps: [GenerateExpectedTimestampsCase]
    let getExerciseDuration: [ExerciseDurationCase]
    let getCountInDuration: [CountInDurationCase]
    let getLetterGrade: [LetterGradeCase]
    let beatDurationToVexDuration: [VexDurationCase]
    let frequencyToMidi: [FrequencyToMidiCase]
    let midiToNoteName: [MidiToNoteNameCase]
    let jsRound: [JsRoundCase]

    struct BeatToTimestampCase: Decodable {
        let name: String
        let input: BeatToTimestampInput
        let output: Double
    }

    struct BeatToTimestampInput: Decodable {
        let event: ExerciseEvent
        let bpm: Double
        let timeSignature: TimeSignature
        let loopIndex: Int
        let totalMeasures: Int
        let swing: Double
    }

    struct GenerateExpectedTimestampsCase: Decodable {
        let name: String
        let input: ExerciseDefinition
        let output: [ExpectedEvent]
    }

    struct ExerciseDurationCase: Decodable {
        let name: String
        let input: ExerciseDefinition
        let output: Double
    }

    struct CountInDurationCase: Decodable {
        let name: String
        let input: CountInDurationInput
        let output: Double
    }

    struct CountInDurationInput: Decodable {
        let bpm: Double
        let countInBeats: Double
    }

    struct LetterGradeCase: Decodable {
        let name: String
        let input: Double
        let output: String
    }

    struct VexDurationCase: Decodable {
        let name: String
        let input: Double
        let output: String
    }

    struct FrequencyToMidiCase: Decodable {
        let name: String
        let input: Double
        let output: Int
    }

    struct MidiToNoteNameCase: Decodable {
        let name: String
        let input: Int
        let output: String
    }

    struct JsRoundCase: Decodable {
        let input: Double
        let output: Double
    }
}

// MARK: - scoreToExerciseDefinition

struct ScoreToExerciseFixture: Decodable {
    let seed: Int
    let cases: [Case]

    struct Case: Decodable {
        let name: String
        let input: Input
        let output: ExerciseDefinition
        let expectedTimestamps: [ExpectedEvent]
    }

    struct Input: Decodable {
        let score: ScoreDocument
        let options: ScoreToExerciseOptions
    }
}

// MARK: - onset-config / mappings / category

struct OnsetConfigFixture: Decodable {
    let seed: Int
    let getInstrumentConfig: [ConfigCase]
    let instrumentNeedsPitchDetection: [PitchDetectionCase]
    let getInstrumentCategory: [CategoryCase]
    let getInstrumentLabel: [LabelCase]
    let getPlaySenseMapping: [MappingCase]

    struct ConfigCase: Decodable {
        let name: String
        let input: ConfigInput
        let output: OnsetConfig
    }

    struct ConfigInput: Decodable {
        let instrument: PlaySenseCore.Instrument
        let noisyRoom: Bool
        let speakerSafe: Bool
    }

    struct PitchDetectionCase: Decodable {
        let input: PlaySenseCore.Instrument
        let output: Bool
    }

    struct CategoryCase: Decodable {
        let input: PlaySenseCore.Instrument
        let output: InstrumentCategory
    }

    struct LabelCase: Decodable {
        let input: String
        let output: String
    }

    struct MappingCase: Decodable {
        let input: String
        let output: MappingJSON?
    }

    struct MappingJSON: Decodable {
        let instrument: String
        let piezoMap: [String: String]
        let useMic: Bool
    }
}
