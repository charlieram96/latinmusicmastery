import LMMDesignSystem
import SwiftUI

/// A single class row inside a course's curriculum: a leading state icon, the class title and
/// metadata, an optional Free badge, and a trailing chevron.
struct ClassRowContent: View {
    enum State {
        case available
        case inProgress
        case completed
        case locked
    }

    let title: String
    let subtitle: String
    let state: State
    let isFree: Bool

    var body: some View {
        HStack(spacing: LMMSpacing.sm) {
            icon
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(LMMFont.body.weight(.medium))
                    .foregroundStyle(LMMColor.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(LMMFont.caption)
                    .foregroundStyle(LMMColor.mutedForeground)
            }
            Spacer(minLength: LMMSpacing.xs)
            if isFree {
                Badge(.free)
            }
            Image(systemName: state == .locked ? "lock.fill" : "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LMMColor.mutedForeground)
        }
        .padding(.horizontal, LMMSpacing.md)
        .padding(.vertical, LMMSpacing.sm)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private var icon: some View {
        switch state {
        case .available:
            Image(systemName: "play.circle")
                .font(.system(size: 20))
                .foregroundStyle(LMMColor.primary)
        case .inProgress:
            Image(systemName: "circle.lefthalf.filled")
                .font(.system(size: 20))
                .foregroundStyle(LMMColor.primary)
        case .completed:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(LMMColor.success)
        case .locked:
            Image(systemName: "lock.circle")
                .font(.system(size: 20))
                .foregroundStyle(LMMColor.mutedForeground)
        }
    }

    private var accessibilityLabel: String {
        let stateText: String
        switch state {
        case .available: stateText = ""
        case .inProgress: stateText = lmmString("class.state.inProgress")
        case .completed: stateText = lmmString("class.state.completed")
        case .locked: stateText = lmmString("class.state.locked")
        }
        // `.accessibilityElement(children: .combine)` gets overridden by the explicit label
        // below, so the Free badge (visible only) must be folded back in here or VoiceOver
        // never hears it.
        let freeText = isFree ? lmmString("class.state.free") : ""
        return [title, subtitle, freeText, stateText]
            .filter { !$0.isEmpty }
            .joined(separator: ". ")
    }
}
