import Foundation
import LMMModels
import XCTest

@testable import ScoreModel

/// Production-corpus mandate (task C12): every real `score_documents.parsed_score` row
/// committed in `Fixtures/score_documents_corpus.json` — 14 rows fetched live from the
/// production Supabase project via the SUB test account, 2026-07 (see the task report for
/// full provenance) — must decode AND re-encode to a semantically-equal JSON payload. A
/// decode failure here is a model bug to fix, not a fixture to skip.
final class CorpusRoundTripTests: XCTestCase {
    func testEveryCorpusDocumentRoundTripsToSemanticallyEqualJSON() throws {
        let data = try FixtureLoader.data("score_documents_corpus.json")
        let rawRows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        let rows = try XCTUnwrap(rawRows, "expected the corpus fixture to be a JSON array of row objects")
        XCTAssertGreaterThanOrEqual(
            rows.count,
            10,
            "expected a real production corpus (~15 rows), not a token handful"
        )

        var failures: [String] = []

        for row in rows {
            let id = (row["id"] as? String) ?? "<unknown id>"
            let title = (row["title"] as? String) ?? "<unknown title>"
            guard let parsedScoreObject = row["parsed_score"] else {
                failures.append("\(id) (\(title)): row is missing parsed_score")
                continue
            }

            do {
                // Re-serialize just the `parsed_score` subtree, via Foundation's own JSON
                // machinery, into the bytes `ScoreDocument.parse` sees — as close to "real
                // corpus bytes" as a fixture-file round trip can get.
                let originalData = try JSONSerialization.data(withJSONObject: parsedScoreObject)
                let document = try ScoreDocument.parse(originalData)
                let roundTrippedData = try document.serialized()

                // Compare via `JSONValue` so key order and Int-vs-Double JSON-number
                // spelling never matter — only the actual JSON tree. Both sides go through
                // this same normalization, so an absent optional on one side and an absent
                // key on the other compare equal, per the round-trip mandate.
                let originalValue = try JSONDecoder().decode(JSONValue.self, from: originalData)
                let roundTrippedValue = try JSONDecoder().decode(JSONValue.self, from: roundTrippedData)

                if originalValue != roundTrippedValue {
                    failures.append("\(id) (\(title)): round-trip is not semantically equal to the original")
                }
            } catch {
                failures.append("\(id) (\(title)): failed to decode/round-trip — \(error)")
            }
        }

        XCTAssertTrue(failures.isEmpty, "Corpus round-trip failures:\n" + failures.joined(separator: "\n"))
    }
}
