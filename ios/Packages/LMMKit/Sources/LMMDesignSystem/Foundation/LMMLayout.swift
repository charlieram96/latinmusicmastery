import SwiftUI

// Short, conventional design-token names (xs/sm/md/lg/xl) read better than padded ones.
// swiftlint:disable identifier_name

/// Spacing scale. The web works in a 4px rhythm with named section/card/element steps
/// (`--spacing-section` 2rem, `--spacing-card` 1.5rem, `--spacing-element` 1rem); this
/// mirrors that rhythm for SwiftUI.
public enum LMMSpacing {
    /// 4pt — tight inner gaps.
    public static let xxs: CGFloat = 4
    /// 8pt — chip padding, small gaps.
    public static let xs: CGFloat = 8
    /// 12pt — compact stacks.
    public static let sm: CGFloat = 12
    /// 16pt — element rhythm (`--spacing-element`).
    public static let md: CGFloat = 16
    /// 24pt — card rhythm (`--spacing-card`).
    public static let lg: CGFloat = 24
    /// 32pt — section rhythm (`--spacing-section`).
    public static let xl: CGFloat = 32
    /// 48pt — major separations.
    public static let xxl: CGFloat = 48

    /// Default screen horizontal inset.
    public static let screen: CGFloat = 20
}

/// Corner-radius scale, anchored on the web's `--radius` (0.5rem = 8pt) and the studio
/// card radii (12–14pt).
public enum LMMRadius {
    /// 8pt — the base `--radius`; small controls and chips.
    public static let sm: CGFloat = 8
    /// 12pt — cards and inspector panels (`.st-icard`).
    public static let md: CGFloat = 12
    /// 16pt — hero surfaces and large cards.
    public static let lg: CGFloat = 16
    /// 20pt — sheets and prominent containers.
    public static let xl: CGFloat = 20
    /// Fully rounded (pills, avatars).
    public static let pill: CGFloat = 999
}

// swiftlint:enable identifier_name
