// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import CoreGraphics
import UIKit

// Port of `components/play-sense/glass-highway/style.ts` + `constants.ts`.
//
// Every tunable visual constant for the Obsidian Glass highway lives in ``GlassStyle``; the color
// constants below are ported verbatim from the web's `constants.ts`. Those hexes were tuned in the
// web `/highway-lab` and are already the warm A5 brand palette — amber `0xf2a12c` ≈ A5 `--primary`
// (hsl 30 85% 55%), terracotta `0xc9543c`/`0xb5683b` ≈ A5 `--terracotta`, gold `0xe2b23a` ≈ A5
// `--gold-highlight`, deep red `0xcb3145` ≈ A5 `--destructive`. Keeping the lab-tuned hexes verbatim
// (rather than re-deriving from `LMMColor`) preserves the exact look the user locked in; the values
// sit inside the same brand ramp, so this is an alignment, not a divergence. Documented adaptation.

/// A ported hex color. `SKColor` is `UIColor` on iOS.
public func highwayColor(_ hex: UInt32, alpha: CGFloat = 1) -> UIColor {
    UIColor(
        red: CGFloat((hex >> 16) & 0xFF) / 255,
        green: CGFloat((hex >> 8) & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255,
        alpha: alpha
    )
}

/// Linear blend of two packed RGB hex colors (port of the web's `mix`/`mixColor`).
public func mixHex(_ a: UInt32, _ b: UInt32, _ t: Double) -> UInt32 {
    let ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF
    let br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF
    let r = UInt32((Double(ar) + (Double(br) - Double(ar)) * t).rounded())
    let g = UInt32((Double(ag) + (Double(bg) - Double(ag)) * t).rounded())
    let bl = UInt32((Double(ab) + (Double(bb) - Double(ab)) * t).rounded())
    return (r << 16) | (g << 8) | bl
}

/// Darken a hex toward black (port of `darken`).
public func darkenHex(_ color: UInt32, _ t: Double) -> UInt32 { mixHex(color, 0x000000, t) }

// MARK: - Palette (port of constants.ts)

public enum HighwayPalette {
    // Stage
    public static let bgTop: UInt32 = 0x1A1410
    public static let bgMid: UInt32 = 0x0B0908
    public static let bgBottom: UInt32 = 0x060505
    public static let bgGlow: UInt32 = 0xED8A2C

    // Hit line / glass
    public static let hitLineCore: UInt32 = 0xFFF6E6
    public static let hitLineSoft: UInt32 = 0xFFE8BF
    public static let hitLineBloom: UInt32 = 0xED8A2C
    public static let glassSheen: UInt32 = 0xFFE8BF
    public static let glassEdge: UInt32 = 0xFFF6E6

    // Notes
    public static let noteHotTop: UInt32 = 0xFFF1D6
    public static let missRed: UInt32 = 0xCB3145
    public static let missRedHi: UInt32 = 0xFF9C8E

    // Lane colors (warm brand palette)
    public static let laneColors: [String: UInt32] = [
        // Conga
        "quinto": 0xD54E3F, "conga": 0xF2A12C, "tumba": 0xE0A43B,
        // Timbale
        "macho": 0xD54E3F, "hembra": 0xF2A12C, "campana": 0xE2B23A,
        "cencerro": 0xE8771C, "jamblock": 0xC84A5A, "cascara": 0xB5683B,
        // Fallback technique lanes
        "open": 0xF2A12C, "slap": 0xD54E3F, "mute": 0xC84A5A, "bass": 0xE0A43B,
        "touch": 0xE8771C, "rim": 0xE2B23A, "shell": 0xB5683B, "bell": 0xE2B23A,
        "tip": 0xF2A12C, "heel": 0xC84A5A
    ]

    public static let defaultLaneColor: UInt32 = 0xF2A12C

    public static let melodicLaneColors: [UInt32] = [
        0xF2A12C, 0xE0A43B, 0xE8771C, 0xD54E3F, 0xCB3145, 0xB5683B, 0xE2B23A, 0xC84A5A
    ]

    public static let pianoWhiteNoteColor: UInt32 = 0xF2A12C
    public static let pianoBlackNoteColor: UInt32 = 0xD5634F

    // Grades
    public static let gradeColors: [HitGradeKind: UInt32] = [
        .perfect: 0xFFF6E6, .good: 0xF2A12C, .ok: 0xC9543C, .miss: 0xCB3145
    ]

    public static let gradeLabels: [HitGradeKind: String] = [
        .perfect: "PERFECT", .good: "GOOD", .ok: "OK", .miss: "MISS"
    ]

    // Open-string labels for fretted instruments (low → high)
    public static let violinOpenStrings = ["G", "D", "A", "E"]
    public static let guitarOpenStrings = ["E", "A", "D", "G", "B", "E"]
}

/// A grade kind decoupled from `PlaySenseCore.HitGrade` so this module's palette/type surface is
/// self-contained; the bridge maps `HitGrade` → this.
public enum HitGradeKind: String, Hashable, Sendable, CaseIterable {
    case perfect, good, ok, miss
}

// MARK: - GlassStyle (port of style.ts)

/// Every tunable visual constant for the highway. Values are the ones tuned in `/highway-lab` and
/// locked in by the user (June 2026), ported verbatim from `DEFAULT_GLASS_STYLE`.
public struct GlassStyle: Sendable {
    /// Seconds a note takes to travel from the top edge to the hit line.
    public var approachSec: Double = 1.7
    /// Hit line position as a fraction of stage height (0..1).
    public var hitLineFraction: Double = 0.8

    // Lanes / scene
    public var laneLineAlpha: Double = 0.64
    public var hitLineGlowAlpha: Double = 0.66
    public var hitLineShimmerSpeed: Double = 3.2
    public var glassSheenAlpha: Double = 0.1
    public var glareSpeed: Double = 7
    public var glareAlpha: Double = 0.09
    public var dustCount: Double = 14
    public var dustAlpha: Double = 0.45
    public var bgGlowAlpha: Double = 0.12

    // Notes
    public var noteAspect: Double = 0.36
    public var noteGlowAlpha: Double = 0.7
    public var trailLength: Double = 7
    public var trailAlpha: Double = 0.5
    public var reflectionAlpha: Double = 0.22
    public var reflectionFalloff: Double = 0.45

    // Perfect splash
    public var splashDropletCount: Double = 22
    public var splashSpeed: Double = 560
    public var splashGravity: Double = 1800
    public var flashAlpha: Double = 0.64
    public var mistAlpha: Double = 0.39

    // Good crack
    public var chunkCount: Double = 8
    public var chunkSpeed: Double = 230

    // Miss
    public var missShakeAmp: Double = 4.5
    public var missShakeFreq: Double = 21
    public var missSinkAlpha: Double = 0.34
    public var rippleAlpha: Double = 0.53
    public var redGlowAlpha: Double = 0.37

    // Receptors
    public var padFillAlpha: Double = 0.1
    public var padStrokeAlpha: Double = 0.08
    public var padFlashAlpha: Double = 0.6
    public var keyLightAlpha: Double = 0.75

    public init() {}
}

// swiftlint:enable identifier_name
