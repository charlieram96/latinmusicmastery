import Foundation
import XCTest

@testable import LMMDesignSystem
@testable import LMMModels

/// Pure, SwiftUI-free unit tests for the TipTap/ProseMirror JSON → ``TipTapBlock`` parser
/// (Task B8). Covers exactly the fixture shapes the brief calls out: nested lists, mark
/// combinations, an unknown node, and a link — plus the image/youtube node attrs and the
/// heading-level clamp.
final class TipTapParsingTests: XCTestCase {
    // MARK: Nested lists

    func testNestedListsParseRecursively() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.nestedLists)

        XCTAssertEqual(blocks, [
            .bulletList([
                [
                    .paragraph(AttributedString("Top")),
                    .orderedList(start: 2, items: [
                        [.paragraph(AttributedString("Nested A"))],
                        [.paragraph(AttributedString("Nested B"))]
                    ])
                ]
            ])
        ])
    }

    // MARK: Marks

    func testMarksCombosApplyPerRun() throws {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.marksCombos)
        guard case .paragraph(let text)? = blocks.first else {
            return XCTFail("Expected a single paragraph block")
        }

        let runs = Array(text.runs)
        XCTAssertEqual(runs.count, 3, "Bold / plain / italic+strike should each be their own run")

        let bold = runs[0]
        XCTAssertEqual(String(text[bold.range].characters), "Bold")
        XCTAssertEqual(bold.inlinePresentationIntent, .stronglyEmphasized)

        let plain = runs[1]
        XCTAssertEqual(String(text[plain.range].characters), " and ")
        XCTAssertNil(plain.inlinePresentationIntent)
        XCTAssertNil(plain.strikethroughStyle)

        let comboRun = runs[2]
        XCTAssertEqual(String(text[comboRun.range].characters), "italic-strike")
        XCTAssertEqual(comboRun.inlinePresentationIntent, .emphasized)
        XCTAssertEqual(comboRun.strikethroughStyle, .single)
    }

    func testHardBreakBecomesNewlineWithinAParagraph() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.hardBreak)
        guard case .paragraph(let text)? = blocks.first else {
            return XCTFail("Expected a single paragraph block")
        }
        XCTAssertEqual(String(text.characters), "Line one\nLine two")
    }

    // MARK: Link

    func testLinkMarkProducesATappableLinkAttribute() throws {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.link)
        guard case .paragraph(let text)? = blocks.first else {
            return XCTFail("Expected a single paragraph block")
        }
        let run = try XCTUnwrap(text.runs.first)
        XCTAssertEqual(String(text[run.range].characters), "Visit our site")
        XCTAssertEqual(run.link, URL(string: "https://latinmusicmastery.com"))
    }

    // MARK: Unknown node

    func testUnknownNodeDegradesToItsTextChildren() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.unknownNode)
        XCTAssertEqual(blocks, [.unknown(text: AttributedString("let x = 1"))])
    }

    // MARK: Heading

    func testHeadingLevelIsClampedToTheSupportedRange() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.outOfRangeHeadingLevel)
        XCTAssertEqual(blocks, [.heading(level: 3, text: AttributedString("Whoa"))])
    }

    // MARK: Image / YouTube

    func testImageNodeParsesSrcAndAlt() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.image)
        XCTAssertEqual(blocks, [.image(src: "https://cdn.example.com/pic.jpg", alt: "A photo")])
    }

    func testYoutubeNodeParsesSrc() {
        let blocks = TipTapBlockParser.blocks(from: TipTapFixtures.youtube)
        XCTAssertEqual(blocks, [.youtube(src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ")])
    }

    func testYoutubeVideoIDExtractionAcrossURLShapes() {
        XCTAssertEqual(
            YoutubeVideoID.extract(from: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            "dQw4w9WgXcQ"
        )
        XCTAssertEqual(YoutubeVideoID.extract(from: "https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
        XCTAssertEqual(
            YoutubeVideoID.extract(from: "https://www.youtube.com/embed/dQw4w9WgXcQ"),
            "dQw4w9WgXcQ"
        )
        XCTAssertNil(YoutubeVideoID.extract(from: "not a url"))
    }

    // MARK: Nil / empty

    func testNilContentYieldsNoBlocks() {
        XCTAssertTrue(TipTapBlockParser.blocks(from: nil).isEmpty)
    }
}
