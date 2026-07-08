import Foundation

/// Loads committed JSON fixtures from `Tests/TimeMapKitTests/Fixtures/`, mirroring
/// `LMMModelsTests/FixtureLoader` (each test target resolves its own fixtures directory via
/// `#filePath` so no SPM resource bundle is needed).
enum FixtureLoader {
    private static var fixturesDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures", isDirectory: true)
    }

    static func data(_ filename: String) throws -> Data {
        try Data(contentsOf: fixturesDirectory.appendingPathComponent(filename))
    }

    /// `TimeMapKit` has no date-decoding needs of its own (`ScoreSection.createdAt` is the
    /// only `Date` field, populated at the `LMMData` call site with `JSONDecoder.lmm`) — this
    /// tolerant PostgREST-timestamp decoder exists purely so this test target can decode the
    /// live-captured fixture without depending on `LMMModels` just for a date formatter.
    static let postgrestDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractional.date(from: string) { return date }
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let date = plain.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized ISO-8601 date: \(string)"
            )
        }
        return decoder
    }()
}
