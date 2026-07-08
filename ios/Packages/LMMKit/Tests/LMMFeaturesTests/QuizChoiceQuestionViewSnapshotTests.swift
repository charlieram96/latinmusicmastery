import LMMDesignSystem
import LMMLocalization
import SnapshotTesting
import SwiftUI
import XCTest

@testable import LMMData
@testable import LMMFeatures
@testable import LMMModels

/// Snapshot coverage (light + dark) for the multiple_choice question view — the representative
/// per-type question view called out in the B7 brief. Ungraded state: one selected tile among
/// three plain-text options.
final class QuizChoiceQuestionViewSnapshotTests: XCTestCase {
    private let precision: Float = 0.98
    private let perceptual: Float = 0.97

    func testMultipleChoiceUngradedLight() {
        assertQuestion(style: .light)
    }

    func testMultipleChoiceUngradedDark() {
        assertQuestion(style: .dark)
    }

    // MARK: Fixtures

    private var question: QuizQuestion {
        QuizQuestion(
            id: UUID(uuidString: "00000000-0000-4000-8000-000000000001")!,
            classItemId: UUID(),
            orderIndex: 0,
            question: "Which hand traditionally plays clave?",
            questionEs: nil,
            questionType: "multiple_choice",
            options: QuizOptions(
                choices: [
                    QuizOptions.Choice(id: "a", text: "The right hand", audioUrl: nil),
                    QuizOptions.Choice(id: "b", text: "The left hand", audioUrl: nil),
                    QuizOptions.Choice(id: "c", text: "Either hand, player's choice", audioUrl: nil)
                ],
                pairs: nil, text: nil, blanks: nil, items: nil, parts: nil, zones: nil
            ),
            optionsEs: nil,
            correctAnswer: "a",
            explanation: "The right hand traditionally plays clave in son ensembles.",
            explanationEs: nil,
            imageUrl: nil,
            audioUrl: nil,
            createdAt: nil,
            updatedAt: nil
        )
    }

    private func assertQuestion(
        style: UIUserInterfaceStyle,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let host = QuizChoiceQuestionView(
            question: question,
            locale: .en,
            answer: .choice("a"),
            isGraded: false,
            onChange: { _ in }
        )
        .padding(16)
        .frame(width: 360)
        .background(LMMColor.background)

        assertSnapshot(
            of: host,
            as: .image(
                precision: precision,
                perceptualPrecision: perceptual,
                layout: .sizeThatFits,
                traits: UITraitCollection(userInterfaceStyle: style)
            ),
            file: file,
            testName: testName,
            line: line
        )
    }
}
