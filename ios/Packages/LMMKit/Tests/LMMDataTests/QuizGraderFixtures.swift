import Foundation

@testable import LMMModels

// Shared factories for `QuizGraderTests` + `QuizGraderCorrectAnswerLabelTests` — split out so
// neither test file trips SwiftLint's file/type length rules just from fixture boilerplate.
// Mirrors the TS test file's `q()` helper. Top-level (not nested in a type) so call sites in both
// files stay exactly as short as if each had its own private copy.

func makeQuestion(
    id: UUID = UUID(),
    questionType: String,
    options: QuizOptions? = nil,
    optionsEs: QuizOptions? = nil,
    correctAnswer: String? = nil
) -> QuizQuestion {
    QuizQuestion(
        id: id,
        classItemId: UUID(),
        orderIndex: 0,
        question: "Q",
        questionEs: nil,
        questionType: questionType,
        options: options,
        optionsEs: optionsEs,
        correctAnswer: correctAnswer,
        explanation: nil,
        explanationEs: nil,
        imageUrl: nil,
        audioUrl: nil,
        createdAt: nil,
        updatedAt: nil
    )
}

func makeOptions(
    choices: [QuizOptions.Choice]? = nil,
    pairs: [QuizOptions.Pair]? = nil,
    text: String? = nil,
    blanks: [QuizOptions.Blank]? = nil,
    items: [QuizOptions.OrderItem]? = nil,
    parts: [QuizOptions.AssemblyPart]? = nil,
    zones: [QuizOptions.AssemblyZone]? = nil
) -> QuizOptions {
    QuizOptions(choices: choices, pairs: pairs, text: text, blanks: blanks, items: items, parts: parts, zones: zones)
}

func choice(_ id: String, _ text: String?) -> QuizOptions.Choice {
    QuizOptions.Choice(id: id, text: text, audioUrl: nil)
}

func pair(_ id: String, _ left: String, _ right: String) -> QuizOptions.Pair {
    QuizOptions.Pair(id: id, left: left, right: right)
}

func blank(_ id: String, _ answer: String) -> QuizOptions.Blank {
    QuizOptions.Blank(id: id, answer: answer)
}

func orderItem(_ id: String, _ text: String, _ correctPosition: Int) -> QuizOptions.OrderItem {
    QuizOptions.OrderItem(id: id, text: text, correctPosition: correctPosition)
}

func assemblyPart(_ id: String, _ label: String, _ correctZoneId: String) -> QuizOptions.AssemblyPart {
    QuizOptions.AssemblyPart(id: id, label: label, imageUrl: "", correctZoneId: correctZoneId)
}

func assemblyZone(_ id: String, _ label: String) -> QuizOptions.AssemblyZone {
    QuizOptions.AssemblyZone(id: id, label: label, x: 0, y: 0, width: 10, height: 10)
}
