import Foundation
import XCTest

@testable import PlaySenseAudio
@testable import PlaySenseCore

// swiftlint:disable identifier_name large_tuple cyclomatic_complexity

/// DSP golden parity: the Swift `OnsetDetector` is fed the SAME deterministic 128-sample blocks the
/// real worklet was fed offline in Node, and its emitted messages must match the committed goldens
/// within the D21 tolerances (onset times ±1 hop, energy 1e-4 relative, pitch ±0.5 Hz, chroma 1e-4).
final class OnsetDetectorGoldenTests: XCTestCase {

    // MARK: Golden model

    private struct Golden: Decodable {
        let sampleRate: Double
        let blockSize: Int
        let fixtures: [Fixture]
    }
    private struct Fixture: Decodable {
        let name: String
        let configName: String
        let config: OnsetConfig
        let signal: OnsetDetectorSignal.SignalSpec
        let sampleRate: Double
        let blockSize: Int
        let paddedLength: Int
        let inputChecksum: Checksum
        let onsets: [Onset]
        let chords: [Chord]
        let levelStats: LevelStats
    }
    private struct Checksum: Decodable { let sum: Double; let absSum: Double; let length: Int }
    private struct Onset: Decodable {
        let timestamp: Double; let energy: Double; let fluxConfirmed: Bool; let frequency: Double?
    }
    private struct Chord: Decodable { let onsetTimestamp: Double; let chroma: [Double] }
    private struct LevelStats: Decodable { let count: Int; let max: Double; let last: Double }

    private static let golden: Golden = {
        // swiftlint:disable:next force_try
        try! OnsetFixtureLoader.decode(Golden.self, from: "onset_dsp.json")
    }()

    // MARK: Config-path parity (the Swift getInstrumentConfig must reproduce the worklet's config)

    func testConfigDerivationMatchesGolden() {
        for fixture in Self.golden.fixtures {
            let derived: OnsetConfig
            switch fixture.configName {
            case "default": derived = onsetConfigDefault
            case "conga": derived = getInstrumentConfig(.conga)
            case "guitar": derived = getInstrumentConfig(.guitar)
            case "noisyRoom": derived = getInstrumentConfig(.conga, noisyRoom: true)
            case "speakerSafe": derived = getInstrumentConfig(.conga, speakerSafe: true)
            default: XCTFail("unknown config \(fixture.configName)"); continue
            }
            XCTAssertEqual(derived, fixture.config, "config path for \(fixture.name)")
        }
    }

    // MARK: Input parity (the Swift signal generator must reproduce the worklet's Float32 input)

    func testInputChecksumParity() {
        for fixture in Self.golden.fixtures {
            let padded = OnsetDetectorSignal.buildPadded(
                sr: fixture.sampleRate, spec: fixture.signal, block: fixture.blockSize)
            XCTAssertEqual(padded.count, fixture.paddedLength, "\(fixture.name) padded length")
            let (sum, absSum) = OnsetDetectorSignal.checksum(padded)
            XCTAssertEqual(sum, fixture.inputChecksum.sum, accuracy: 1e-6, "\(fixture.name) input sum")
            XCTAssertEqual(absSum, fixture.inputChecksum.absSum, accuracy: 1e-6, "\(fixture.name) input |sum|")
        }
    }

    // MARK: DSP output parity

    func testOnsetDetectorGoldenParity() {
        var failures: [String] = []
        for fixture in Self.golden.fixtures {
            let (onsets, chords, levels) = run(fixture)
            compare(fixture, onsets: onsets, chords: chords, levels: levels, into: &failures)
        }
        if !failures.isEmpty {
            XCTFail("OnsetDetector golden parity failures (\(failures.count)):\n" + failures.joined(separator: "\n"))
        }
    }

    // MARK: Harness

