import XCTest

@testable import LMMFeatures
@testable import LMMModels

/// Unit tests for the ``RichContentText`` TipTap-to-plaintext placeholder (Task B8 swaps it).
final class RichContentTextTests: XCTestCase {
    private func doc(_ json: String) -> JSONValue {
        (try? JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))) ?? .null
    }

    func testExtractsParagraphsInOrder() {
        let content = doc("""
        {
          "type": "doc",
          "content": [
            { "type": "paragraph", "content": [ { "type": "text", "text": "First line." } ] },
            { "type": "heading", "content": [ { "type": "text", "text": "A heading" } ] },
            { "type": "paragraph", "content": [
                { "type": "text", "text": "Bold" },
                { "type": "text", "text": " and plain." }
            ] }
          ]
        }
        """)
        XCTAssertEqual(RichContentText.paragraphs(from: content), [
            "First line.",
            "A heading",
            "Bold and plain."
        ])
    }

    func testEmptyParagraphsAreDropped() {
        let content = doc("""
        { "type": "doc", "content": [
          { "type": "paragraph" },
          { "type": "paragraph", "content": [ { "type": "text", "text": "Keep me." } ] }
        ] }
        """)
        XCTAssertEqual(RichContentText.paragraphs(from: content), ["Keep me."])
    }

    func testNilContentYieldsNoParagraphs() {
        XCTAssertTrue(RichContentText.paragraphs(from: nil).isEmpty)
    }
}
