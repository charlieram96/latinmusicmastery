import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The QUIZ class item's runner — ports `components/class-viewer/lesson-viewer/quiz-runner.tsx`'s
/// flow: load -> per-question check/feedback/next -> finish (fires `markComplete`) -> results ->
/// restart. Owns a ``QuizRunnerViewModel`` scoped to one `itemId`; `.task(id: itemId)` reloads it
/// whenever the class viewer's item switcher lands on a *different* QUIZ item (the B6 placeholder
/// this replaces used a bare `.task` with no `id:`, so it never reloaded across items).
struct QuizRunnerView: View {
    let itemId: UUID

    @Environment(AppServices.self) private var services
    @Environment(\.appLocale) private var locale
    @State private var viewModel: QuizRunnerViewModel?

    var body: some View {
        Group {
            if let viewModel {
                phaseBody(viewModel)
            } else {
                LoadingView()
            }
        }
        .task(id: itemId) {
            let model = QuizRunnerViewModel(
                itemId: itemId,
                quizRepository: services.quiz,
                progressRepository: services.progress,
                locale: locale
            )
            viewModel = model
            await model.load()
        }
    }

    @ViewBuilder
    private func phaseBody(_ runner: QuizRunnerViewModel) -> some View {
        switch runner.phase {
        case .loading:
            LoadingView()
        case .empty:
            EmptyStateView(
                systemImage: "checklist", title: lmmString("viewer.quiz.title"), message: lmmString("quiz.empty")
            )
        case .failed:
            ErrorView(
                title: lmmString("error.generic.title"),
                message: lmmString("error.generic.message"),
                retryTitle: lmmString("error.retry")
            ) { Task { await runner.load() } }
        case .active:
            if let question = runner.currentQuestion {
                activeCard(runner, question: question)
            } else {
                LoadingView()
            }
        case .finished:
            QuizResultsView(questions: runner.questions, graded: runner.graded, locale: locale) {
                runner.restart()
            }
        }
    }

    private func activeCard(_ runner: QuizRunnerViewModel, question: QuizQuestion) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.lg) {
            QuizProgressHeader(total: runner.questions.count, current: runner.index)

            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                Text(typeLabel(question.questionType))
                    .font(LMMFont.eyebrow)
                    .tracking(0.6)
                    .textCase(.uppercase)
                    .foregroundStyle(LMMColor.primary)
                    .padding(.horizontal, LMMSpacing.sm)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(LMMColor.primary.opacity(0.1)))

                Text(question.displayQuestion(locale))
                    .font(LMMFont.title2)
                    .foregroundStyle(LMMColor.foreground)
                    .fixedSize(horizontal: false, vertical: true)
            }

            questionBody(question, runner: runner)
                .id(question.id) // fresh interaction state (e.g. selection) per question

            if runner.isCurrentGraded {
                QuizFeedbackBanner(correct: runner.wasCurrentCorrect, explanation: question.displayExplanation(locale))
            }

            navigationRow(runner)
        }
        .padding(LMMSpacing.lg)
        .background(RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous).fill(LMMColor.surface))
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous).strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    private func navigationRow(_ runner: QuizRunnerViewModel) -> some View {
        HStack(spacing: LMMSpacing.sm) {
            Button {
                runner.goPrevious()
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 20)
            }
            .buttonStyle(.lmmSecondary)
            .fixedSize()
            .disabled(runner.isFirst)
            .accessibilityLabel(Text(lmmString("quiz.previous")))

            if runner.isCurrentGraded {
                Button {
                    runner.goNext()
                } label: {
                    Label(
                        runner.isLast ? lmmString("quiz.finish") : lmmString("quiz.next"),
                        systemImage: "chevron.right"
                    )
                    .labelStyle(.trailingIcon)
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmPrimary)
            } else {
                Button {
                    runner.check()
                } label: {
                    Label(lmmString("quiz.checkAnswer"), systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmPrimary)
                .disabled(!runner.canCheck)
            }
        }
    }

    @ViewBuilder
    private func questionBody(_ question: QuizQuestion, runner: QuizRunnerViewModel) -> some View {
        switch question.questionType {
        case "multiple_choice", "audio_choice":
            QuizChoiceQuestionView(
                question: question, locale: locale, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "true_false":
            QuizTrueFalseQuestionView(
                question: question, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "text_answer", "audio":
            QuizTextQuestionView(
                question: question, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "fill_in_blank":
            QuizFillInBlankQuestionView(
                question: question, locale: locale, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "matching_pairs":
            QuizMatchingPairsQuestionView(
                question: question, locale: locale, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "ordering_sequence":
            QuizOrderingSequenceQuestionView(
                question: question, locale: locale, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        case "instrument_assembly":
            QuizInstrumentAssemblyQuestionView(
                question: question, locale: locale, answer: runner.currentAnswer, isGraded: runner.isCurrentGraded,
                onChange: runner.setAnswer
            )
        default:
            Text(question.questionType).font(LMMFont.callout).foregroundStyle(LMMColor.mutedForeground)
        }
    }

    private func typeLabel(_ type: String) -> String {
        switch type {
        case "multiple_choice": return lmmString("quiz.type.multipleChoice")
        case "true_false": return lmmString("quiz.type.trueFalse")
        case "text_answer": return lmmString("quiz.type.textAnswer")
        case "audio": return lmmString("quiz.type.audio")
        case "audio_choice": return lmmString("quiz.type.audioChoice")
        case "instrument_assembly": return lmmString("quiz.type.instrumentAssembly")
        case "fill_in_blank": return lmmString("quiz.type.fillInBlank")
        case "matching_pairs": return lmmString("quiz.type.matchingPairs")
        case "ordering_sequence": return lmmString("quiz.type.orderingSequence")
        default: return lmmString("viewer.quiz.title")
        }
    }
}

private struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack {
            configuration.title
            configuration.icon
        }
    }
}

private extension LabelStyle where Self == TrailingIconLabelStyle {
    static var trailingIcon: TrailingIconLabelStyle { TrailingIconLabelStyle() }
}
