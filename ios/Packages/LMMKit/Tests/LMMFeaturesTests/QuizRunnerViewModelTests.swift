import XCTest

@testable import LMMData
@testable import LMMFeatures
import LMMLocalization
@testable import LMMModels

/// State-machine coverage for ``QuizRunnerViewModel``: load -> check -> feedback -> next ->
/// finish (fire-and-forget `markComplete`, exactly once per finish) -> restart.
@MainActor
final class QuizRunnerViewModelTests: XCTestCase {
    // MARK: - Load

    func testLoadWithNoQuestionsGoesToEmptyPhase() async {
        let viewModel = makeViewModel(questions: [])
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .empty)
    }

    func testLoadFailurePutsPhaseInFailed() async {
        let viewModel = makeViewModel(questionsError: URLError(.badServerResponse))
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .failed)
    }

    func testLoadSortsByOrderIndexAndSeedsOrderingAndAssemblyAnswers() async {
        let ordering = makeQuestion(
            orderIndex: 1,
            questionType: "ordering_sequence",
            options: makeOptions(items: [orderItem("a", 0), orderItem("b", 1), orderItem("c", 2)])
        )
        let multipleChoice = makeQuestion(
            orderIndex: 0,
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("x", "X")]),
            correctAnswer: "x"
        )
        let assembly = makeQuestion(orderIndex: 2, questionType: "instrument_assembly")
        let viewModel = makeViewModel(questions: [ordering, multipleChoice, assembly])

        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .active)
        XCTAssertEqual(viewModel.questions.map(\.id), [multipleChoice.id, ordering.id, assembly.id])
        XCTAssertEqual(viewModel.index, 0)

        // ordering_sequence seeded with the exact same shuffle the web would produce for this
        // question id + item ids (QuizGraderTests proves shuffleStable's parity separately).
        let expectedShuffle = QuizGrader.shuffleStable(["a", "b", "c"], seed: QuizGrader.shuffleSeed(for: ordering))
        guard case .ordering(let seededOrder) = viewModel.answers[ordering.id] else {
            return XCTFail("expected an .ordering seed for the ordering_sequence question")
        }
        XCTAssertEqual(seededOrder, expectedShuffle)

        guard case .assembly(let placement) = viewModel.answers[assembly.id] else {
            return XCTFail("expected an .assembly seed for the instrument_assembly question")
        }
        XCTAssertTrue(placement.isEmpty)

        // multiple_choice starts unanswered.
        XCTAssertNil(viewModel.answers[multipleChoice.id])
    }

    /// The ViewModel must thread its captured `locale` through to `QuizGrader.grade` — proven
    /// end-to-end here (`QuizGraderTests` proves the grader-level behavior in isolation) using a
    /// fill_in_blank question whose Spanish blank answer differs from the English one.
    func testCheckGradesAgainstTheLocaleResolvedOptions() async {
        let question = makeQuestion(
            orderIndex: 0,
            questionType: "fill_in_blank",
            options: makeOptions(text: "{{x}}", blanks: [blank("x", "tumbao")]),
            optionsEs: makeOptions(text: "{{x}}", blanks: [blank("x", "tumbao en español")])
        )
        let viewModel = makeViewModel(questions: [question], locale: .es)
        await viewModel.load()

        viewModel.setAnswer(.blanks(["x": "tumbao en español"]))
        viewModel.check()
        XCTAssertTrue(viewModel.wasCurrentCorrect)
    }

    // MARK: - Check -> feedback -> next

    func testCheckFeedbackNextStateMachine() async {
        let multipleChoiceQuestion = makeQuestion(
            orderIndex: 0,
            questionType: "multiple_choice",
            options: makeOptions(choices: [choice("a", "A"), choice("b", "B")]),
            correctAnswer: "a"
        )
        let trueFalseQuestion = makeQuestion(orderIndex: 1, questionType: "true_false", correctAnswer: "true")
        let viewModel = makeViewModel(questions: [multipleChoiceQuestion, trueFalseQuestion])
        await viewModel.load()

        XCTAssertFalse(viewModel.canCheck) // nothing answered yet
        viewModel.check() // no-op: canCheck is false
        XCTAssertFalse(viewModel.isCurrentGraded)

        viewModel.setAnswer(.choice("a"))
        XCTAssertTrue(viewModel.canCheck)

        viewModel.check()
        XCTAssertTrue(viewModel.isCurrentGraded)
        XCTAssertTrue(viewModel.wasCurrentCorrect)

        // Answering again after grading is a no-op (mirrors the disabled web inputs).
        viewModel.setAnswer(.choice("b"))
        guard case .choice(let stillA) = viewModel.currentAnswer else { return XCTFail("expected .choice") }
        XCTAssertEqual(stillA, "a")

        viewModel.goNext()
        XCTAssertEqual(viewModel.index, 1)
        XCTAssertEqual(viewModel.phase, .active)
        XCTAssertFalse(viewModel.isCurrentGraded) // fresh question, not yet graded

        viewModel.setAnswer(.bool(false)) // wrong
        viewModel.check()
        XCTAssertTrue(viewModel.isCurrentGraded)
        XCTAssertFalse(viewModel.wasCurrentCorrect)

        XCTAssertTrue(viewModel.isLast)
        viewModel.goNext() // last question -> finished
        XCTAssertEqual(viewModel.phase, .finished)
        XCTAssertEqual(viewModel.correctCount, 1)
        XCTAssertEqual(viewModel.scorePercent, 50)
    }

    // MARK: - Finish fires markComplete exactly once

    func testFinishTriggersMarkCompleteExactlyOnce() async {
        let question = makeQuestion(orderIndex: 0, questionType: "true_false", correctAnswer: "true")
        let progress = FakeProgressRepository()
        let viewModel = makeViewModel(questions: [question], progressRepository: progress)
        await viewModel.load()

        viewModel.setAnswer(.bool(true))
        viewModel.check()
        viewModel.goNext() // only question -> finished

        XCTAssertEqual(viewModel.phase, .finished)
        XCTAssertEqual(viewModel.markCompleteCallCount, 1)
        await viewModel.pendingMarkCompleteTask?.value
        let callCount = await progress.markCompleteCallCount
        XCTAssertEqual(callCount, 1)
        let lastItemId = await progress.lastMarkCompleteItemId
        XCTAssertEqual(lastItemId, question.classItemId) // the ViewModel is keyed by the QUIZ class item id
    }

    func testMarkCompleteFailureIsSwallowedFireAndForget() async {
        let question = makeQuestion(orderIndex: 0, questionType: "true_false", correctAnswer: "true")
        let progress = FakeProgressRepository(markCompleteError: URLError(.notConnectedToInternet))
        let viewModel = makeViewModel(questions: [question], progressRepository: progress)
        await viewModel.load()

        viewModel.setAnswer(.bool(true))
        viewModel.check()
        viewModel.goNext()

        // The ViewModel must not crash/hang and must still reach `.finished` even when the
        // repository call throws — matches the web's `.catch(() => {})`.
        await viewModel.pendingMarkCompleteTask?.value
        XCTAssertEqual(viewModel.phase, .finished)
    }

    // MARK: - Restart

    func testRestartResetsStateAndReSeedsAnswers() async {
        let ordering = makeQuestion(
            orderIndex: 0,
            questionType: "ordering_sequence",
            options: makeOptions(items: [orderItem("a", 0), orderItem("b", 1)])
        )
        let progress = FakeProgressRepository()
        let viewModel = makeViewModel(questions: [ordering], progressRepository: progress)
        await viewModel.load()

        guard case .ordering(let initialSeed) = viewModel.answers[ordering.id] else {
            return XCTFail("expected seeded ordering answer")
        }
        viewModel.setAnswer(.ordering(["b", "a"])) // student reorders (wrong)
        viewModel.check()
        XCTAssertTrue(viewModel.isCurrentGraded)
        viewModel.goNext() // finishes (only question)
        XCTAssertEqual(viewModel.phase, .finished)
        XCTAssertEqual(viewModel.markCompleteCallCount, 1)

        viewModel.restart()

        XCTAssertEqual(viewModel.phase, .active)
        XCTAssertEqual(viewModel.index, 0)
        XCTAssertFalse(viewModel.isCurrentGraded)
        guard case .ordering(let reseeded) = viewModel.answers[ordering.id] else {
            return XCTFail("expected re-seeded ordering answer after restart")
        }
        XCTAssertEqual(reseeded, initialSeed) // deterministic reseed, not the student's edit

        // Finishing again after a restart fires markComplete again (web has no dedup guard).
        viewModel.check()
        viewModel.goNext()
        XCTAssertEqual(viewModel.phase, .finished)
        XCTAssertEqual(viewModel.markCompleteCallCount, 2)
        await viewModel.pendingMarkCompleteTask?.value
        let callCount = await progress.markCompleteCallCount
        XCTAssertEqual(callCount, 2)
    }

    // MARK: - Factories

    private func makeViewModel(
        questions: [QuizQuestion] = [],
        questionsError: Error? = nil,
        progressRepository: FakeProgressRepository = FakeProgressRepository(),
        locale: AppLocale = .en
    ) -> QuizRunnerViewModel {
        let itemId = questions.first?.classItemId ?? UUID()
        let quiz = FakeQuizRepository(questions: questions, error: questionsError)
        return QuizRunnerViewModel(
            itemId: itemId, quizRepository: quiz, progressRepository: progressRepository, locale: locale
        )
    }

    private func makeQuestion(
        orderIndex: Int,
        questionType: String,
        options: QuizOptions? = nil,
        optionsEs: QuizOptions? = nil,
        correctAnswer: String? = nil
    ) -> QuizQuestion {
        QuizQuestion(
            id: UUID(), classItemId: sharedClassItemId, orderIndex: orderIndex, question: "Q \(orderIndex)",
            questionEs: nil, questionType: questionType, options: options, optionsEs: optionsEs,
            correctAnswer: correctAnswer, explanation: nil, explanationEs: nil, imageUrl: nil, audioUrl: nil,
            createdAt: nil, updatedAt: nil
        )
    }

    private let sharedClassItemId = UUID()

    private func makeOptions(
        choices: [QuizOptions.Choice]? = nil,
        text: String? = nil,
        blanks: [QuizOptions.Blank]? = nil,
        items: [QuizOptions.OrderItem]? = nil
    ) -> QuizOptions {
        QuizOptions(choices: choices, pairs: nil, text: text, blanks: blanks, items: items, parts: nil, zones: nil)
    }

    private func choice(_ id: String, _ text: String) -> QuizOptions.Choice {
        QuizOptions.Choice(id: id, text: text, audioUrl: nil)
    }

    private func blank(_ id: String, _ answer: String) -> QuizOptions.Blank {
        QuizOptions.Blank(id: id, answer: answer)
    }

    private func orderItem(_ id: String, _ correctPosition: Int) -> QuizOptions.OrderItem {
        QuizOptions.OrderItem(id: id, text: id, correctPosition: correctPosition)
    }
}

// MARK: - Fakes

private struct FakeQuizRepository: QuizRepository {
    let questions: [QuizQuestion]
    let error: Error?

    func questions(classItemId: UUID) async throws -> [QuizQuestion] {
        if let error { throw error }
        return questions
    }
}

private actor FakeProgressRepository: ProgressRepository {
    private(set) var markCompleteCallCount = 0
    private(set) var lastMarkCompleteItemId: UUID?
    private let markCompleteError: Error?

    init(markCompleteError: Error? = nil) {
        self.markCompleteError = markCompleteError
    }

    func markComplete(itemId: UUID) async throws {
        markCompleteCallCount += 1
        lastMarkCompleteItemId = itemId
        if let markCompleteError { throw markCompleteError }
    }

    func updatePosition(itemId: UUID, seconds: Int) async throws {}
    func enroll(courseId: UUID) async throws {}
    func myEnrollments() async throws -> [CourseEnrollment] { [] }
    func achievements() async throws -> [UserAchievement] { [] }
}
