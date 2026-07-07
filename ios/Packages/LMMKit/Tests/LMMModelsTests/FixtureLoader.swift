import Foundation

/// Loads committed JSON fixtures from `Tests/LMMModelsTests/Fixtures/` relative to this
/// source file. The iOS Simulator shares the host filesystem, so resolving fixtures via
/// `#filePath` avoids needing an SPM resource bundle for the test target.
enum FixtureLoader {
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
