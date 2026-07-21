import SwiftUI

/// A small status pill. Access state (`free` / `locked` / `enrolled`) and instrument tags
/// share one visual language so a course card reads at a glance.
///
/// Deliberately App-Review-safe: `.locked` communicates state only — no price, no purchase
/// affordance.
public struct Badge: View {
    public enum Kind: Equatable {
        /// This content is free to everyone.
        case free
        /// This content requires a subscription the user doesn't have. State only.
        case locked
        /// The user is enrolled / owns access.
        case enrolled
        /// An instrument tag (Bass, Congas, …).
        case instrument(String)
        /// A style/genre tag.
        case style(String)
    }

    private let kind: Kind

    public init(_ kind: Kind) {
        self.kind = kind
    }

    public var body: some View {
        HStack(spacing: LMMSpacing.xxs) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .bold))
            }
            Text(label)
                .font(LMMFont.eyebrow)
                .tracking(0.6)
                .textCase(.uppercase)
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, LMMSpacing.xs)
        .padding(.vertical, 5)
        .background(
            Capsule().fill(fill)
        )
        .overlay(
            Capsule().strokeBorder(stroke, lineWidth: 1)
        )
        .accessibilityLabel(accessibilityLabel)
    }

    private var label: String {
        switch kind {
        case .free: return String(localized: "badge.free", defaultValue: "Free", bundle: .module)
        case .locked: return String(localized: "badge.locked", defaultValue: "Locked", bundle: .module)
        case .enrolled: return String(localized: "badge.enrolled", defaultValue: "Enrolled", bundle: .module)
        case .instrument(let name), .style(let name): return name
        }
    }

    private var accessibilityLabel: String {
        switch kind {
        case .free, .locked, .enrolled: return label
        case .instrument(let name):
            return String(localized: "badge.instrument.a11y", defaultValue: "Instrument: \(name)", bundle: .module)
        case .style(let name):
            return String(localized: "badge.style.a11y", defaultValue: "Style: \(name)", bundle: .module)
        }
    }

    private var symbol: String? {
        switch kind {
        case .free: return nil
        case .locked: return "lock.fill"
        case .enrolled: return "checkmark"
        case .instrument: return "music.note"
        case .style: return nil
        }
    }

    private var foreground: Color {
        switch kind {
        case .free: return LMMColor.success
        case .locked: return LMMColor.mutedForeground
        case .enrolled: return LMMColor.primary
        case .instrument: return LMMColor.terracotta
        case .style: return LMMColor.mutedForeground
        }
    }

    private var fill: Color {
        switch kind {
        case .free: return LMMColor.success.opacity(0.12)
        case .locked: return LMMColor.secondary
        case .enrolled: return LMMColor.primary.opacity(0.12)
        case .instrument: return LMMColor.terracotta.opacity(0.12)
        case .style: return LMMColor.secondary
        }
    }

    private var stroke: Color {
        switch kind {
        case .free: return LMMColor.success.opacity(0.28)
        case .locked: return LMMColor.border
        case .enrolled: return LMMColor.primary.opacity(0.28)
        case .instrument: return LMMColor.terracotta.opacity(0.28)
        case .style: return LMMColor.border
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 12) {
        Badge(.free)
        Badge(.locked)
        Badge(.enrolled)
        Badge(.instrument("Bass"))
        Badge(.style("Bomba"))
    }
    .padding()
    .background(LMMColor.background)
}
