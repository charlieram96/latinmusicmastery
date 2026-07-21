import Foundation
import LMMModels

/// Loads committed JSON fixtures from `Tests/LMMDataTests/Fixtures/`, mirroring
/// `LMMModelsTests/FixtureLoader` (each test target resolves its own fixtures directory via
/// `#filePath` so no SPM resource bundle is needed).
enum DataFixtureLoader {
    private static var fixturesDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures", isDirectory: true)
    }

    static func data(_ filename: String) throws -> Data {
        try Data(contentsOf: fixturesDirectory.appendingPathComponent(filename))
    }

    static func decode<T: Decodable>(
        _ type: T.Type,
        from filename: String,
        using decoder: JSONDecoder = .lmm
    ) throws -> T {
        try decoder.decode(T.self, from: try data(filename))
    }
}
