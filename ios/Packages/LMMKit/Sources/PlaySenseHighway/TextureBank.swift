// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import SpriteKit
import UIKit

// Port of `components/play-sense/glass-highway/textures.ts`.
//
// One-time texture baking. Notes / droplets / chunks are `SKSpriteNode`s stamped from these textures
// (per-frame work is transform-only — no re-tessellation). The web bakes with Pixi's Graphics →
// `renderer.generateTexture`; here we bake a `UIImage` with `UIGraphicsImageRenderer` (the same CG
// pipeline the design system already uses) and wrap it as an `SKTexture`. Color variants are baked
// lazily per lane color and cached.

/// Canonical pill bake size — sprites scale down from here.
private let pillW: CGFloat = 128
private let pillH: CGFloat = 44
private let pillR: CGFloat = pillH / 2

public final class TextureBank {
    private var pills: [UInt32: SKTexture] = [:]
    private var softPills: [UInt32: SKTexture] = [:]
    private var chunks: [SKTexture] = []
    private var _trail: SKTexture?
    private var _droplet: SKTexture?
    private var _mist: SKTexture?
    private var _flash: SKTexture?
    private var _glowDot: SKTexture?
    private var _missPill: SKTexture?

    private let format: UIGraphicsImageRendererFormat

    public init() {
        let format = UIGraphicsImageRendererFormat.preferred()
        format.scale = 2 // matches the web's `resolution: 2`
        format.opaque = false
        self.format = format
    }

