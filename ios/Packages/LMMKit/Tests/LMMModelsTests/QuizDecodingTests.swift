import XCTest

@testable import LMMModels

/// Decoding tests for `quiz_questions` rows and the `QuizOptions` shape families
/// declared in `lib/quiz/grading.ts` (choices, pairs, blanks, items, parts+zones).
final class QuizDecodingTests: XCTestCase {
    func testQuizQuestionsDecodeFromSyntheticFixture() throws {
        let questions = try FixtureLoader.decode([QuizQuestion].self, from: "quiz_questions.synthetic.json")
        XCTAssertEqual(questions.count, 2)

        let multipleChoice = try XCTUnwrap(questions.first { $0.questionType == "multiple_choice" })
        XCTAssertEqual(multipleChoice.questionEs, "¿Qué papel juega el timbal en un conjunto de son?")
        XCTAssertNotNil(multipleChoice.createdAt)
        let choices = try XCTUnwrap(multipleChoice.options?.choices)
        XCTAssertEqual(choices.count, 2)
        let choicesEs = try XCTUnwrap(multipleChoice.optionsEs?.choices)
        XCTAssertEqual(choicesEs.count, 2)

        let matching = try XCTUnwrap(questions.first { $0.questionType == "matching_pairs" })
        XCTAssertNil(matching.createdAt)
        XCTAssertNil(matching.optionsEs)
        XCTAssertEqual(matching.options?.pairs?.count, 2)
    }

    func testQuizOptionsDecodesChoicesShape() throws {
        let options = try FixtureLoader.decode(QuizOptions.self, from: "quiz_options_choices.synthetic.json")
        let choices = try XCTUnwrap(options.choices)
        XCTAssertEqual(choices.count, 3)
        XCTAssertEqual(choices[0].id, "c1")
        XCTAssertEqual(choices[0].text, "Congas")
        XCTAssertEqual(choices[2].audioUrl, "https://audio.example.com/clip3.mp3")
        XCTAssertNil(options.pairs)
    }

    func testQuizOptionsDecodesPairsShape() throws {
        let options = try FixtureLoader.decode(QuizOptions.self, from: "quiz_options_pairs.synthetic.json")
        let pairs = try XCTUnwrap(options.pairs)
        XCTAssertEqual(pairs.count, 2)
        XCTAssertEqual(pairs[0].left, "Clave")
        XCTAssertEqual(pairs[0].right, "The rhythmic key pattern")
    }

    func testQuizOptionsDecodesBlanksShape() throws {
        let options = try FixtureLoader.decode(QuizOptions.self, from: "quiz_options_blanks.synthetic.json")
        let blanks = try XCTUnwrap(options.blanks)
        XCTAssertEqual(blanks.count, 2)
        XCTAssertEqual(blanks[0].id, "blank1")
        XCTAssertEqual(blanks[0].answer, "tumbao")
    }

    func testQuizOptionsDecodesItemsShape() throws {
        let options = try FixtureLoader.decode(QuizOptions.self, from: "quiz_options_items.synthetic.json")
        let items = try XCTUnwrap(options.items)
        XCTAssertEqual(items.count, 3)
        XCTAssertEqual(items[1].text, "Verse")
        XCTAssertEqual(items[1].correctPosition, 1)
    }

    func testQuizOptionsDecodesPartsAndZonesShape() throws {
        let options = try FixtureLoader.decode(QuizOptions.self, from: "quiz_options_parts_zones.synthetic.json")
        let parts = try XCTUnwrap(options.parts)
        let zones = try XCTUnwrap(options.zones)
        XCTAssertEqual(parts.count, 2)
        XCTAssertEqual(zones.count, 2)
        XCTAssertEqual(parts[0].correctZoneId, "z1")
        XCTAssertEqual(zones[0].width, 15)
        XCTAssertEqual(zones[1].label, "Shell")
    }
}
