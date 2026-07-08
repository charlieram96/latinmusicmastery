import SwiftUI

/// A centered loading state with an optional caption.
public struct LoadingView: View {
    private let message: String?

    public init(message: String? = nil) {
        self.message = message
    }

    public var body: some View {
        VStack(spacing: LMMSpacing.sm) {
            ProgressView()
                .controlSize(.large)
                .tint(LMMColor.primary)
            if let message {
                Text(message)
                    .font(LMMFont.subheadline)
                    .foregroundStyle(LMMColor.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// An error state that explains what went wrong and offers one clear recovery action.
/// Copy is passed in so the app layer localizes it.
public struct ErrorView: View {
    private let title: String
    private let message: String
    private let retryTitle: String
    private let retry: () -> Void

    public init(title: String, message: String, retryTitle: String, retry: @escaping () -> Void) {
        self.title = title
        self.message = message
        self.retryTitle = retryTitle
        self.retry = retry
    }

    public var body: some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 32))
                .foregroundStyle(LMMColor.terracotta)
            VStack(spacing: LMMSpacing.xxs) {
                Text(title)
                    .font(LMMFont.title2)
                    .foregroundStyle(LMMColor.foreground)
                Text(message)
                    .font(LMMFont.subheadline)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .multilineTextAlignment(.center)
            }
            Button(retryTitle, action: retry)
                .buttonStyle(.lmmSecondary)
                .fixedSize()
        }
        .padding(LMMSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// An empty state — an invitation to act, not an apology. `systemImage`, copy, and an
/// optional action are supplied by the caller.
public struct EmptyStateView: View {
    private let systemImage: String
    private let title: String
    private let message: String
    private let actionTitle: String?
    private let action: (() -> Void)?

    public init(
        systemImage: String,
        title: String,
        message: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.systemImage = systemImage
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 34))
                .foregroundStyle(LMMColor.primary)
            VStack(spacing: LMMSpacing.xxs) {
                Text(title)
                    .font(LMMFont.title2)
                    .foregroundStyle(LMMColor.foreground)
                Text(message)
                    .font(LMMFont.subheadline)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .multilineTextAlignment(.center)
            }
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.lmmSecondary)
                    .fixedSize()
            }
        }
        .padding(LMMSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
