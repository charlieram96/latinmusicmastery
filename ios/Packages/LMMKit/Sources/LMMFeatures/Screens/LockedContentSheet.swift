import LMMDesignSystem
import SwiftUI

/// The reusable locked-content message (icon, title, subscription-management copy). Reader-app
/// compliant: it states where subscriptions are managed and offers no purchase affordance, link,
/// or price. Rendered inline by the class viewer and inside ``LockedContentSheet``.
struct LockedContentBody: View {
    /// The course/subscription name to name in the copy; `nil` uses generic phrasing.
    let courseName: String?

    var body: some View {
        VStack(spacing: LMMSpacing.sm) {
            Image(systemName: "lock.fill")
                .font(.system(size: 34))
                .foregroundStyle(LMMColor.primary)

            Text(lmmString("locked.title"))
                .font(LMMFont.title2)
                .foregroundStyle(LMMColor.foreground)
                .multilineTextAlignment(.center)
            Text(message)
                .font(LMMFont.callout)
                .foregroundStyle(LMMColor.mutedForeground)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, LMMSpacing.md)
    }

    private var message: String {
        if let courseName, !courseName.isEmpty {
            return lmmFormat("locked.message", courseName)
        }
        return lmmString("locked.message.generic")
    }
}

/// Shown when a signed-in user taps a class they don't have access to.
struct LockedContentSheet: View {
    let courseName: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: LMMSpacing.lg) {
            Capsule()
                .fill(LMMColor.border)
                .frame(width: 40, height: 5)
                .padding(.top, LMMSpacing.sm)

            Spacer(minLength: 0)

            LockedContentBody(courseName: courseName)

            Spacer(minLength: 0)

            Button(lmmString("locked.dismiss")) { dismiss() }
                .buttonStyle(.lmmPrimary)
        }
        .padding(LMMSpacing.lg)
        .frame(maxWidth: .infinity)
        .background(LMMColor.background)
        .presentationDetents([.height(360)])
        .presentationDragIndicator(.hidden)
    }
}
