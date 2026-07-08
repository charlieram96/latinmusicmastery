import SwiftUI

/// Typography for Latin Music Mastery. The web pairs Montserrat (a confident geometric
/// display face) for headings with Inter for body. We don't bundle web fonts here; instead
/// we echo that feel with the system face at heavy display weights, and carry the studio's
/// signature uppercase, wide-tracked overline (ported from the web's `.st-sec-label`,
/// letter-spacing 0.14em) as the app's structural device.
///
/// Every face is built on a Dynamic Type text style so the app scales with the user's
/// accessibility settings.
public enum LMMFont {
    /// Screen-defining display headline (greetings, hero titles).
    public static let display = Font.system(.largeTitle, design: .default).weight(.heavy)
    /// Section / hero title.
    public static let title = Font.system(.title, design: .default).weight(.bold)
    /// Card and row titles.
    public static let title2 = Font.system(.title2, design: .default).weight(.bold)
    /// Emphasis within content.
    public static let headline = Font.system(.headline, design: .default).weight(.semibold)
    /// Default running text.
    public static let body = Font.system(.body, design: .default)
    /// Supporting text.
    public static let callout = Font.system(.callout, design: .default)
    /// Secondary metadata.
    public static let subheadline = Font.system(.subheadline, design: .default)
    /// Chips, captions, counts.
    public static let caption = Font.system(.caption, design: .default).weight(.medium)
    /// The uppercase, wide-tracked overline — the app's signature label.
    public static let eyebrow = Font.system(.caption2, design: .default).weight(.bold)
}

public extension View {
    /// The studio overline: uppercase, wide-tracked, amber. Ported from the web's
    /// `.st-sec-label`. Use it above section titles and as content eyebrows.
    func lmmEyebrow(color: Color = LMMColor.primary) -> some View {
        self
            .font(LMMFont.eyebrow)
            .tracking(1.4)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}
