import ScoreModel
import XCTest

@testable import TimeMapKit

/// Port of `buildTimeMap`'s synthesis branch (the map-less section fallback) plus the round-trip
/// invariant `toVideoTime(toMusicalPosition(t)) ≈ t` across the synthesized map's range.
final class SyntheticTimeMapTests: XCTestCase {
    /// 4 bars of 4/4 at 120 BPM — a whole note per bar → 16 QN, 8 s tempo-derived.
    private func score(tempo: Double = 120, bars: Int = 4) -> ScoreDocument {
        let bar = [MusicalEvent.note(Note(durationQN: 4, midi: 60))]
        let measures = (1...bars).map { Measure(number: $0, voices: [Voice(number: 1, events: bar)]) }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "G", tuning: nil,
            stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: measures
        )
        return ScoreDocument(
            title: "S", sourceFormat: .native, initialTempo: tempo,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0, tracks: [track]
        )
    }

    func testReturnsActiveMapVerbatimWhenPresent() throws {
        let active = try WaypointTimeMap(
            id: "real", method: .tap,
            waypoints: [
                Waypoint(musicalPositionQN: 0, videoTimeSeconds: 1),
                Waypoint(musicalPositionQN: 8, videoTimeSeconds: 5)
            ]
        )
        let resolved = SyntheticTimeMap.resolve(
            score: score(), trackIndex: 0, active: active, videoDurationSeconds: 100
        )
        XCTAssertEqual(resolved?.id, "real")
    }

    func testSynthesizesTempoBasedMapWhenNoVideoDuration() throws {
        let map = try XCTUnwrap(
            SyntheticTimeMap.resolve(score: score(), trackIndex: 0, active: nil, videoDurationSeconds: 0)
        )
        XCTAssertEqual(map.method, .tempo)
        XCTAssertEqual(map.videoStart, 0, accuracy: 1e-6)
        // 16 QN at 120 BPM = 8 s.
        XCTAssertEqual(map.videoEnd, 8, accuracy: 1e-6)
    }

    func testStretchesToLongerVideoDuration() throws {
        let map = try XCTUnwrap(
            SyntheticTimeMap.resolve(score: score(), trackIndex: 0, active: nil, videoDurationSeconds: 20)
        )
        XCTAssertEqual(map.videoEnd, 20, accuracy: 1e-6, "a longer video wins so notation isn't clamped short")
    }

    func testKeepsTempoDurationWhenVideoShorter() throws {
        let map = try XCTUnwrap(
            SyntheticTimeMap.resolve(score: score(), trackIndex: 0, active: nil, videoDurationSeconds: 3)
        )
        XCTAssertEqual(map.videoEnd, 8, accuracy: 1e-6)
    }

    func testNilForEmptyTrack() {
        let empty = ScoreDocument(
            title: "E", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4), initialKeyFifths: 0,
            tracks: [Track(
                index: 0, instrument: .guitar, displayName: "G", tuning: nil,
                stringMultiplicity: 0, channel: 0, defaultView: .staff, measures: []
            )]
        )
        XCTAssertNil(SyntheticTimeMap.resolve(score: empty, trackIndex: 0, active: nil, videoDurationSeconds: 10))
    }

    func testRoundTripVideoTimeMusicalPosition() throws {
        let map = try XCTUnwrap(
            SyntheticTimeMap.resolve(score: score(), trackIndex: 0, active: nil, videoDurationSeconds: 20)
        )
        for time in stride(from: 0.0, through: 20.0, by: 0.5) {
            let quarter = map.toMusicalPosition(time)
            let back = map.toVideoTime(quarter)
            XCTAssertEqual(back, time, accuracy: 1e-6, "round-trip drift at t=\(time)")
        }
    }
}
