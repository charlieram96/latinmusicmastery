import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// ordering_sequence: a drag-to-reorder list. The `QuizRunnerViewModel` seeds the initial order
/// via the same seeded `shuffleStable` the web uses, so the starting order matches across
/// platforms for the same question id — this view only reorders what it's given.
///
/// Embeds a native `List` (for its built-in drag handles/`onMove`) inside the outer scroll view by
/// disabling the List's own scrolling and sizing it to its row count — a standard technique for a
/// "static reorderable list" living inside a larger scrollable page.
struct QuizOrderingSequenceQuestionView: View {
    private static let rowHeight: CGFloat = 60

    let question: QuizQuestion
    let locale: AppLocale
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    var body: some View {
        let items = question.displayOptions(locale)?.items ?? []
        let byId = Dictionary(uniqueKeysWithValues: items.compactMap { item -> (String, QuizOptions.OrderItem)? in
            guard let id = item.id else { return nil }
            return (id, item)
        })
        let order: [String] = {
            if case .ordering(let value) = answer { return value }
            return items.compactMap(\.id)
        }()

        List {
            ForEach(order, id: \.self) { id in
                row(id: id, item: byId[id], position: order.firstIndex(of: id) ?? 0)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                    .listRowBackground(Color.clear)
            }
            .onMove { indices, newOffset in
                guard !isGraded else { return }
                var next = order
                next.move(fromOffsets: indices, toOffset: newOffset)
                onChange(.ordering(next))
            }
            .moveDisabled(isGraded)
        }
        .listStyle(.plain)
        .scrollDisabled(true)
        .scrollContentBackground(.hidden)
        .environment(\.editMode, .constant(.active))
        .frame(height: CGFloat(order.count) * Self.rowHeight)
    }

    private func row(id: String, item: QuizOptions.OrderItem?, position: Int) -> some View {
        let isCorrect = isGraded && item?.correctPosition == position
        return HStack(spacing: LMMSpacing.sm) {
            Text("\(position + 1)")
                .font(LMMFont.caption.weight(.bold))
                .foregroundStyle(LMMColor.primary)
                .frame(width: 26, height: 26)
                .background(Circle().fill(LMMColor.primary.opacity(0.12)))
            Text(item?.text ?? "")
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.foreground)
            Spacer()
            if isGraded {
                Image(systemName: isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(isCorrect ? LMMColor.success : LMMColor.destructive)
            }
        }
        .padding(LMMSpacing.sm)
        .frame(height: Self.rowHeight - 8)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(rowFill(isCorrect: isCorrect))
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                .strokeBorder(rowBorder(isCorrect: isCorrect), lineWidth: 1)
        )
    }

    private func rowFill(isCorrect: Bool) -> Color {
        guard isGraded else { return LMMColor.surface }
        return isCorrect ? LMMColor.success.opacity(0.1) : LMMColor.destructive.opacity(0.1)
    }

    private func rowBorder(isCorrect: Bool) -> Color {
        guard isGraded else { return LMMColor.border }
        return isCorrect ? LMMColor.success : LMMColor.destructive
    }
}
