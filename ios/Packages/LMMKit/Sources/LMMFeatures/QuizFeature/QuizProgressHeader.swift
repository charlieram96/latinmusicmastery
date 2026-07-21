import LMMDesignSystem
import SwiftUI

/// Segmented progress bar + "Question N of M" — ports `quiz/progress-segments.tsx`.
struct QuizProgressHeader: View {
    let total: Int
    let current: Int

    var body: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
            HStack(spacing: 4) {
                ForEach(0..<max(total, 1), id: \.self) { index in
                    Capsule()
                        .fill(index <= current ? LMMColor.primary : LMMColor.border)
                        .frame(height: 4)
                        .opacity(index == current ? 0.55 : (index < current ? 1 : 1))
                }
            }
            Text(lmmFormat("quiz.progress.label", min(current + 1, total), total))
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(lmmFormat("quiz.progress.label", min(current + 1, total), total)))
    }
}
