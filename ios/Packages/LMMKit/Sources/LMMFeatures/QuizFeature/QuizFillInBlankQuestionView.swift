import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// One parsed piece of a fill_in_blank sentence: plain text, or a `{{blankId}}` placeholder.
private enum FillInBlankSegment: Equatable {
    case text(String)
    case blank(String)
}

/// Splits `"{{x}} and {{y}}"` into `[.blank("x"), .text(" and "), .blank("y")]` — a manual scan
/// standing in for the web's `text.split(/(\{\{\w+\}\})/g)` + regex match.
private func parseFillInBlankSegments(_ text: String) -> [FillInBlankSegment] {
    var segments: [FillInBlankSegment] = []
    var cursor = text.startIndex
    while let openRange = text.range(of: "{{", range: cursor..<text.endIndex) {
        if openRange.lowerBound > cursor {
            segments.append(.text(String(text[cursor..<openRange.lowerBound])))
        }
        guard let closeRange = text.range(of: "}}", range: openRange.upperBound..<text.endIndex) else {
            segments.append(.text(String(text[openRange.lowerBound..<text.endIndex])))
            return segments
        }
        segments.append(.blank(String(text[openRange.upperBound..<closeRange.lowerBound])))
        cursor = closeRange.upperBound
    }
    if cursor < text.endIndex {
        segments.append(.text(String(text[cursor..<text.endIndex])))
    }
    return segments
}

/// fill_in_blank: renders the inline `{{blank}}`-sentence with a text field per blank when the
/// question supplies `options.text`; otherwise falls back to a plain labeled-input list (mirrors
/// the web's `QuestionInput` fallback for legacy rows with no inline sentence).
struct QuizFillInBlankQuestionView: View {
    let question: QuizQuestion
    let locale: AppLocale
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    var body: some View {
        let opts = question.displayOptions(locale)
        let blanks = opts?.blanks ?? []
        let given: [String: String] = {
            if case .blanks(let value) = answer { return value }
            return [:]
        }()
        let sentence = opts?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !sentence.isEmpty, sentence.contains("{{") {
            inlineSentence(sentence, blanks: blanks, given: given)
        } else {
            labeledList(blanks: blanks, given: given)
        }
    }

    private func inlineSentence(_ sentence: String, blanks: [QuizOptions.Blank], given: [String: String]) -> some View {
        let byId = Dictionary(uniqueKeysWithValues: blanks.compactMap { blank -> (String, QuizOptions.Blank)? in
            guard let id = blank.id else { return nil }
            return (id, blank)
        })
        return QuizFlowLayout(spacing: 4) {
            ForEach(Array(parseFillInBlankSegments(sentence).enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let piece):
                    Text(piece).font(LMMFont.body)
                case .blank(let id):
                    blankField(id: id, blank: byId[id], given: given)
                }
            }
        }
    }

    private func blankField(id: String, blank: QuizOptions.Blank?, given: [String: String]) -> some View {
        let value = given[id] ?? ""
        let isCorrect = isGraded && blank != nil && QuizGrader.norm(value) == QuizGrader.norm(blank?.answer ?? "")
        return TextField("…", text: Binding(get: { value }, set: { onChange(.blanks(merging(given, id, $0))) }))
            .font(LMMFont.body.weight(.semibold))
            .multilineTextAlignment(.center)
            .disabled(isGraded)
            .autocorrectionDisabled(true)
            .frame(minWidth: 70)
            .padding(.horizontal, LMMSpacing.xs)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous).fill(LMMColor.primary.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                    .strokeBorder(blankFieldBorderColor(isCorrect: isCorrect), lineWidth: 1.5)
            )
            .fixedSize(horizontal: true, vertical: false)
    }

    private func blankFieldBorderColor(isCorrect: Bool) -> Color {
        guard isGraded else { return LMMColor.primary.opacity(0.4) }
        return isCorrect ? LMMColor.success : LMMColor.destructive
    }

    private func labeledList(blanks: [QuizOptions.Blank], given: [String: String]) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.sm) {
            ForEach(Array(blanks.enumerated()), id: \.offset) { _, blank in
                let id = blank.id ?? ""
                let value = given[id] ?? ""
                let isCorrect = isGraded && QuizGrader.norm(value) == QuizGrader.norm(blank.answer ?? "")
                HStack(spacing: LMMSpacing.sm) {
                    Text(id)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(LMMColor.mutedForeground)
                        .padding(.horizontal, LMMSpacing.xs)
                        .padding(.vertical, 4)
                        .background(RoundedRectangle(cornerRadius: LMMRadius.sm).fill(LMMColor.secondary))
                    TextField(
                        lmmString("quiz.fillInBlank.placeholder"),
                        text: Binding(get: { value }, set: { onChange(.blanks(merging(given, id, $0))) })
                    )
                    .textFieldStyle(.roundedBorder)
                    .disabled(isGraded)
                }
                .overlay(alignment: .trailing) {
                    if isGraded {
                        Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundStyle(isCorrect ? LMMColor.success : LMMColor.destructive)
                            .padding(.trailing, LMMSpacing.xs)
                    }
                }
            }
        }
    }

    private func merging(_ dict: [String: String], _ key: String, _ value: String) -> [String: String] {
        var next = dict
        next[key] = value
        return next
    }
}