    private func run(_ fixture: Fixture) -> (onsets: [Onset], chords: [Chord], levels: LevelStats) {
        let detector = OnsetDetector()
        detector.configure(config: fixture.config, sampleRate: fixture.sampleRate)

        let padded = OnsetDetectorSignal.buildPadded(
            sr: fixture.sampleRate, spec: fixture.signal, block: fixture.blockSize)
        let block = fixture.blockSize
        let nBlocks = padded.count / block

        var onsets: [Onset] = []
        var chords: [Chord] = []
        var levelCount = 0
        var levelMax = 0.0
        var levelLast = 0.0

        padded.withUnsafeBufferPointer { buf in
            for b in 0..<nBlocks {
                let blockTime = Double(b * block) / fixture.sampleRate
                let slice = UnsafeBufferPointer(rebasing: buf[(b * block)..<(b * block + block)])
                detector.process(slice, blockTime: blockTime) { message in
                    switch message {
                    case let .onset(timestamp, energy, fluxConfirmed, frequency):
                        onsets.append(Onset(timestamp: timestamp, energy: energy,
                                            fluxConfirmed: fluxConfirmed, frequency: frequency))
                    case let .chord(onsetTimestamp, chroma):
                        chords.append(Chord(onsetTimestamp: onsetTimestamp, chroma: chroma))
                    case let .level(level):
                        levelCount += 1
                        levelMax = Swift.max(levelMax, level)
                        levelLast = level
                    }
                }
            }
        }
        return (onsets, chords, LevelStats(count: levelCount, max: levelMax, last: levelLast))
    }

    private func compare(_ fixture: Fixture, onsets: [Onset], chords: [Chord],
                         levels: LevelStats, into failures: inout [String]) {
        let name = fixture.name
        let hopSeconds = Double(fixture.config.hopSize) / fixture.sampleRate

        guard onsets.count == fixture.onsets.count else {
            failures.append("\(name): onset count got \(onsets.count) want \(fixture.onsets.count)")
            return
        }
        for (i, (got, want)) in zip(onsets, fixture.onsets).enumerated() {
            if abs(got.timestamp - want.timestamp) > hopSeconds + 1e-9 {
                failures.append("\(name)[\(i)]: onset t got \(got.timestamp) want \(want.timestamp) (>\(hopSeconds)s)")
            }
            if relError(got.energy, want.energy) > 1e-4 {
                failures.append("\(name)[\(i)]: energy got \(got.energy) want \(want.energy)")
            }
            if got.fluxConfirmed != want.fluxConfirmed {
                failures.append("\(name)[\(i)]: fluxConfirmed got \(got.fluxConfirmed) want \(want.fluxConfirmed)")
            }
            switch (got.frequency, want.frequency) {
            case let (g?, w?):
                if abs(g - w) > 0.5 { failures.append("\(name)[\(i)]: freq got \(g) want \(w)") }
            case (nil, nil): break
            default:
                failures.append("\(name)[\(i)]: freq got \(String(describing: got.frequency)) " +
                                "want \(String(describing: want.frequency))")
            }
        }

        guard chords.count == fixture.chords.count else {
            failures.append("\(name): chord count got \(chords.count) want \(fixture.chords.count)")
            return
        }
        for (i, (got, want)) in zip(chords, fixture.chords).enumerated() {
            if abs(got.onsetTimestamp - want.onsetTimestamp) > hopSeconds + 1e-9 {
                failures.append("\(name) chord[\(i)]: onsetTs got \(got.onsetTimestamp) want \(want.onsetTimestamp)")
            }
            for k in 0..<12 where abs(got.chroma[k] - want.chroma[k]) > 1e-4 {
                failures.append("\(name) chord[\(i)][\(k)]: chroma got \(got.chroma[k]) want \(want.chroma[k])")
            }
        }

        if levels.count != fixture.levelStats.count {
            failures.append("\(name): level count got \(levels.count) want \(fixture.levelStats.count)")
        }
        if relError(levels.max, fixture.levelStats.max) > 1e-3 {
            failures.append("\(name): level max got \(levels.max) want \(fixture.levelStats.max)")
        }
        if relError(levels.last, fixture.levelStats.last) > 1e-3 {
            failures.append("\(name): level last got \(levels.last) want \(fixture.levelStats.last)")
        }
    }

    private func relError(_ a: Double, _ b: Double) -> Double {
        let denom = Swift.max(abs(a), abs(b), 1e-12)
        return abs(a - b) / denom
    }
}

// swiftlint:enable identifier_name large_tuple cyclomatic_complexity
