import SwiftUI

/// The primary call to action — the warm amber → terracotta gradient from the web's
/// `.st-play-btn`. Reserve it for the single most important action on a screen.
public struct LMMPrimaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(LMMFont.headline)
            .foregroundStyle(LMMColor.onPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                    .fill(LMMColor.warmGradient)
            )
            .opacity(configuration.isPressed ? 0.88 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// The secondary action — a quiet outlined control on the card surface.
public struct LMMSecondaryButtonStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(LMMFont.headline)
            .foregroundStyle(LMMColor.foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                    .fill(LMMColor.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                    .strokeBorder(LMMColor.borderStrong, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.7 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

public extension ButtonStyle where Self == LMMPrimaryButtonStyle {
    static var lmmPrimary: LMMPrimaryButtonStyle { LMMPrimaryButtonStyle() }
}

public extension ButtonStyle where Self == LMMSecondaryButtonStyle {
    static var lmmSecondary: LMMSecondaryButtonStyle { LMMSecondaryButtonStyle() }
}

#Preview {
    VStack(spacing: 16) {
        Button("Continue learning") {}
            .buttonStyle(.lmmPrimary)
        Button("Browse courses") {}
            .buttonStyle(.lmmSecondary)
    }
    .padding()
    .background(LMMColor.background)
}
