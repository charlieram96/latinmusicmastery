import SwiftUI

/// The Latin Music Mastery color system, ported 1:1 from the web app's design tokens
/// (`app/globals.css`, `tailwind.config.js`). Every value is expressed in the same HSL
/// numbers the web uses so the two clients stay visually in lockstep; the `hsl` helper
/// converts to sRGB and `dynamic` resolves light/dark at render time.
///
/// The web calls the light theme a "warm off-white" studio and the dark theme a
/// "Spotify × MasterClass cinematic" surface — this enum carries both.
public enum LMMColor {
    // MARK: Surfaces

    /// App background. Web: `--background` 30 25% 98% (light) / 0 0% 4% (dark).
    public static let background = dynamic(light: hsl(30, 0.25, 0.98), dark: hsl(0, 0, 0.04))
    /// Card / raised panel. Web: `--card` 30 20% 99% / 0 0% 8%.
    public static let surface = dynamic(light: hsl(30, 0.20, 0.99), dark: hsl(0, 0, 0.08))
    /// Sunken well behind content. Web: `--surface-sunken` 30 22% 96.5% / 0 0% 5%.
    public static let surfaceSunken = dynamic(light: hsl(30, 0.22, 0.965), dark: hsl(0, 0, 0.05))
    /// Elevated surface. Web: `--surface-raised` 30 20% 99% / 0 0% 9%.
    public static let surfaceRaised = dynamic(light: hsl(30, 0.20, 0.99), dark: hsl(0, 0, 0.09))
    /// Warm textured studio surface. Web: `--warm-surface` 30 20% 96% / 16 14% 8%.
    public static let warmSurface = dynamic(light: hsl(30, 0.20, 0.96), dark: hsl(16, 0.14, 0.08))
    /// Secondary / muted fill (chips, inert controls). Web: `--secondary` 30 15% 94% / 0 0% 11%.
    public static let secondary = dynamic(light: hsl(30, 0.15, 0.94), dark: hsl(0, 0, 0.11))

    // MARK: Content

    /// Primary text. Web: `--foreground` 20 10% 15% / 0 0% 93%.
    public static let foreground = dynamic(light: hsl(20, 0.10, 0.15), dark: hsl(0, 0, 0.93))
    /// Secondary text. Web: `--muted-foreground` 20 8% 42% / 0 0% 55%.
    public static let mutedForeground = dynamic(light: hsl(20, 0.08, 0.42), dark: hsl(0, 0, 0.55))

    // MARK: Brand

    /// The brand amber — primary accent. Web: `--primary` 30 85% 55% (both themes).
    public static let primary = dynamic(light: hsl(30, 0.85, 0.55), dark: hsl(30, 0.85, 0.55))
    /// Text/icon on top of `primary`. Web: `--primary-foreground` 0 0% 98%.
    public static let onPrimary = dynamic(light: hsl(0, 0, 0.98), dark: hsl(0, 0, 0.98))
    /// Warm clay accent. Web: `--terracotta` 14 52% 48% / 14 52% 53%.
    public static let terracotta = dynamic(light: hsl(14, 0.52, 0.48), dark: hsl(14, 0.52, 0.53))
    /// Gold highlight. Web: `--gold-highlight` 38 58% 50% / 38 58% 58%.
    public static let gold = dynamic(light: hsl(38, 0.58, 0.50), dark: hsl(38, 0.58, 0.58))

    // MARK: Status

    /// Completion / positive. Web: `--success` 145 55% 38% / 145 50% 45%.
    public static let success = dynamic(light: hsl(145, 0.55, 0.38), dark: hsl(145, 0.50, 0.45))
    /// Error / destructive. Web: `--destructive` 0 84.2% 60.2% (both).
    public static let destructive = dynamic(light: hsl(0, 0.842, 0.602), dark: hsl(0, 0.842, 0.602))

    // MARK: Lines

    /// Hairline border. Web: `--border` 30 10% 88% / white @ 6%.
    public static let border = dynamic(light: hsl(30, 0.10, 0.88), dark: white(0.06))
    /// Slightly stronger separator for interactive edges.
    public static let borderStrong = dynamic(light: hsl(30, 0.10, 0.80), dark: white(0.12))

    // MARK: Gradients

    /// The signature warm gradient (amber → terracotta), ported from the web's
    /// `marketing-gradient-warm` / `.st-play-btn`. Reserved for the primary CTA,
    /// thumbnail placeholders, and progress fills.
    public static let warmGradient = LinearGradient(
        colors: [dynamic(light: hsl(30, 0.85, 0.55), dark: hsl(30, 0.85, 0.55)),
                 dynamic(light: hsl(14, 0.52, 0.48), dark: hsl(14, 0.52, 0.53))],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Amber → gold, used on progress rings/bars.
    public static let amberGradient = LinearGradient(
        colors: [dynamic(light: hsl(30, 0.85, 0.55), dark: hsl(30, 0.85, 0.55)),
                 dynamic(light: hsl(38, 0.58, 0.50), dark: hsl(38, 0.58, 0.58))],
        startPoint: .leading,
        endPoint: .trailing
    )
}

// MARK: - HSL → Color plumbing

// The HSL→RGB math reads most clearly with the standard single-letter component names
// (h/s/l, m, chroma channels) used in the reference algorithm.
// swiftlint:disable identifier_name large_tuple

extension LMMColor {
    /// Builds a `Color` from HSL, matching the web's `hsl(H S% L%)` token convention.
    /// - Parameters:
    ///   - h: hue in degrees, 0...360
    ///   - s: saturation, 0...1
    ///   - l: lightness, 0...1
    ///   - alpha: opacity, 0...1
    static func hsl(_ h: Double, _ s: Double, _ l: Double, alpha: Double = 1) -> UIColor {
        let chroma = (1 - abs(2 * l - 1)) * s
        let hp = h / 60
        let second = chroma * (1 - abs(hp.truncatingRemainder(dividingBy: 2) - 1))
        let (r1, g1, b1): (Double, Double, Double)
        switch hp {
        case 0..<1: (r1, g1, b1) = (chroma, second, 0)
        case 1..<2: (r1, g1, b1) = (second, chroma, 0)
        case 2..<3: (r1, g1, b1) = (0, chroma, second)
        case 3..<4: (r1, g1, b1) = (0, second, chroma)
        case 4..<5: (r1, g1, b1) = (second, 0, chroma)
        default: (r1, g1, b1) = (chroma, 0, second)
        }
        let m = l - chroma / 2
        return UIColor(red: r1 + m, green: g1 + m, blue: b1 + m, alpha: alpha)
    }

    /// Semi-transparent white — the dark theme expresses borders as white-at-alpha.
    static func white(_ alpha: Double) -> UIColor {
        UIColor(white: 1, alpha: alpha)
    }

    /// Resolves to `light` or `dark` based on the active interface style.
    static func dynamic(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }
}

// swiftlint:enable identifier_name large_tuple
