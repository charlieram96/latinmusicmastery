import XCTest

@testable import LMMData
import LMMLocalization
@testable import LMMModels

/// Port of `lib/quiz/__tests__/grading.test.ts`, case-for-case, plus edge cases called out in the
/// B7 brief (`norm`, `shuffleStable`, `grade`, `hasAnswer`). `correctAnswerLabel` coverage lives in
/// `QuizGraderCorrectAnswerLabelTests` (kept separate to stay under SwiftLint's file/type length).
///
/// Every `shuffleStable` golden vector below was produced by running the *actual*
/// `lib/quiz/grading.ts` algorithm (TS types stripped, logic untouched) under Node — not derived by
/// hand — so the LCG's floating-point-precision quirks (the seed-hash loop stays inside the
/// 32-bit-safe range so it's exact integer arithmetic, but the per-swap
/// `h * 1103515245 + 12345` step regularly exceeds `Number.MAX_SAFE_INTEGER` and is rounded by the
/// JS double) are captured byte-for-byte rather than reasoned about. See the B7 report for the raw
/// Node run that produced them.
final class QuizGraderTests: XCTestCase {
    // MARK: - norm

    func testNormLowercasesAndTrims() {
        XCTAssertEqual(QuizGrader.norm("  HeLLo "), "hello")
    }

    // MARK: - shuffleStable

    func testShuffleStableIsDeterministicForAGivenSeed() {
        let first = QuizGrader.shuffleStable([1, 2, 3, 4, 5], seed: "seed")
        let second = QuizGrader.shuffleStable([1, 2, 3, 4, 5], seed: "seed")
        XCTAssertEqual(first, second)
    }

    func testShuffleStablePreservesAllElements() {
        XCTAssertEqual(QuizGrader.shuffleStable([1, 2, 3], seed: "x").sorted(), [1, 2, 3])
    }

    /// Golden vectors captured from the live TS `shuffleStable`, not hand-derived — see the file
    /// header. Any drift in the LCG constants or the >>> 0 / & 0x7fffffff masking would fail these.
    func testShuffleStableMatchesGoldenVectorsFromTheTypeScriptImplementation() {
        XCTAssertEqual(QuizGrader.shuffleStable([1, 2, 3, 4, 5], seed: "seed"), [3, 4, 2, 1, 5])
        XCTAssertEqual(QuizGrader.shuffleStable([1, 2, 3], seed: "x"), [3, 1, 2])
        XCTAssertEqual(QuizGrader.shuffleStable(["a", "b", "c", "d"], seed: "q1"), ["c", "a", "d", "b"])
        // Same seed twice -> identical (determinism, golden-vector form of the test above).
        XCTAssertEqual(QuizGrader.shuffleStable(["a", "b", "c", "d"], seed: "q1"), ["c", "a", "d", "b"])
        // Different seed -> different output.
        XCTAssertEqual(QuizGrader.shuffleStable(["a", "b", "c", "d"], seed: "q2"), ["d", "a", "b", "c"])
        // Single element: loop body never runs.
        XCTAssertEqual(QuizGrader.shuffleStable(["a"], seed: "single"), ["a"])
        // Empty input.
        XCTAssertEqual(QuizGrader.shuffleStable([Int](), seed: "empty-items"), [])
        // Empty seed string (h stays 0 through the seed loop).
        XCTAssertEqual(QuizGrader.shuffleStable(["a", "b"], seed: ""), ["a", "b"])
        // A real (lowercase) UUID-shaped seed, and an 8-element input exercising several swaps
        // where the LCG multiply overflows Number.MAX_SAFE_INTEGER on nearly every iteration.
        XCTAssertEqual(
            QuizGrader.shuffleStable(
                ["a", "b", "c", "d", "e", "f", "g", "h"],
                seed: "11111111-2222-4333-8444-555555555555"
            ),
            ["e", "g", "c", "f", "b", "h", "d", "a"]
        )
        XCTAssertEqual(
            QuizGrader.shuffleStable(Array(0...9), seed: "ordering-question-id-42"),
            [9, 3, 4, 6, 1, 7, 5, 0, 2, 8]
        )
    }

    /// Question ids are Postgres `uuid` columns, which the DB/JSON API always renders lowercase.
    /// `QuizGrader.shuffleSeed(for:)` must use that lowercase form — `UUID.uuidString` is
    /// uppercase by default — or the initial ordering-question shuffle would render in a
    /// different order on iOS than on the web for the exact same question id.
    func testShuffleSeedUsesLowercaseUUIDStringMatchingPostgresJSONRendering() {
        // Chosen with hex letters (a-f) so upper vs. lower case actually differ.
        let id = UUID(uuidString: "aabbccdd-eeff-4001-8ab2-abcdefabcdef")!
        let question = makeQuestion(id: id, questionType: "ordering_sequence")
        XCTAssertEqual(QuizGrader.shuffleSeed(for: question), "aabbccdd-eeff-4001-8ab2-abcdefabcdef")
        XCTAssertNotEqual(QuizGrader.shuffleSeed(for: question), id.uuidString) // uuidString is uppercase
    }

