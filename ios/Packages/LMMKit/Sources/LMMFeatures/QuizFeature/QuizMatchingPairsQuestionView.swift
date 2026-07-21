import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// matching_pairs: tap a left item to select it, then tap a right chip to complete the pair — an
/// explicit tap-left-then-right flow (rather than the web's `<Select>` dropdown, which has no
/// direct touch-UI analog) with a clear ("x") affordance to undo a pairing before checking.
struct QuizMatchingPairsQuestionView: View {
    let question: QuizQuestion
    let locale: AppLocale
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    @State private var selectedLeftId: String?

    var body: some View {
        let pairs = question.displayOptions(locale)?.pairs ?? []
        let given: [String: String] = {
            if case .pairs(let value) = answer { return value }
            return [:]
        }()
        // Right-side choices are shuffled the same way the web shuffles its `<Select>` options —
        // stable per question id so they don't reshuffle on every render.
        let rightChoices = QuizGrader.shuffleStable(
            pairs.compactMap(\.right), seed: QuizGrader.shuffleSeed(for: question)
        )

        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            VStack(spacing: LMMSpacing.xs) {
                ForEach(Array(pairs.enumerated()), id: \.offset) { _, pair in
                    leftRow(pair, given: given)
                }
            }

            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                Text(lmmString("quiz.matchingPairs.choosePlaceholder"))
                    .font(LMMFont.caption)
                    .foregroundStyle(selectedLeftId == nil ? LMMColor.mutedForeground.opacity(0.5) : LMMColor.primary)
                QuizFlowLayout(spacing: 8) {
                    ForEach(Array(rightChoices.enumerated()), id: \.offset) { _, right in
                        rightChip(right)
                    }
                }
            }
        }
        .onChange(of: isGraded) { _, graded in if graded { selectedLeftId = nil } }
    }

    private func leftRow(_ pair: QuizOptions.Pair, given: [String: String]) -> some View {
        let id = pair.id ?? ""
        let matchedRight = given[id]
        let isSelected = selectedLeftId == id
        let isCorrect = isGraded && QuizGrader.norm(matchedRight ?? "") == QuizGrader.norm(pair.right ?? "")

        return Button {
            selectedLeftId = isSelected ? nil : id
        } label: {
            HStack(spacing: LMMSpacing.sm) {
                Text(pair.left ?? "")
                    .font(LMMFont.body.weight(.medium))
                    .foregroundStyle(LMMColor.foreground)
                Spacer()
                if let matchedRight, !matchedRight.isEmpty {
                    Text(matchedRight)
                        .font(LMMFont.caption)
                        .foregroundStyle(LMMColor.mutedForeground)
                        .lineLimit(1)
                    if !isGraded {
                        Button {
                            var next = given
                            next.removeValue(forKey: id)
                            onChange(.pairs(next))
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(LMMColor.mutedForeground)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if isGraded {
                    Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(isCorrect ? LMMColor.success : LMMColor.destructive)
                }
            }
            .padding(LMMSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                    .fill(fill(isSelected: isSelected, isCorrect: isCorrect))
            )
            .overlay(
                RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                    .strokeBorder(border(isSelected: isSelected, isCorrect: isCorrect), lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isGraded)
        .accessibilityHint(Text(isSelected ? "" : lmmString("quiz.matchingPairs.choosePlaceholder")))
    }

    private func rightChip(_ text: String) -> some View {
        let disabled = isGraded || selectedLeftId == nil
        return Button {
            guard let leftId = selectedLeftId, !isGraded else { return }
            var next: [String: String] = {
                if case .pairs(let value) = answer { return value }
                return [:]
            }()
            next[leftId] = text
            onChange(.pairs(next))
            selectedLeftId = nil
        } label: {
            Text(text)
                .font(LMMFont.callout)
                .foregroundStyle(disabled ? LMMColor.mutedForeground : LMMColor.foreground)
                .padding(.horizontal, LMMSpacing.sm)
                .padding(.vertical, LMMSpacing.xs)
                .background(Capsule().fill(LMMColor.secondary))
                .overlay(
                    Capsule()
                        .strokeBorder(selectedLeftId == nil || isGraded ? .clear : LMMColor.primary, lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }

    private func fill(isSelected: Bool, isCorrect: Bool) -> Color {
        guard !isGraded else { return isCorrect ? LMMColor.success.opacity(0.1) : LMMColor.destructive.opacity(0.1) }
        return isSelected ? LMMColor.primary.opacity(0.1) : LMMColor.surface
    }

    private func border(isSelected: Bool, isCorrect: Bool) -> Color {
        guard !isGraded else { return isCorrect ? LMMColor.success : LMMColor.destructive }
        return isSelected ? LMMColor.primary : LMMColor.border
    }
}
