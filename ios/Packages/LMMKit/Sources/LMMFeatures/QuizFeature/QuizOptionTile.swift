import LMMDesignSystem
import SwiftUI

/// Graded visual state for one answer tile. Mirrors the web's `OptionTile` `TileState`.
enum QuizTileState: Equatable {
    case idle
    case selected
    case correct
    case incorrect
}

/// A large tappable answer tile with an optional letter badge and graded states — the shared
/// building block behind multiple_choice, audio_choice, and true_false. Ported from the web's
/// `components/class-viewer/lesson-viewer/quiz/option-tile.tsx`.
struct QuizOptionTile<Content: View>: View {
    let label: String?
    let state: QuizTileState
    let disabled: Bool
    let action: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        Button(action: action) {
            HStack(spacing: LMMSpacing.sm) {
                if let label {
                    ZStack {
                        RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                            .strokeBorder(badgeBorder, lineWidth: 2)
                            .background(
                                RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous).fill(badgeFill)
                            )
                        badgeContent(label)
                    }
                    .frame(width: 36, height: 36)
                }
                content()
                    .font(LMMFont.body.weight(.medium))
                    .foregroundStyle(LMMColor.foreground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
            }
            .padding(LMMSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous).fill(fill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous).strokeBorder(border, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityAddTraits(state == .selected ? .isSelected : [])
    }

    @ViewBuilder
    private func badgeContent(_ label: String) -> some View {
        switch state {
        case .correct:
            Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
        case .incorrect:
            Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
        case .idle, .selected:
            Text(label).font(LMMFont.caption).foregroundStyle(badgeForeground)
        }
    }

    private var fill: Color {
        switch state {
        case .idle: return LMMColor.surface
        case .selected: return LMMColor.primary.opacity(0.1)
        case .correct: return LMMColor.success.opacity(0.1)
        case .incorrect: return LMMColor.destructive.opacity(0.1)
        }
    }

    private var border: Color {
        switch state {
        case .idle: return LMMColor.border
        case .selected: return LMMColor.primary
        case .correct: return LMMColor.success
        case .incorrect: return LMMColor.destructive
        }
    }

    private var badgeFill: Color {
        switch state {
        case .idle: return .clear
        case .selected: return LMMColor.primary
        case .correct: return LMMColor.success
        case .incorrect: return LMMColor.destructive
        }
    }

    private var badgeBorder: Color {
        switch state {
        case .idle: return LMMColor.border
        case .selected: return LMMColor.primary
        case .correct: return LMMColor.success
        case .incorrect: return LMMColor.destructive
        }
    }

    private var badgeForeground: Color {
        state == .selected ? LMMColor.onPrimary : LMMColor.mutedForeground
    }
}
