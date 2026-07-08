import SwiftUI

/// A section heading: the signature amber overline above a bold title, with an optional
/// trailing action. The overline (uppercase, wide-tracked) is the app's structural device —
/// it encodes what kind of section this is, not decoration.
public struct SectionHeader: View {
    private let eyebrow: String?
    private let title: String
    private let actionTitle: String?
    private let action: (() -> Void)?

    public init(
        eyebrow: String? = nil,
        title: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
                if let eyebrow {
                    Text(eyebrow).lmmEyebrow()
                }
                Text(title)
                    .font(LMMFont.title2)
                    .foregroundStyle(LMMColor.foreground)
            }
            Spacer(minLength: LMMSpacing.sm)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(LMMFont.subheadline.weight(.semibold))
                    .foregroundStyle(LMMColor.primary)
            }
        }
    }
}

#Preview {
    VStack(spacing: 32) {
        SectionHeader(eyebrow: "Continue", title: "Pick up where you left off")
        SectionHeader(title: "Browse courses", actionTitle: "See all") {}
    }
    .padding()
    .background(LMMColor.background)
}
