import LMMData
import LMMDesignSystem
import LMMModels
import SwiftUI

/// true_false: two large tiles. TS stores the answer as the literal string "true"/"false"; the
/// Swift port represents it as `.bool` (see ``QuizAnswer``) — see ``QuizGrader/grade`` for how the
/// two stay equivalent.
struct QuizTrueFalseQuestionView: View {
    let question: QuizQuestion
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    var body: some View {
        HStack(spacing: LMMSpacing.sm) {
            tile(value: true, label: lmmString("quiz.trueFalse.true"))
            tile(value: false, label: lmmString("quiz.trueFalse.false"))
        }
    }

    private func tile(value: Bool, label: String) -> some View {
        let selected: Bool = {
            if case .bool(let current) = answer { return current == value }
            return false
        }()
        var state: QuizTileState = selected ? .selected : .idle
        if isGraded {
            let correctIsTrue = QuizGrader.norm(question.correctAnswer ?? "") == "true"
            state = (value == correctIsTrue) ? .correct : (selected ? .incorrect : .idle)
        }
        return QuizOptionTile(
            label: nil,
            state: state,
            disabled: isGraded,
            action: { onChange(.bool(value)) },
            content: {
                Text(label)
                    .font(LMMFont.headline)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        )
    }
}
