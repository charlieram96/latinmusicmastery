import XCTest

@testable import LMMData
import LMMLocalization
@testable import LMMModels

/// `QuizGrader.correctAnswerLabel` coverage — split out of `QuizGraderTests` to stay under
/// SwiftLint's file/type length limits. Not in the TS test file (no dedicated `correctAnswerLabel`
/// suite exists on the web) — every case here is derived directly from reading
/// `lib/quiz/grading.ts`'s source.
final class QuizGraderCorrectAnswerLabelTests: XCTestCase {
    // MARK: - correctAnswerLabel
    // Not in the TS test file (no dedicated test suite for `correctAnswerLabel` on the web) —
    // every case below is derived directly from reading `lib/quiz/grading.ts`'s source.

    func testCorrectAnswerLabelMultipleChoiceReturnsMatchingChoiceText() {
        let question = makeQuestion(
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("a", "Alpha"), choice("b", "Beta")]),
            correctAnswer: "b"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "Beta")
    }

    /// Choice ids are stable across locales (only `text` is translated), so the *answer* is
    /// unaffected — but the results-screen *label* should still read in the active locale.
    func testCorrectAnswerLabelMultipleChoiceUsesLocaleResolvedText() {
        let question = makeQuestion(
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("a", "Alpha"), choice("b", "Beta")]),
            optionsEs: makeOptions(choices: [choice("a", "Alfa"), choice("b", "Beta en español")]),
            correctAnswer: "b"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "Beta")
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .es), "Beta en español")
        // And grading itself is unaffected either way, since it's keyed by the stable id.
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .choice("b")))
        XCTAssertTrue(QuizGrader.grade(question, locale: .es, answer: .choice("b")))
    }

    func testCorrectAnswerLabelMultipleChoiceFallsBackToRawIdWhenNoMatch() {
        let question = makeQuestion(
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("a", "Alpha")]),
            correctAnswer: "missing-id"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "missing-id")
    }

    func testCorrectAnswerLabelAudioChoiceUsesTextOrClipFallback() {
        let withText = makeQuestion(
            questionType: "audio_choice",
            options: makeOptions(choices: [choice("c1", "Clave"), choice("c2", "Conga")]),
            correctAnswer: "c2"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(withText, locale: .en), "Conga")

        let blankText = makeQuestion(
            questionType: "audio_choice",
            options: makeOptions(choices: [choice("c1", ""), choice("c2", "  ")]),
            correctAnswer: "c2"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(blankText, locale: .en), "Clip 2")

        let noMatch = makeQuestion(
            questionType: "audio_choice",
            options: makeOptions(choices: [choice("c1", "Clave")]),
            correctAnswer: "missing"
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(noMatch, locale: .en), "missing")
    }

    func testCorrectAnswerLabelInstrumentAssemblyJoinsPartToZoneLabels() {
        let question = makeQuestion(
            questionType: "instrument_assembly",
            options: makeOptions(
                parts: [assemblyPart("p1", "Head", "z1"), assemblyPart("p2", "Shell", "z2")],
                zones: [assemblyZone("z1", "Top"), assemblyZone("z2", "Bottom")]
            )
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "Head → Top, Shell → Bottom")
    }

    func testCorrectAnswerLabelInstrumentAssemblyUsesPlaceholderForMissingZone() {
        let question = makeQuestion(
            questionType: "instrument_assembly",
            options: makeOptions(parts: [assemblyPart("p1", "Head", "unknown-zone")], zones: [])
        )
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "Head → ?")
    }

    func testCorrectAnswerLabelDefaultReturnsRawCorrectAnswer() {
        let question = makeQuestion(questionType: "true_false", correctAnswer: "true")
        XCTAssertEqual(QuizGrader.correctAnswerLabel(question, locale: .en), "true")

        let noAnswer = makeQuestion(questionType: "text_answer", correctAnswer: nil)
        XCTAssertEqual(QuizGrader.correctAnswerLabel(noAnswer, locale: .en), "")
    }
}
