import XCTest

@testable import LMMModels

/// Parser for the `class_items.subtitles` jsonb column (web parity:
/// `lib/subtitles/tracks.ts` `parseSubtitles`).
final class ClassItemSubtitleTests: XCTestCase {
    private func entry(_ lang: String, _ src: String = "https://cdn.example.com/x.vtt") -> JSONValue {
        .object(["lang": .string(lang), "src": .string(src)])
    }

    func testNilAndNonArrayValuesParseToEmpty() {
        XCTAssertEqual(ClassItemSubtitle.parse(nil), [])
        XCTAssertEqual(ClassItemSubtitle.parse(.null), [])
        XCTAssertEqual(ClassItemSubtitle.parse(.string("[]")), [])
        XCTAssertEqual(ClassItemSubtitle.parse(entry("en")), [])
    }

    func testParsesWellFormedEntriesInOrder() {
        let parsed = ClassItemSubtitle.parse(.array([entry("en", "https://a/en.vtt"), entry("pt", "https://a/pt.vtt")]))
        XCTAssertEqual(parsed, [
            ClassItemSubtitle(lang: "en", src: "https://a/en.vtt"),
            ClassItemSubtitle(lang: "pt", src: "https://a/pt.vtt"),
        ])
    }

    func testSkipsMalformedElements() {
        let parsed = ClassItemSubtitle.parse(.array([
            .null,
            .string("en"),
            .object(["lang": .string("en")]),
            .object(["src": .string("https://a/fr.vtt")]),
            .object(["lang": .number(42), "src": .string("https://a/de.vtt")]),
            entry("it", "https://a/it.vtt"),
        ]))
        XCTAssertEqual(parsed, [ClassItemSubtitle(lang: "it", src: "https://a/it.vtt")])
    }

    func testNormalizesCodesAndDedupesFirstWins() {
        let parsed = ClassItemSubtitle.parse(.array([entry(" EN ", "https://a/1.vtt"), entry("en", "https://a/2.vtt")]))
        XCTAssertEqual(parsed, [ClassItemSubtitle(lang: "en", src: "https://a/1.vtt")])
    }

    func testCapsAtNineTracks() {
        let ten = SubtitleLanguages.all.map { entry($0.code) } + [entry("xx")]
        XCTAssertEqual(ten.count, ClassItemSubtitle.maxTracks + 1)
        XCTAssertEqual(ClassItemSubtitle.parse(.array(ten)).count, ClassItemSubtitle.maxTracks)
        XCTAssertEqual(ClassItemSubtitle.maxTracks, 9)
    }

    func testLabelsMirrorTheWebTable() {
        XCTAssertEqual(SubtitleLanguages.all.map(\.code), ["en", "es", "pt", "fr", "it", "de", "nl", "ja", "zh"])
        XCTAssertEqual(SubtitleLanguages.label(for: "es"), "Español")
        XCTAssertEqual(SubtitleLanguages.label(for: "ja"), "日本語")
        XCTAssertEqual(SubtitleLanguages.label(for: "xx"), "xx")
    }

    func testClassItemRowDecodesSubtitlesColumn() throws {
        let json = """
        {"id":"11111111-1111-1111-1111-111111111111","class_id":"22222222-2222-2222-2222-222222222222",
         "item_type":"VIDEO","title":"T","order_index":0,"exercise_video_start_seconds":0,
         "subtitles":[{"lang":"en","src":"https://a/en.vtt"},{"lang":"nl","src":"https://a/nl.vtt"}]}
        """
        let item = try JSONDecoder().decode(ClassItem.self, from: Data(json.utf8))
        XCTAssertEqual(ClassItemSubtitle.parse(item.subtitles), [
            ClassItemSubtitle(lang: "en", src: "https://a/en.vtt"),
            ClassItemSubtitle(lang: "nl", src: "https://a/nl.vtt"),
        ])
    }

    func testClassItemRowWithoutSubtitlesKeyStillDecodes() throws {
        let json = """
        {"id":"11111111-1111-1111-1111-111111111111","class_id":"22222222-2222-2222-2222-222222222222",
         "item_type":"VIDEO","title":"T","order_index":0,"exercise_video_start_seconds":0}
        """
        let item = try JSONDecoder().decode(ClassItem.self, from: Data(json.utf8))
        XCTAssertNil(item.subtitles)
        XCTAssertEqual(ClassItemSubtitle.parse(item.subtitles), [])
    }
}
