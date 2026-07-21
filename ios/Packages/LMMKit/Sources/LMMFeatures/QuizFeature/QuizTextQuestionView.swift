import LMMData
import LMMDesignSystem
import LMMModels
import SwiftUI

/// text_answer + audio: a single free-text field. `audio` additionally shows a clip player for
/// the question's `audio_url` above the field ("listen, then type what you hear").
struct QuizTextQuestionView: View {
    let question: QuizQuestion
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.sm) {
            if question.questionType == "audio", let url = question.audioUrl.flatMap(URL.init(string:)) {
                HStack(spacing: LMMSpacing.sm) {
                    QuizAudioClipButton(url: url)
                    Text(lmmString("quiz.type.audio"))
                        .font(LMMFont.callout)
                        .foregroundStyle(LMMColor.mutedForeground)
                }
                .padding(LMMSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surfaceSunken)
                )
            }

            let text: String = {
                if case .text(let value) = answer { return value }
                return ""
            }()
            TextField(placeholder, text: Binding(get: { text }, set: { onChange(.text($0)) }))
                .textFieldStyle(.roundedBorder)
                .font(LMMFont.body)
                .disabled(isGraded)
                .autocorrectionDisabled(true)
                .textInputAutocapitalization(.never)
        }
    }

    private var placeholder: String {
        question.questionType == "audio"
            ? lmmString("quiz.audio.placeholder")
            : lmmString("quiz.textAnswer.placeholder")
    }
}