    private func bakeImage(width: CGFloat, height: CGFloat, _ draw: (CGContext) -> Void) -> UIImage {
        let size = CGSize(width: width, height: height)
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            draw(ctx.cgContext)
        }
    }

    private func bake(width: CGFloat, height: CGFloat, _ draw: (CGContext) -> Void) -> SKTexture {
        let texture = SKTexture(image: bakeImage(width: width, height: height, draw))
        texture.filteringMode = .linear
        return texture
    }

    private func fillRoundRect(_ ctx: CGContext, _ rect: CGRect, radius: CGFloat, color: UIColor) {
        let path = UIBezierPath(roundedRect: rect, cornerRadius: max(0, radius)).cgPath
        ctx.addPath(path)
        ctx.setFillColor(color.cgColor)
        ctx.fillPath()
    }

    private func strokeRoundRect(_ ctx: CGContext, _ rect: CGRect, radius: CGFloat, color: UIColor, width: CGFloat) {
        let path = UIBezierPath(roundedRect: rect, cornerRadius: max(0, radius)).cgPath
        ctx.addPath(path)
        ctx.setStrokeColor(color.cgColor)
        ctx.setLineWidth(width)
        ctx.strokePath()
    }

    // swiftlint:disable:next function_parameter_count
    private func fillEllipse(_ ctx: CGContext, cx: CGFloat, cy: CGFloat, rx: CGFloat, ry: CGFloat, color: UIColor) {
        ctx.setFillColor(color.cgColor)
        ctx.fillEllipse(in: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
    }

    // MARK: - Notes

    /// Luminous pill: cream-hot top fading to the lane color, dark base, bright rim, soft glow halo.
    public func pill(_ color: UInt32) -> SKTexture {
        if let cached = pills[color] { return cached }
        let tex = bake(width: pillW + 36, height: pillH + 36) { ctx in self.drawPill(ctx, color: color) }
        pills[color] = tex
        return tex
    }

    /// The pill's baked `UIImage` for one lane color — used by the GlassStyle/TextureBank snapshot test.
    public func pillImage(_ color: UInt32) -> UIImage {
        bakeImage(width: pillW + 36, height: pillH + 36) { ctx in self.drawPill(ctx, color: color) }
    }

    private func drawPill(_ ctx: CGContext, color: UInt32) {
        let pad: CGFloat = 18
        // Outer glow halo — expanding fills, decreasing alpha.
        for i in 0..<4 {
            let f = CGFloat(i)
            let rect = CGRect(x: pad - f * 4, y: pad - f * 4, width: pillW + f * 8, height: pillH + f * 8)
            fillRoundRect(ctx, rect, radius: pillR + f * 4,
                          color: highwayColor(color, alpha: 0.07 - CGFloat(i) * 0.014))
        }
        // Body base (darkened lane color).
        let body = CGRect(x: pad, y: pad, width: pillW, height: pillH)
        fillRoundRect(ctx, body, radius: pillR, color: highwayColor(darkenHex(color, 0.35)))
        // Vertical gradient: stacked top-anchored rounded layers, hotter toward the top.
        let layers = 6
        for i in 0..<layers {
            let t = Double(i) / Double(layers - 1)
            let h = pillH * CGFloat(0.9 - t * 0.62)
            let c = mixHex(color, HighwayPalette.noteHotTop, t * 0.85)
            fillRoundRect(ctx, CGRect(x: pad, y: pad, width: pillW, height: h),
                          radius: min(pillR, h / 2), color: highwayColor(c, alpha: 0.38))
        }
        // Hot core sheen near the top.
        fillRoundRect(ctx,
                      CGRect(x: pad + pillW * 0.12, y: pad + pillH * 0.1, width: pillW * 0.76, height: pillH * 0.3),
                      radius: pillH * 0.15, color: UIColor(white: 1, alpha: 0.5))
        // Bright rim.
        strokeRoundRect(ctx, body, radius: pillR, color: highwayColor(HighwayPalette.noteHotTop, alpha: 0.9), width: 2)
    }

    /// Pre-softened pill for reflections / sunk misses.
    public func softPill(_ color: UInt32) -> SKTexture {
        if let cached = softPills[color] { return cached }
        let pad: CGFloat = 14
        let maxSpread: CGFloat = 4 * 5
        let tex = bake(width: pillW + (pad + maxSpread) * 2, height: pillH + (pad + maxSpread) * 2) { ctx in
            let origin = maxSpread // shift so negative spreads stay in bounds
            for i in 0..<5 {
                let spread = CGFloat(i) * 5
                let rect = CGRect(x: origin + pad - spread, y: origin + pad - spread,
                                  width: pillW + spread * 2, height: pillH + spread * 2)
                self.fillRoundRect(ctx, rect, radius: pillR + spread,
                                   color: highwayColor(color, alpha: 0.22 - CGFloat(i) * 0.04))
            }
            self.fillRoundRect(ctx, CGRect(x: origin + pad + pillW * 0.15, y: origin + pad + pillH * 0.2,
                                           width: pillW * 0.7, height: pillH * 0.45),
                               radius: pillH * 0.22, color: highwayColor(HighwayPalette.noteHotTop, alpha: 0.25))
        }
        softPills[color] = tex
        return tex
    }

    /// Red miss pill (single bake, tint-free).
    public func missPill() -> SKTexture {
        if let tex = _missPill { return tex }
        let pad: CGFloat = 18
        let missRed = HighwayPalette.missRed
        let tex = bake(width: pillW + pad * 2, height: pillH + pad * 2) { ctx in
            for i in 0..<4 {
                let f = CGFloat(i)
                let rect = CGRect(x: pad - f * 4, y: pad - f * 4, width: pillW + f * 8, height: pillH + f * 8)
                self.fillRoundRect(ctx, rect, radius: pillR + f * 4,
                                   color: highwayColor(missRed, alpha: 0.09 - CGFloat(i) * 0.018))
            }
            let body = CGRect(x: pad, y: pad, width: pillW, height: pillH)
            self.fillRoundRect(ctx, body, radius: pillR, color: highwayColor(darkenHex(missRed, 0.4)))
            for i in 0..<6 {
                let t = Double(i) / 5
                let h = pillH * CGFloat(0.9 - t * 0.62)
                self.fillRoundRect(ctx, CGRect(x: pad, y: pad, width: pillW, height: h),
                                   radius: min(pillR, h / 2),
                                   color: highwayColor(mixHex(missRed, HighwayPalette.missRedHi, t * 0.8), alpha: 0.38))
            }
            self.strokeRoundRect(ctx, body, radius: pillR,
                                 color: highwayColor(HighwayPalette.missRedHi, alpha: 0.9), width: 2)
        }
        _missPill = tex
        return tex
    }

    /// White vertical trail strip (transparent top → bright bottom). Tint per lane via `color(.multiply)`.
    public func trail() -> SKTexture {
        if let tex = _trail { return tex }
        let width: CGFloat = 24, height: CGFloat = 160
        let steps = 32
        let tex = bake(width: width, height: height) { ctx in
            for i in 0..<steps {
                let t = CGFloat(i) / CGFloat(steps - 1)
                let w = width * (0.3 + t * 0.4)
                self.fillRoundRect(ctx, CGRect(x: (width - w) / 2, y: (height / CGFloat(steps)) * CGFloat(i),
                                               width: w, height: height / CGFloat(steps) + 1.5),
                                   radius: 0, color: UIColor(white: 1, alpha: t * t * 0.5))
            }
        }
        _trail = tex
        return tex
    }

    /// Soft white droplet — tint per lane color.
    public func droplet() -> SKTexture {
        if let tex = _droplet { return tex }
        let tex = bake(width: 24, height: 24) { ctx in
            self.fillEllipse(ctx, cx: 12, cy: 12, rx: 11, ry: 11, color: UIColor(white: 1, alpha: 0.18))
            self.fillEllipse(ctx, cx: 12, cy: 12, rx: 7, ry: 7, color: UIColor(white: 1, alpha: 0.5))
            self.fillEllipse(ctx, cx: 12, cy: 12, rx: 4, ry: 4, color: UIColor(white: 1, alpha: 1))
        }
        _droplet = tex
        return tex
    }

    /// Soft round mist puff.
    public func mist() -> SKTexture {
        if let tex = _mist { return tex }
        let r: CGFloat = 40
        let tex = bake(width: r * 2, height: r * 2) { ctx in
            for i in 0..<5 {
                self.fillEllipse(ctx, cx: r, cy: r, rx: r - CGFloat(i) * 7, ry: r - CGFloat(i) * 7,
                                 color: UIColor(white: 1, alpha: 0.05 + CGFloat(i) * 0.02))
            }
        }
        _mist = tex
        return tex
    }

    /// Horizontal hot flash ellipse.
    public func flash() -> SKTexture {
        if let tex = _flash { return tex }
        let width: CGFloat = 140, height: CGFloat = 44
        let tex = bake(width: width, height: height) { ctx in
            for i in 0..<5 {
                let t = CGFloat(i) / 4
                self.fillEllipse(ctx, cx: width / 2, cy: height / 2,
                                 rx: (width / 2) * (1 - t * 0.7), ry: (height / 2) * (1 - t * 0.65),
                                 color: UIColor(white: 1, alpha: 0.12 + t * 0.2))
            }
        }
        _flash = tex
        return tex
    }

    /// Generic soft radial glow dot (ripple glow, red seep, pad flash).
    public func glowDot() -> SKTexture {
        if let tex = _glowDot { return tex }
        let r: CGFloat = 48
        let tex = bake(width: r * 2, height: r * 2) { ctx in
            for i in 0..<6 {
                self.fillEllipse(ctx, cx: r, cy: r, rx: r - CGFloat(i) * 7.5, ry: r - CGFloat(i) * 7.5,
                                 color: UIColor(white: 1, alpha: 0.04 + CGFloat(i) * 0.035))
            }
        }
        _glowDot = tex
        return tex
    }

    /// Three irregular fragment shapes — tint per lane color.
    public func chunk(_ index: Int) -> SKTexture {
        if chunks.isEmpty {
            let polys: [[CGPoint]] = [
                [(0, 6), (10, 0), (22, 4), (18, 14), (6, 16)].map { CGPoint(x: $0.0, y: $0.1) },
                [(0, 0), (14, 2), (16, 12), (4, 10)].map { CGPoint(x: $0.0, y: $0.1) },
                [(2, 8), (8, 0), (14, 6), (10, 14)].map { CGPoint(x: $0.0, y: $0.1) }
            ]
            chunks = polys.map { pts in
                bake(width: 24, height: 18) { ctx in
                    let path = CGMutablePath()
                    path.addLines(between: pts)
                    path.closeSubpath()
                    ctx.addPath(path)
                    ctx.setFillColor(UIColor.white.cgColor)
                    ctx.fillPath()
                }
            }
        }
        return chunks[index % chunks.count]
    }
}

// swiftlint:enable identifier_name