    // MARK: - grade: multiple_choice

    func testGradeMultipleChoiceCorrectWhenAnswerIdMatchesCorrectAnswer() {
        let question = makeQuestion(
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("a", "A"), choice("b", "B")]),
            correctAnswer: "b"
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .choice("b")))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .choice("a")))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .none))
    }

    // MARK: - grade: true_false

    func testGradeTrueFalseCaseInsensitiveMatchToCorrectAnswer() {
        let question = makeQuestion(questionType: "true_false", correctAnswer: "true")
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .bool(true)))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .bool(false)))

        // norm() applies to correct_answer too: mixed-case storage still matches.
        let mixedCase = makeQuestion(questionType: "true_false", correctAnswer: "TRUE")
        XCTAssertTrue(QuizGrader.grade(mixedCase, locale: .en, answer: .bool(true)))
    }

    // MARK: - grade: text_answer / audio

    func testGradeTextAnswerAndAudioNormalizedStringMatch() {
        let textAnswer = makeQuestion(questionType: "text_answer", correctAnswer: "Dorian")
        XCTAssertTrue(QuizGrader.grade(textAnswer, locale: .en, answer: .text(" dorian ")))
        XCTAssertFalse(QuizGrader.grade(textAnswer, locale: .en, answer: .text("phrygian")))

        let audio = makeQuestion(questionType: "audio", correctAnswer: "C major")
        XCTAssertTrue(QuizGrader.grade(audio, locale: .en, answer: .text("c MAJOR")))
    }

    // MARK: - grade: fill_in_blank

    func testGradeFillInBlankAllBlanksMustMatch() {
        let question = makeQuestion(
            questionType: "fill_in_blank",
            options: makeOptions(text: "{{x}} and {{y}}", blanks: [blank("x", "one"), blank("y", "two")])
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "ONE", "y": " two "])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "one", "y": "three"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "one"]))) // missing y
    }

    func testGradeFillInBlankWithNoBlanksIsAlwaysFalse() {
        let question = makeQuestion(questionType: "fill_in_blank", options: makeOptions(blanks: []))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .blanks([:])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "anything"])))
    }

    /// The web never calls a locale accessor inside `gradeQuestion` itself — it grades whatever
    /// `q.options` holds *at that point*, and `class-item-renderer.tsx` has already overwritten
    /// `q.options` with `options_es` (when present) before the row ever reaches the runner. So a
    /// Spanish-locale student is, in effect, graded against the Spanish blank answer. This proves
    /// the Swift port reproduces that (via `displayOptions(locale)` inside `grade`), not just the
    /// English-canonical text.
    func testGradeFillInBlankUsesLocaleResolvedBlankAnswerWhenEsOverrideIsPresent() {
        let question = makeQuestion(
            questionType: "fill_in_blank",
            options: makeOptions(text: "{{x}}", blanks: [blank("x", "tumbao")]),
            optionsEs: makeOptions(text: "{{x}}", blanks: [blank("x", "tumbao en español")])
        )
        // English locale grades against the English blank answer.
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "tumbao"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .blanks(["x": "tumbao en español"])))
        // Spanish locale grades against the Spanish (options_es) blank answer instead.
        XCTAssertTrue(QuizGrader.grade(question, locale: .es, answer: .blanks(["x": "tumbao en español"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .es, answer: .blanks(["x": "tumbao"])))
    }

    // MARK: - grade: matching_pairs

    func testGradeMatchingPairsEachLeftMapsToItsRightText() {
        let question = makeQuestion(
            questionType: "matching_pairs",
            options: makeOptions(pairs: [pair("l1", "A", "Alpha"), pair("l2", "B", "Beta")])
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .pairs(["l1": "Alpha", "l2": "Beta"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .pairs(["l1": "Beta", "l2": "Alpha"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .pairs(["l1": "Alpha"]))) // partial
    }

    /// Same locale-resolution subtlety as fill_in_blank above, for matching_pairs' `right` text.
    func testGradeMatchingPairsUsesLocaleResolvedRightTextWhenEsOverrideIsPresent() {
        let question = makeQuestion(
            questionType: "matching_pairs",
            options: makeOptions(pairs: [pair("l1", "Clave", "The rhythmic key pattern")]),
            optionsEs: makeOptions(pairs: [pair("l1", "Clave", "El patrón rítmico clave")])
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .pairs(["l1": "The rhythmic key pattern"])))
        XCTAssertTrue(QuizGrader.grade(question, locale: .es, answer: .pairs(["l1": "El patrón rítmico clave"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .es, answer: .pairs(["l1": "The rhythmic key pattern"])))
    }

    // MARK: - grade: ordering_sequence

    func testGradeOrderingSequenceIdsMustLandInCorrectPositionOrder() {
        let question = makeQuestion(
            questionType: "ordering_sequence",
            options: makeOptions(items: [
                orderItem("a", "A", 0), orderItem("b", "B", 1), orderItem("c", "C", 2)
            ])
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .ordering(["a", "b", "c"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .ordering(["b", "a", "c"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .ordering(["a", "b"]))) // wrong length
    }

    func testGradeOrderingSequenceWithNoItemsIsAlwaysFalse() {
        let question = makeQuestion(questionType: "ordering_sequence", options: makeOptions(items: []))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .ordering([])))
    }

    // MARK: - grade: audio_choice

    func testGradeAudioChoiceCorrectWhenAnswerIdMatchesCorrectAnswer() {
        let question = makeQuestion(
            questionType: "audio_choice",
            options: makeOptions(choices: [choice("c1", "Clave"), choice("c2", "Conga")]),
            correctAnswer: "c2"
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .choice("c2")))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .choice("c1")))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .none))
    }

    // MARK: - grade: instrument_assembly

    func testGradeInstrumentAssemblyEveryPartMustLandInItsCorrectZone() {
        let question = makeQuestion(
            questionType: "instrument_assembly",
            options: makeOptions(
                parts: [assemblyPart("p1", "Head", "z1"), assemblyPart("p2", "Shell", "z2")],
                zones: [assemblyZone("z1", "Top"), assemblyZone("z2", "Bottom")]
            )
        )
        XCTAssertTrue(QuizGrader.grade(question, locale: .en, answer: .assembly(["p1": "z1", "p2": "z2"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .assembly(["p1": "z2", "p2": "z1"])))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .assembly(["p1": "z1"]))) // unplaced part
    }

    func testGradeInstrumentAssemblyWithNoPartsIsAlwaysFalse() {
        let question = makeQuestion(questionType: "instrument_assembly", options: makeOptions(parts: []))
        XCTAssertFalse(QuizGrader.grade(question, locale: .en, answer: .assembly([:])))
    }

    // MARK: - hasAnswer

    func testHasAnswerMultipleChoiceNeedsANonEmptyString() {
        let question = makeQuestion(questionType: "multiple_choice")
        XCTAssertTrue(QuizGrader.hasAnswer(question, answer: .choice("a")))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .choice("")))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .none))
    }

    func testHasAnswerFillInBlankNeedsAtLeastOneEntry() {
        let question = makeQuestion(questionType: "fill_in_blank")
        XCTAssertTrue(QuizGrader.hasAnswer(question, answer: .blanks(["x": "a"])))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .blanks([:])))
    }

    func testHasAnswerOrderingSequenceAlwaysHasAnOrder() {
        // Web: `if (question_type === 'ordering_sequence') return true` — unconditional, even
        // before any answer has been seeded.
        XCTAssertTrue(QuizGrader.hasAnswer(makeQuestion(questionType: "ordering_sequence"), answer: .none))
        XCTAssertTrue(
            QuizGrader.hasAnswer(makeQuestion(questionType: "ordering_sequence"), answer: .ordering(["a"]))
        )
    }

    func testHasAnswerAudioChoiceNeedsANonEmptyString() {
        let question = makeQuestion(questionType: "audio_choice")
        XCTAssertTrue(QuizGrader.hasAnswer(question, answer: .choice("c1")))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .choice("")))
    }

    func testHasAnswerInstrumentAssemblyNeedsAtLeastOnePlacedPart() {
        let question = makeQuestion(questionType: "instrument_assembly")
        XCTAssertTrue(QuizGrader.hasAnswer(question, answer: .assembly(["p1": "z1"])))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .assembly([:])))
    }

    /// Not in the TS test file (matching_pairs/true_false/text_answer/audio aren't exercised
    /// there) — derived directly from `hasAnswer`'s source: matching_pairs shares the
    /// object-with-keys branch; true_false/text_answer/audio fall through to the default
    /// non-empty-trimmed-string branch.
    func testHasAnswerMatchingPairsNeedsAtLeastOneEntry() {
        let question = makeQuestion(questionType: "matching_pairs")
        XCTAssertTrue(QuizGrader.hasAnswer(question, answer: .pairs(["l1": "Alpha"])))
        XCTAssertFalse(QuizGrader.hasAnswer(question, answer: .pairs([:])))
    }

    func testHasAnswerTrueFalseAndTextTypesNeedNonEmptyTrimmedValue() {
        XCTAssertTrue(QuizGrader.hasAnswer(makeQuestion(questionType: "true_false"), answer: .bool(true)))
        XCTAssertFalse(QuizGrader.hasAnswer(makeQuestion(questionType: "true_false"), answer: .none))

        let textQuestion = makeQuestion(questionType: "text_answer")
        XCTAssertTrue(QuizGrader.hasAnswer(textQuestion, answer: .text("hello")))
        XCTAssertFalse(QuizGrader.hasAnswer(textQuestion, answer: .text("   ")))
        XCTAssertFalse(QuizGrader.hasAnswer(textQuestion, answer: .text("")))
    }

}
