import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// The finished-quiz results screen: score ring, headline/subtitle bucketed by score, a per-
/// question expandable review (correct-answer label + explanation), and Restart. Ports
/// `components/class-viewer/lesson-viewer/quiz/results-screen.tsx` (confetti omitted — a purely
/// decorative flourish, not a functional requirement).
struct QuizResultsView: View {
    let questions: [QuizQuestion]
    let graded: [UUID: Bool]
    let locale: AppLocale
    let onRestart: () -> Void

    @State private var openQuestionId: UUID?

    private var correctCount: Int {
        questions.reduce(into: 0) { count, question in
            if graded[question.id] == true { count += 1 }
        }
    }

    private var percent: Int {
        questions.isEmpty ? 0 : Int((Double(correctCount) / Double(questions.count) * 100).rounded())
    }

    var body: some View {
        VStack(spacing: LMMSpacing.lg) {
            VStack(spacing: LMMSpacing.md) {
                QuizScoreRing(percent: percent)
                Text(headline)
                    .font(LMMFont.title)
                    .foregroundStyle(LMMColor.foreground)
                Text(subtitle)
                    .font(LMMFont.subheadline)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .multilineTextAlignment(.center)
                Text(lmmFormat("quiz.results.scoreLabel", correctCount, questions.count))
                    .font(LMMFont.headline)
                    .foregroundStyle(LMMColor.primary)
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: LMMSpacing.xs) {
                ForEach(Array(questions.enumerated()), id: \.element.id) { index, question in
                    reviewRow(index: index, question: question)
                }
            }

            Button(action: onRestart) {
                Label(lmmString("quiz.results.tryAgain"), systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.lmmPrimary)
        }
        .padding(LMMSpacing.lg)
        .background(RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous).fill(LMMColor.surface))
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous).strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    private func reviewRow(index: Int, question: QuizQuestion) -> some View {
        let isCorrect = graded[question.id] == true
        let isOpen = openQuestionId == question.id

        return VStack(spacing: 0) {
            reviewRowHeader(index: index, question: question, isCorrect: isCorrect, isOpen: isOpen)
            if isOpen {
                reviewRowDetail(question)
            }
        }
        .background(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surface))
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).strokeBorder(LMMColor.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous))
    }

    private func reviewRowHeader(index: Int, question: QuizQuestion, isCorrect: Bool, isOpen: Bool) -> some View {
        Button {
            openQuestionId = isOpen ? nil : question.id
        } label: {
            HStack(spacing: LMMSpacing.sm) {
                Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(isCorrect ? LMMColor.success : LMMColor.destructive)
                Text("\(index + 1). \(question.displayQuestion(locale))")
                    .font(LMMFont.subheadline.weight(.medium))
                    .foregroundStyle(LMMColor.foreground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                Image(systemName: "chevron.down")
                    .font(.caption)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .rotationEffect(.degrees(isOpen ? 180 : 0))
            }
            .padding(LMMSpacing.sm)
        }
        .buttonStyle(.plain)
    }

    private func reviewRowDetail(_ question: QuizQuestion) -> some View {
        let label = QuizGrader.correctAnswerLabel(question, locale: locale)
        let explanation = question.displayExplanation(locale)

        return VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
            if !label.isEmpty {
                (
                    Text(lmmString("quiz.results.correctAnswer")).fontWeight(.semibold)
                        + Text(label)
                )
                .font(LMMFont.callout)
                .foregroundStyle(LMMColor.foreground)
            }
            if let explanation, !explanation.isEmpty {
                Text(explanation)
                    .font(LMMFont.callout)
                    .foregroundStyle(LMMColor.mutedForeground)
            }
            if label.isEmpty, explanation == nil || explanation?.isEmpty == true {
                Text(lmmString("quiz.results.noDetails"))
                    .font(LMMFont.callout)
                    .foregroundStyle(LMMColor.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(LMMSpacing.sm)
        .background(LMMColor.surfaceSunken)
    }

    private var headline: String {
        if percent >= 90 { return lmmString("quiz.results.headline.perfect") }
        if percent >= 70 { return lmmString("quiz.results.headline.great") }
        if percent >= 50 { return lmmString("quiz.results.headline.nice") }
        return lmmString("quiz.results.headline.keepPracticing")
    }

    private var subtitle: String {
        if percent >= 90 { return lmmString("quiz.results.sub.perfect") }
        if percent >= 70 { return lmmString("quiz.results.sub.great") }
        return lmmString("quiz.results.sub.keepPracticing")
    }
}
