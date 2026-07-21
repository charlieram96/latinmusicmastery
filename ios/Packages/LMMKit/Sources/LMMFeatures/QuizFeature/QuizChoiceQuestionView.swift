import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// multiple_choice + audio_choice: a list of tappable option tiles. audio_choice adds a prompt
/// clip (the question's own `audio_url`) above the list, and per-option clip buttons whenever a
/// choice carries an `audioUrl` — mirrors the web's `AudioChoicePlayer` fallback-to-text behavior.
struct QuizChoiceQuestionView: View {
    let question: QuizQuestion
    let locale: AppLocale
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    private static let letters = ["A", "B", "C", "D", "E", "F", "G", "H"]

    var body: some View {
        let choices = question.displayOptions(locale)?.choices ?? []
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            if question.questionType == "audio_choice", let url = question.audioUrl.flatMap(URL.init(string:)) {
                HStack(spacing: LMMSpacing.sm) {
                    QuizAudioClipButton(url: url)
                    Text(lmmString("quiz.type.audioChoice"))
                        .font(LMMFont.callout)
                        .foregroundStyle(LMMColor.mutedForeground)
                }
                .padding(LMMSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surfaceSunken)
                )
            }

            VStack(spacing: LMMSpacing.sm) {
                ForEach(Array(choices.enumerated()), id: \.offset) { index, item in
                    choiceRow(item, index: index)
                }
            }
        }
    }

    private func choiceRow(_ item: QuizOptions.Choice, index: Int) -> some View {
        let choiceId = item.id ?? "\(index)"
        let selected: Bool = {
            if case .choice(let value) = answer { return value == choiceId }
            return false
        }()
        let state: QuizTileState = {
            guard isGraded else { return selected ? .selected : .idle }
            return question.correctAnswer == choiceId ? .correct : (selected ? .incorrect : .idle)
        }()
        return QuizOptionTile(
            label: index < Self.letters.count ? Self.letters[index] : nil,
            state: state,
            disabled: isGraded,
            action: { onChange(.choice(choiceId)) },
            content: { choiceLabel(item, index: index) }
        )
    }

    @ViewBuilder
    private func choiceLabel(_ item: QuizOptions.Choice, index: Int) -> some View {
        if question.questionType == "audio_choice", let clipUrl = item.audioUrl.flatMap(URL.init(string:)) {
            HStack(spacing: LMMSpacing.sm) {
                QuizAudioClipButton(url: clipUrl)
                Text(fallbackText(item.text, index: index))
            }
        } else {
            Text(item.text ?? "")
        }
    }

    private func fallbackText(_ text: String?, index: Int) -> String {
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty { return trimmed }
        return lmmFormat("quiz.audioChoice.clipLabel", index + 1)
    }
}
