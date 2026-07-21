import LMMDesignSystem
import SwiftUI

/// Correct/incorrect banner shown after Check — ports `quiz/feedback-banner.tsx`.
struct QuizFeedbackBanner: View {
    let correct: Bool
    let explanation: String?

    var body: some View {
        HStack(alignment: .top, spacing: LMMSpacing.sm) {
            Image(systemName: correct ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(correct ? LMMColor.success : LMMColor.destructive)
            VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
                Text(correct ? lmmString("quiz.feedback.correct") : lmmString("quiz.feedback.incorrect"))
                    .font(LMMFont.headline)
                    .foregroundStyle(correct ? LMMColor.success : LMMColor.destructive)
                if let explanation, !explanation.isEmpty {
                    Text(explanation)
                        .font(LMMFont.callout)
                        .foregroundStyle(LMMColor.mutedForeground)
                }
            }
        }
        .padding(LMMSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .fill((correct ? LMMColor.success : LMMColor.destructive).opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder((correct ? LMMColor.success : LMMColor.destructive).opacity(0.35), lineWidth: 1.5)
        )
        .accessibilityElement(children: .combine)
    }
}
