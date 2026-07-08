import Foundation

/// Loads committed JSON fixtures from `Tests/ScoreModelTests/Fixtures/`, mirroring
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
}
