import CoreGraphics

/// The fill color used for staff lines, ledger lines, and glyphs — kept as a plain CoreGraphics
/// value type (not `UIColor`/`Color`) so NotationEngraving stays UIKit/SwiftUI-free;
/// `NotationUI` maps its light/dark label color to this.
public struct NotationColor: Equatable {
    public let red: CGFloat
    public let green: CGFloat
    public let blue: CGFloat
    public let alpha: CGFloat

    public init(red: CGFloat, green: CGFloat, blue: CGFloat, alpha: CGFloat = 1) {
        self.red = red
        self.green = green
        self.blue = blue
        self.alpha = alpha
    }

    public var cgColor: CGColor {
        CGColor(red: red, green: green, blue: blue, alpha: alpha)
    }

    /// Default notation ink for a light background — approximates the system `label` color.
    public static let lightDefault = NotationColor(red: 0.09, green: 0.09, blue: 0.11)

    /// Default notation ink for a dark background — approximates the system `label` color in
    /// dark mode.
    public static let darkDefault = NotationColor(red: 0.93, green: 0.93, blue: 0.95)
}
