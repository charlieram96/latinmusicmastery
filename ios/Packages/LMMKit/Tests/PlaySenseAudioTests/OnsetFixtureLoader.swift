import Foundation

/// Loads committed JSON goldens from `Tests/PlaySenseAudioTests/Fixtures/` (resolved via `#filePath`,
/// no SPM resource bundle) — same pattern as the other test targets' loaders. The `onset_dsp.json`
/// golden was produced by EXECUTING the real worklet offline in Node; see
/// `scratchpad/d21-gen/run.mjs` and the D21 report for the generator.
enum OnsetFixtureLoader {
    private static var fixturesDirectory: URL {
        URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Fixtures")
    }

    static func decode<T: Decodable>(_ type: T.Type, from filename: String) throws -> T {
        let data = try Data(contentsOf: fixturesDirectory.appendingPathComponent(filename))
        return try JSONDecoder().decode(T.self, from: data)
    }
}
