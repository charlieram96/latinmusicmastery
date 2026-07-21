import Foundation

/// Loads committed JSON fixtures from `Tests/PlaySenseCoreTests/Fixtures/`, mirroring the
/// other test targets' loaders (resolved via `#filePath`, no SPM resource bundle needed).
///
/// The golden fixtures were produced by EXECUTING the real `lib/play-sense` TypeScript
/// under Node (esbuild-bundled, logic untouched) — see `Fixtures/README.md` for the
/// generator location, seed, and regeneration instructions.
enum FixtureLoader {
    private static var testsDirectory: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    }

    static func data(_ filename: String) throws -> Data {
        try Data(contentsOf: testsDirectory.appendingPathComponent("Fixtures/\(filename)"))
    }

    static func decode<T: Decodable>(_ type: T.Type, from filename: String) throws -> T {
        try JSONDecoder().decode(T.self, from: data(filename))
    }

    /// Reads a fixture committed under the sibling `ScoreModelTests/Fixtures/` directory
    /// (the production score corpus + handwritten score fixtures live there; duplicating
    /// them here would just invite drift).
    static func scoreModelFixtureData(_ filename: String) throws -> Data {
        try Data(contentsOf: testsDirectory
            .deletingLastPathComponent()
            .appendingPathComponent("ScoreModelTests/Fixtures/\(filename)"))
    }
}
