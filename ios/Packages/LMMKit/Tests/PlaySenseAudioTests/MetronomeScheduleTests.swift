import XCTest

@testable import PlaySenseAudio

/// Pure metronome schedule math: beat counts, offsets, downbeat placement, and the clock-derived UI
/// beat readout.
final class MetronomeScheduleTests: XCTestCase {

    func testClickCountAndOffsets() {
        // 120 BPM → 0.5 s/beat, 4/4, 4-beat count-in, 8 exercise beats.
        let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 8)
        XCTAssertEqual(clicks.count, 12)

        // Count-in offsets are negative and end just before t0.
        XCTAssertEqual(clicks[0].offsetSeconds, -2.0, accuracy: 1e-12) // (0-4)*0.5
        XCTAssertEqual(clicks[1].offsetSeconds, -1.5, accuracy: 1e-12)
        XCTAssertEqual(clicks[3].offsetSeconds, -0.5, accuracy: 1e-12)
        // First exercise click lands exactly at t0.
        XCTAssertEqual(clicks[4].offsetSeconds, 0.0, accuracy: 1e-12)
        XCTAssertEqual(clicks[5].offsetSeconds, 0.5, accuracy: 1e-12)
        XCTAssertEqual(clicks[11].offsetSeconds, 3.5, accuracy: 1e-12) // beat 7 * 0.5
    }

    func testDownbeatPlacement() {
        let clicks = MetronomeSchedule.clicks(bpm: 100, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 8)
        // Count-in: i % 4 == 0 → index 0 is a downbeat, 1..3 are not.
        XCTAssertTrue(clicks[0].isDownbeat)
        XCTAssertFalse(clicks[1].isDownbeat)
        // Exercise: j % 4 == 0 → beats 0 and 4 downbeats.
        XCTAssertTrue(clicks[4].isDownbeat)  // exercise beat 0
        XCTAssertFalse(clicks[5].isDownbeat)
        XCTAssertTrue(clicks[8].isDownbeat)  // exercise beat 4
    }

    func testThreeFourMeter() {
        let clicks = MetronomeSchedule.clicks(bpm: 90, beatsPerMeasure: 3, countInBeats: 3, exerciseBeats: 6)
        XCTAssertEqual(clicks.count, 9)
        XCTAssertTrue(clicks[3].isDownbeat)  // first exercise beat
        XCTAssertTrue(clicks[6].isDownbeat)  // exercise beat 3
        XCTAssertFalse(clicks[4].isDownbeat)
    }

    func testCountInDuration() {
        XCTAssertEqual(MetronomeSchedule.countInDuration(bpm: 120, countInBeats: 4), 2.0, accuracy: 1e-12)
        XCTAssertEqual(MetronomeSchedule.countInDuration(bpm: 60, countInBeats: 4), 4.0, accuracy: 1e-12)
    }

    func testBeatReadoutMatchesWebVisualTracking() {
        // 120 BPM, 4/4: elapsed measured from count-in start.
        XCTAssertEqual(MetronomeSchedule.beatReadout(elapsedSeconds: -0.1, bpm: 120, beatsPerMeasure: 4),
                       BeatReadout(beatInMeasure: 0, isDownbeat: false))
        XCTAssertEqual(MetronomeSchedule.beatReadout(elapsedSeconds: 0.0, bpm: 120, beatsPerMeasure: 4),
                       BeatReadout(beatInMeasure: 1, isDownbeat: true))
        XCTAssertEqual(MetronomeSchedule.beatReadout(elapsedSeconds: 0.6, bpm: 120, beatsPerMeasure: 4),
                       BeatReadout(beatInMeasure: 2, isDownbeat: false)) // floor(0.6/0.5)=1 → beat 2
        XCTAssertEqual(MetronomeSchedule.beatReadout(elapsedSeconds: 2.0, bpm: 120, beatsPerMeasure: 4),
                       BeatReadout(beatInMeasure: 1, isDownbeat: true))  // floor(2.0/0.5)=4 → 4%4+1=1
    }

    /// Converting the schedule to sample offsets (as the scheduler does) yields sample-exact positions.
    func testScheduleSampleOffsets() {
        let sampleRate = 48_000.0
        let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 4)
        let frames = clicks.map { Int(($0.offsetSeconds * sampleRate).rounded()) }
        // 0.5 s/beat × 48 kHz = 24_000 frames/beat.
        XCTAssertEqual(frames, [-96_000, -72_000, -48_000, -24_000, 0, 24_000, 48_000, 72_000])
    }
}
