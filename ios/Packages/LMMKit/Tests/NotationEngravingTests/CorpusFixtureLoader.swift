import Foundation

/// Loads the committed ScoreModel JSON fixtures — reused across targets by walking from this
/// file to the sibling `ScoreModelTests/Fixtures/` directory via `#filePath` (no SPM resource
/// bundle needed, same pattern as `ScoreModelTests/FixtureLoader`). This lets the C14 layout
/// tests run against the exact same real-corpus documents C12 validated.
enum CorpusFixtureLoader {
    private static var scoreModelFixturesDirectory: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()      // NotationEngravingTests/
            .deletingLastPathComponent()      // Tests/
            .appendingPathComponent("ScoreModelTests", isDirectory: true)
            .appendingPathComponent("Fixtures", isDirectory: true)
    }

    static func data(_ filename: String) throws -> Data {
        try Data(contentsOf: scoreModelFixturesDirectory.appendingPathComponent(filename))
    }
}
