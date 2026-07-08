import XCTest

@testable import TimeMapKit

/// Decoding test for ``ScoreSection`` against a live capture of `class_item_score_sections`
/// (fetched via the SUB test account, 2026-07 — RLS on that table is `USING (true)` with no
/// `TO authenticated` restriction, so every row is readable).
final class ScoreSectionDecodingTests: XCTestCase {
    func testDecodesLiveClassItemScoreSectionsFixture() throws {
        let sections = try FixtureLoader.postgrestDecoder.decode(
            [ScoreSection].self,
            from: FixtureLoader.data("class_item_score_sections.json")
        )
        XCTAssertEqual(sections.count, 5)

        let unpublished = try XCTUnwrap(sections.first { $0.activeTimeMapId == nil })
        XCTAssertNil(unpublished.videoStartSeconds)
        XCTAssertNil(unpublished.videoEndSeconds)
        XCTAssertNil(unpublished.label)
        XCTAssertNotNil(unpublished.createdAt)

        let published = try XCTUnwrap(sections.first { $0.activeTimeMapId != nil })
        XCTAssertNotNil(published.videoStartSeconds)
        XCTAssertNotNil(published.videoEndSeconds)
        XCTAssertNil(published.draftTimeMapId)

        let labeled = try XCTUnwrap(sections.first { $0.label != nil })
        XCTAssertEqual(labeled.label, "Conjunto Percusion 2-3-Charlie")
    }
}
