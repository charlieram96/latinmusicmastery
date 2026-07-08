import XCTest

@testable import LMMData

/// Unit tests for ``WebVTTParser`` — the ~80-line sidecar parser feeding the lesson player's
/// caption overlay. The real DB currently ships no VTT sidecars, so the fixture is synthetic but
/// matches `lib/subtitles/srt-to-vtt.ts` output shape (WEBVTT header, numeric cue ids, dot
/// millisecond separators, cue-setting suffixes).
final class WebVTTParserTests: XCTestCase {
    private func loadFixture() throws -> String {
        let data = try DataFixtureLoader.data("sample_subtitles.vtt")
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    func testParsesCuesTimingsAndMultilineText() throws {
        let cues = WebVTTParser.parse(try loadFixture())
        XCTAssertEqual(cues.count, 3)

        XCTAssertEqual(cues[0].start, 0, accuracy: 0.001)
        XCTAssertEqual(cues[0].end, 2.5, accuracy: 0.001)
        XCTAssertEqual(cues[0].text, "Welcome to the lesson.")

        // Multi-line cue text is preserved with the newline.
        XCTAssertEqual(cues[1].text, "Today we play the cáscara\non the timbal.")

        // HH:MM:SS timing + a cue-setting suffix after the end timestamp is ignored.
        XCTAssertEqual(cues[2].start, 65.25, accuracy: 0.001)
        XCTAssertEqual(cues[2].end, 68.0, accuracy: 0.001)
        XCTAssertEqual(cues[2].text, "Watch my right hand closely.")
    }

    func testSkipsNoteAndHeaderBlocks() throws {
        let cues = WebVTTParser.parse(try loadFixture())
        // The NOTE block between cues 2 and 3 must not become a cue.
        XCTAssertFalse(cues.contains { $0.text.contains("comment") })
    }

    func testActiveCueLookup() throws {
        let cues = WebVTTParser.parse(try loadFixture())
        XCTAssertEqual(WebVTTParser.activeCue(at: 1.0, in: cues), "Welcome to the lesson.")
        XCTAssertEqual(WebVTTParser.activeCue(at: 2.5, in: cues), "Today we play the cáscara\non the timbal.")
        // Gap between cue 2 (ends 6.0) and cue 3 (starts 65.25).
        XCTAssertNil(WebVTTParser.activeCue(at: 30.0, in: cues))
    }

    func testCommaMillisecondSeparatorIsAccepted() {
        // srt-to-vtt swaps commas for dots, but the parser tolerates a raw SRT cue defensively.
        let raw = "WEBVTT\n\n1\n00:00:01,000 --> 00:00:02,000\nComma timing.\n"
        let cues = WebVTTParser.parse(raw)
        XCTAssertEqual(cues.count, 1)
        XCTAssertEqual(cues[0].start, 1.0, accuracy: 0.001)
        XCTAssertEqual(cues[0].end, 2.0, accuracy: 0.001)
    }

    func testMalformedCueIsSkippedNotFatal() {
        let raw = """
        WEBVTT

        1
        this line is not a timing
        Orphan text.

        2
        00:00:03.000 --> 00:00:04.000
        Good cue.
        """
        let cues = WebVTTParser.parse(raw)
        // The malformed block is dropped; the valid cue after it still parses.
        XCTAssertEqual(cues.count, 1)
        XCTAssertEqual(cues[0].text, "Good cue.")
    }

    func testEmptyInputYieldsNoCues() {
        XCTAssertTrue(WebVTTParser.parse("").isEmpty)
        XCTAssertTrue(WebVTTParser.parse("WEBVTT\n").isEmpty)
    }
}
