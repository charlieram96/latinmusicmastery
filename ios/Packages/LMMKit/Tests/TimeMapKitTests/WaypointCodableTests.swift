import XCTest

@testable import TimeMapKit

/// Direct coverage for `Waypoint`'s custom `Codable` (task C12 review finding #1): `measureNumber`
/// and `beatInMeasure` mirror `time-map.ts`'s `number | null` (required-but-nullable), so a `nil`
/// value must round-trip to an explicit JSON `null`, not an omitted key — same nuance, and same
/// fix, as `Track.tuning`/`Track.channel` (see `ScoreModelTests/TrackCodableTests.swift`). Before
/// this fix, Swift's auto-synthesized `Codable` used `encodeIfPresent`, which silently dropped
/// the keys instead.
final class WaypointCodableTests: XCTestCase {
    private func encodeToDictionary(_ waypoint: Waypoint) throws -> [String: Any] {
        let data = try JSONEncoder().encode(waypoint)
        let object = try JSONSerialization.jsonObject(with: data)
        return try XCTUnwrap(object as? [String: Any])
    }

    func testNilMeasureAndBeatEncodeAsExplicitNull() throws {
        let waypoint = Waypoint(musicalPositionQN: 4, videoTimeSeconds: 2, measureNumber: nil, beatInMeasure: nil)
        let dict = try encodeToDictionary(waypoint)

        XCTAssertTrue(dict.keys.contains("measureNumber"), "expected the key to be present, not omitted")
        XCTAssertTrue(dict.keys.contains("beatInMeasure"), "expected the key to be present, not omitted")
        XCTAssertTrue(
            dict["measureNumber"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["measureNumber"]))"
        )
        XCTAssertTrue(
            dict["beatInMeasure"] is NSNull,
            "expected an explicit JSON null, got \(String(describing: dict["beatInMeasure"]))"
        )
    }

    func testNonNilMeasureAndBeatRoundTrip() throws {
        let waypoint = Waypoint(musicalPositionQN: 8, videoTimeSeconds: 4, measureNumber: 3, beatInMeasure: 2.5)
        let data = try JSONEncoder().encode(waypoint)
        let decoded = try JSONDecoder().decode(Waypoint.self, from: data)

        XCTAssertEqual(decoded, waypoint)
        XCTAssertEqual(decoded.measureNumber, 3)
        XCTAssertEqual(decoded.beatInMeasure, 2.5)
    }

    func testDecodingExplicitNullYieldsNilMeasureAndBeat() throws {
        let json = """
        {
          "musicalPositionQN": 0,
          "videoTimeSeconds": 0,
          "measureNumber": null,
          "beatInMeasure": null
        }
        """
        let waypoint = try JSONDecoder().decode(Waypoint.self, from: Data(json.utf8))

        XCTAssertNil(waypoint.measureNumber)
        XCTAssertNil(waypoint.beatInMeasure)
    }
}
