import XCTest

@testable import ScoreModel

/// Direct coverage for `Track`'s custom `Codable` (task C12 review findings #2/#3) — until now
/// the `tuning`/`channel` null-vs-absent fix and the `stringMultiplicity` decode leniency were
/// only incidentally exercised by whatever shapes happened to appear in the production corpus
/// (`CorpusRoundTripTests`) and the hand-written fixtures (`SerializationTests`). These tests
/// pin both behaviors directly, plus the contrasting case of a genuinely optional/absent field.
final class TrackCodableTests: XCTestCase {
    private func loadTrack(_ filename: String) throws -> Track {
        try JSONDecoder().decode(Track.self, from: FixtureLoader.data(filename))
    }

    private func encodeToDictionary(_ value: some Encodable) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        return try XCTUnwrap(object as? [String: Any])
    }

    private func makeTrack(tuning: [String]?, channel: Int?) -> Track {
        Track(
            index: 0,
            instrument: .guitar,
            displayName: "Guitar",
            tuning: tuning,
            stringMultiplicity: 1,
            channel: channel,
            defaultView: .tab,
            measures: []
        )
    }

    // MARK: - explicit-null tuning/channel in -> explicit null out

    func testNilTuningAndChannelEncodeAsExplicitNull() throws {
        let dict = try encodeToDictionary(makeTrack(tuning: nil, channel: nil))

        XCTAssertTrue(dict.keys.contains("tuning"), "expected the key to be present, not omitted")
        XCTAssertTrue(dict.keys.contains("channel"), "expected the key to be present, not omitted")
        XCTAssertTrue(
            dict["tuning"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["tuning"]))"
        )
        XCTAssertTrue(
            dict["channel"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["channel"]))"
        )
    }

    func testExplicitNullTuningAndChannelRoundTripAsExplicitNull() throws {
        // Hand-written fixture with explicit JSON `null` for both fields, matching what
        // production `parsed_score` rows look like for unfretted (percussion) tracks.
        let track = try loadTrack("track_perc_string_multiplicity_zero.json")
        XCTAssertNil(track.tuning)
        XCTAssertNil(track.channel)

        let dict = try encodeToDictionary(track)
        XCTAssertTrue(
            dict["tuning"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["tuning"]))"
        )
        XCTAssertTrue(
            dict["channel"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["channel"]))"
        )
    }

    func testNonNilTuningAndChannelRoundTrip() throws {
        let track = makeTrack(tuning: ["E2", "A2", "D3", "G3", "B3", "E4"], channel: 9)
        let data = try JSONEncoder().encode(track)
        let decoded = try JSONDecoder().decode(Track.self, from: data)
        XCTAssertEqual(decoded, track)
    }

    // MARK: - contrast case: a genuinely optional/absent field stays absent

    func testAbsentComposerFieldStaysAbsentAfterReencode() throws {
        // `ScoreDocument.composer` is the true optional/absent-capable field `Track`'s doc
        // comment contrasts `tuning`/`channel` against — unlike those two, an absent
        // `composer` key must stay absent through a decode/re-encode round trip rather than
        // becoming an explicit `null`.
        let document = ScoreDocument(
            title: "Test Document",
            composer: nil,
            sourceFormat: .native,
            initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0,
            tracks: [makeTrack(tuning: nil, channel: nil)]
        )

        let dict = try encodeToDictionary(document)
        XCTAssertFalse(dict.keys.contains("composer"), "expected the key to be absent, not an explicit null")
    }

    // MARK: - stringMultiplicity 0 decode leniency

    func testTrackWithStringMultiplicityZeroDecodesSuccessfully() throws {
        let track = try loadTrack("track_perc_string_multiplicity_zero.json")
        XCTAssertEqual(track.stringMultiplicity, 0)
        XCTAssertEqual(track.instrument, .percConga)
        XCTAssertEqual(track.defaultView, .rhythmGrid)
    }
}
