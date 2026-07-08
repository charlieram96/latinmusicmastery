import XCTest

@testable import ScoreModel

/// Case-for-case port of `lib/playsense-studio/__tests__/time-mapping.test.ts`.
/// Test names mirror the `it(...)` descriptions from that file.
final class ScoreTimeTests: XCTestCase {
    private func loadFixture(_ filename: String) throws -> ScoreDocument {
        try ScoreDocument.parse(FixtureLoader.data(filename))
    }

    // MARK: - time-mapping primitives

    func testMeasureLengthInQN() {
        XCTAssertEqual(ScoreTime.measureLengthInQN(TimeSignature(numerator: 4, denominator: 4)), 4)
        XCTAssertEqual(ScoreTime.measureLengthInQN(TimeSignature(numerator: 6, denominator: 8)), 3)
        XCTAssertEqual(ScoreTime.measureLengthInQN(TimeSignature(numerator: 3, denominator: 2)), 6)
    }

    func testBeatLengthInQN() {
        XCTAssertEqual(ScoreTime.beatLengthInQN(TimeSignature(numerator: 4, denominator: 4)), 1)
        XCTAssertEqual(ScoreTime.beatLengthInQN(TimeSignature(numerator: 6, denominator: 8)), 0.5)
        XCTAssertEqual(ScoreTime.beatLengthInQN(TimeSignature(numerator: 3, denominator: 2)), 2)
    }

    func testQnToMsAt120BPM() {
        XCTAssertEqual(ScoreTime.qnToMs(1, tempo: 120), 500)
        XCTAssertEqual(ScoreTime.qnToMs(4, tempo: 120), 2000)
    }

    func testQnToMsAt60BPM() {
        XCTAssertEqual(ScoreTime.qnToMs(1, tempo: 60), 1000)
    }

    // MARK: - measureBeatToMs (the M1 plan demo)

    func testMeasureBeatToMsBeat1Measure1Is0Ms() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.measureBeatToMs(track: track, score: score, measureNumber: 1, beatInMeasure: 1), 0)
    }

    func testMeasureBeatToMsBeat1Measure2Is2000Ms() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.measureBeatToMs(track: track, score: score, measureNumber: 2, beatInMeasure: 1), 2000)
    }

    /// The headline demo: "beat 4 of measure 2 at 120 BPM = 3500 ms" (one measure of 4
    /// quarters = 2000 ms; three more quarters into m2 = +1500 ms).
    func testMeasureBeatToMsBeat4Measure2Is3500Ms() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.measureBeatToMs(track: track, score: score, measureNumber: 2, beatInMeasure: 4), 3500)
    }

    func testMeasureBeatToMsReturnsNilForMissingMeasure() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertNil(ScoreTime.measureBeatToMs(track: track, score: score, measureNumber: 99, beatInMeasure: 1))
    }

    // MARK: - measureBeatToQN

    func testMeasureBeatToQNBeat1Measure1Is0QN() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.measureBeatToQN(track: track, score: score, measureNumber: 1, beatInMeasure: 1), 0)
    }

    func testMeasureBeatToQNBeat4Measure2Is7QN() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.measureBeatToQN(track: track, score: score, measureNumber: 2, beatInMeasure: 4), 7)
    }

    // MARK: - track durations

    func testGuitarLickFixtureIs8QN4000Ms() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.trackDurationQN(track: track, score: score), 8)
        XCTAssertEqual(ScoreTime.trackDurationMs(track: track, score: score), 4000)
    }

    /// 2 bars x 4 beats x 600 ms at 100 BPM.
    func testCongaTumbaoFixtureIs8QN4800Ms() throws {
        let score = try loadFixture("conga_tumbao_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.trackDurationQN(track: track, score: score), 8)
        XCTAssertEqual(ScoreTime.trackDurationMs(track: track, score: score), 4800)
    }

    func testSonMontunoFixtureTempoChangeAtBar3() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        // Bars 1-2 at 96 BPM: 8 QN x (60000/96) = 5000 ms
        // Bars 3-4 at 110 BPM: 8 QN x (60000/110) ~= 4363.636 ms
        // Total ~= 9363.636 ms
        XCTAssertEqual(ScoreTime.trackDurationQN(track: track, score: score), 16)
        XCTAssertEqual(ScoreTime.trackDurationMs(track: track, score: score), 9363.636, accuracy: 0.01)
    }

    // MARK: - qnToTrackMs with tempo changes

    func testSonMontunoQn0Is0Ms() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: 0), 0)
    }

    func testSonMontunoQn8StartOfBar3Is5000Ms() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: 8), 5000)
    }

    func testSonMontunoQn12StartOfBar4() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        let expected = 5000 + (4 * 60_000.0) / 110
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: 12), expected, accuracy: 1e-6)
    }

    func testSonMontunoQn16EndOfPieceMatchesTrackDurationMs() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        let total = ScoreTime.trackDurationMs(track: track, score: score)
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: 16), total, accuracy: 1e-6)
    }

    func testExtrapolatesPastTheEndAtTheFinalTempo() throws {
        let score = try loadFixture("son_montuno_fixture.json")
        let track = score.tracks[0]
        let total = ScoreTime.trackDurationMs(track: track, score: score)
        // 4 QN past end at 110 BPM = 4 x 60000/110 ~= 2181.818 ms
        let expected = total + (4 * 60_000.0) / 110
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: 20), expected, accuracy: 1e-6)
    }

    func testHandlesNegativeQnByExtrapolatingBeforeZeroAtInitialTempo() throws {
        let score = try loadFixture("guitar_lick_fixture.json")
        let track = score.tracks[0]
        // -1 QN at 120 BPM = -500 ms
        XCTAssertEqual(ScoreTime.qnToTrackMs(track: track, score: score, qn: -1), -500)
    }
}
