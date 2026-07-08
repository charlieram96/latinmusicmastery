import Foundation
import LMMData
import LMMLocalization
import LMMModels
import Observation

/// Drives one QUIZ class item's runner, mirroring `components/class-viewer/lesson-viewer/
/// quiz-runner.tsx`'s flow: load -> per-question check -> feedback -> next -> finish (fire-and-
/// forget `markComplete`) -> results -> optional restart.
///
/// All grading/shuffle logic is delegated to the pure ``QuizGrader`` — this type only owns the
/// session's mutable state machine and the two repository calls (fetch questions, mark complete).
@MainActor
@Observable
public final class QuizRunnerViewModel {
    public enum Phase: Equatable {
        case loading
        /// The quiz has no questions yet (web: "This quiz has no questions yet.").
        case empty
        case failed
        case active
        case finished
    }

    public private(set) var phase: Phase = .loading
    public private(set) var questions: [QuizQuestion] = []
    public private(set) var index = 0
    public private(set) var answers: [UUID: QuizAnswer] = [:]
    public private(set) var graded: [UUID: Bool] = [:]

    /// Exposed purely so tests can deterministically await the fire-and-forget `markComplete`
    /// call (mirrors the web's `void markClassItemComplete(id).catch(() => {})` at quiz-runner.tsx
    /// line ~77 — the UI never blocks on it, but a test needs a handle to prove it fired).
    @ObservationIgnored public private(set) var pendingMarkCompleteTask: Task<Void, Never>?
    @ObservationIgnored public private(set) var markCompleteCallCount = 0

    @ObservationIgnored private let itemId: UUID
    @ObservationIgnored private let quizRepository: QuizRepository
    @ObservationIgnored private let progressRepository: ProgressRepository
    /// Captured once at construction (mirrors how ``LessonVideoPlayerModel`` captures its default
    /// subtitle language) — the web's equivalent is baked in once per server render too. Grading
    /// needs this: see the long comment on ``QuizGrader/grade(_:locale:answer:)``.
    @ObservationIgnored private let locale: AppLocale

    public init(
        itemId: UUID,
        quizRepository: QuizRepository,
        progressRepository: ProgressRepository,
        locale: AppLocale
    ) {
        self.itemId = itemId
        self.quizRepository = quizRepository
        self.progressRepository = progressRepository
        self.locale = locale
    }

    // MARK: - Load

    public func load() async {
        phase = .loading
        do {
            let fetched = try await quizRepository.questions(classItemId: itemId)
            questions = fetched.sorted { $0.orderIndex < $1.orderIndex }
            guard !questions.isEmpty else {
                phase = .empty
                return
            }
            index = 0
            graded = [:]
            seedAnswers()
            phase = .active
        } catch {
            phase = .failed
        }
    }

    // MARK: - Derived state

    public var currentQuestion: QuizQuestion? {
        questions.indices.contains(index) ? questions[index] : nil
    }

    public var currentAnswer: QuizAnswer {
        guard let question = currentQuestion else { return .none }
        return answers[question.id] ?? .none
    }

    public var isCurrentGraded: Bool {
        guard let question = currentQuestion else { return false }
        return graded[question.id] != nil
    }

    public var wasCurrentCorrect: Bool {
        guard let question = currentQuestion else { return false }
        return graded[question.id] ?? false
    }

    public var canCheck: Bool {
        guard let question = currentQuestion else { return false }
        return QuizGrader.hasAnswer(question, answer: currentAnswer)
    }

    public var isFirst: Bool { index == 0 }
    public var isLast: Bool { index >= questions.count - 1 }

    public var correctCount: Int {
        questions.reduce(into: 0) { count, question in
            if graded[question.id] == true { count += 1 }
        }
    }

    public var scorePercent: Int {
        guard !questions.isEmpty else { return 0 }
        return Int((Double(correctCount) / Double(questions.count) * 100).rounded())
    }

    // MARK: - Actions

    public func setAnswer(_ answer: QuizAnswer) {
        // The web's setter itself has no such guard (only the disabled UI inputs prevent calls
        // once graded) — this mirrors that *effective* behavior defensively at the state layer.
        guard let question = currentQuestion, !isCurrentGraded else { return }
        answers[question.id] = answer
    }

    public func check() {
        guard let question = currentQuestion, !isCurrentGraded, canCheck else { return }
        graded[question.id] = QuizGrader.grade(question, locale: locale, answer: answers[question.id] ?? .none)
    }

    public func goPrevious() {
        guard phase == .active, index > 0 else { return }
        index -= 1
    }

    public func goNext() {
        guard phase == .active else { return }
        if index < questions.count - 1 {
            index += 1
        } else {
            phase = .finished
            fireMarkComplete()
        }
    }

    public func restart() {
        index = 0
        graded = [:]
        seedAnswers()
        phase = .active
    }

    // MARK: - Private

    /// Mirrors the web's `seedAnswers`: ordering questions start pre-shuffled (via the same
    /// seeded LCG as the web) so grading has a defined initial answer; assembly questions start
    /// with an empty placement map. Every other type starts unanswered.
    private func seedAnswers() {
        var seeded: [UUID: QuizAnswer] = [:]
        for question in questions {
            switch question.questionType {
            case "ordering_sequence":
                let ids = (question.displayOptions(locale)?.items ?? []).compactMap(\.id)
                let shuffled = QuizGrader.shuffleStable(ids, seed: QuizGrader.shuffleSeed(for: question))
                seeded[question.id] = .ordering(shuffled)
            case "instrument_assembly":
                seeded[question.id] = .assembly([:])
            default:
                break
            }
        }
        answers = seeded
    }

    private func fireMarkComplete() {
        markCompleteCallCount += 1
        pendingMarkCompleteTask = Task { [progressRepository, itemId] in
            try? await progressRepository.markComplete(itemId: itemId)
        }
    }
}
