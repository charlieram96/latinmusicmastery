// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import SpriteKit
import UIKit

// Port of `components/play-sense/glass-highway/Scene.ts`.
//
// Static + ambient visuals: warm void background, hairline lanes, the hit line with shimmer, the
// glass table band with a slow moving glare, and drifting dust. The web redraws Pixi Graphics on
// resize and modulates a handful of objects per frame. Here the static strata (background gradient,
// warm halo, side vignettes, lane hairlines, glass sheen band) are baked into textures on resize;
// only the hit-line shimmer, the moving glare, and the dust are touched per frame.
//
// Coordinate convention (whole module): the host scene sets `anchorPoint = (0, 1)`, so web-space y
// (0 = top, grows downward) maps to scene y = `-y`. Baked full-screen sprites are centered and read
// upright; point nodes are positioned at `(x, -y)`.

private struct DustMote {
    let node: SKSpriteNode
    var x: Double
    var y: Double
    var speed: Double
    var sway: Double
    var phase: Double
}

final class SceneBackground {
    /// Background + lane hairlines + dust (drawn under the reflections).
    let backgroundNode = SKNode()
    /// Glass band + glare + hit line (drawn above the reflections so they read as under the surface).
    let glassNode = SKNode()

    private let baseSprite = SKSpriteNode()
    private let glassSprite = SKSpriteNode()
    private let hitLineSprite = SKSpriteNode()
    private let glareSprite = SKSpriteNode()
    private let dustContainer = SKNode()
    private var dust: [DustMote] = []
    private var dustTexture: SKTexture?

    private var width: Double = 0
    private var height: Double = 0
    private var elapsed: Double = 0
    private var style: GlassStyle
    private var layout: LaneLayout?

    private let format: UIGraphicsImageRendererFormat

    var hitLineY: Double { height * style.hitLineFraction }

    init(style: GlassStyle) {
        self.style = style
        let format = UIGraphicsImageRendererFormat.preferred()
        format.scale = 2
        format.opaque = false
        self.format = format

        baseSprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        glassSprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        hitLineSprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        glareSprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        glareSprite.blendMode = .add

        backgroundNode.addChild(baseSprite)
        backgroundNode.addChild(dustContainer)
        glassNode.addChild(glassSprite)
        glassNode.addChild(glareSprite)
        glassNode.addChild(hitLineSprite)
    }

    func setStyle(_ style: GlassStyle) { self.style = style; redraw() }
    func setLayout(_ layout: LaneLayout) { self.layout = layout; redraw() }

    func resize(width: Double, height: Double) {
        self.width = width
        self.height = height
        redraw()
    }

    private func redraw() {
        guard width > 0, height > 0 else { return }
        let hitY = hitLineY

        baseSprite.texture = bakeBase()
        baseSprite.size = CGSize(width: width, height: height)
        baseSprite.position = CGPoint(x: width / 2, y: -height / 2)

        let bandH = height - hitY
        glassSprite.texture = bakeGlass(hitY: hitY, bandH: bandH)
        glassSprite.size = CGSize(width: width, height: bandH)
        glassSprite.position = CGPoint(x: width / 2, y: -(hitY + bandH / 2))

        hitLineSprite.texture = bakeHitLine(hitY: hitY)
        hitLineSprite.size = CGSize(width: width, height: 20)
        hitLineSprite.position = CGPoint(x: width / 2, y: -hitY)

        glareSprite.texture = bakeGlare(bandH: bandH)
        glareSprite.size = CGSize(width: width * 0.18, height: bandH)
        glareSprite.position = CGPoint(x: 0, y: -(hitY + bandH / 2))

        buildDust()
    }

    // MARK: - Per-frame

    func update(_ dt: Double) {
        elapsed += dt
        let t = elapsed

        // Hit line shimmer — gentle brightness breathing.
        let shimmer = 0.85 + 0.15 * sin(t * style.hitLineShimmerSpeed)
        hitLineSprite.alpha = 0.9 + 0.1 * shimmer

        // Moving diagonal glare across the glass band.
        let period = max(2, style.glareSpeed)
        let phase = t.truncatingRemainder(dividingBy: period) / period
        glareSprite.position.x = -width * 0.4 + phase * width * 1.6
        glareSprite.alpha = style.glareAlpha

        // Dust drifts upward with a slow sway.
        for i in dust.indices {
            dust[i].y -= dust[i].speed * dt
            dust[i].phase += dt
            if dust[i].y < -8 {
                dust[i].y = height + 8
                dust[i].x = Double.random(in: 0...max(1, width))
            }
            let node = dust[i].node
            node.position = CGPoint(x: dust[i].x + sin(dust[i].phase * 0.7) * dust[i].sway, y: -dust[i].y)
            let edge = min(dust[i].y / 80, (height - dust[i].y) / 80, 1)
            node.alpha = max(0, edge) * style.dustAlpha
        }
    }

    // MARK: - Baking

    private func bake(width w: Double, height h: Double, _ draw: (CGContext) -> Void) -> SKTexture {
        let image = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: format).image { ctx in
            draw(ctx.cgContext)
        }
        return SKTexture(image: image)
    }

    private func bakeBase() -> SKTexture {
        bake(width: width, height: height) { ctx in
            let w = self.width, h = self.height
            // Vertical gradient in stepped bands.
            let steps = 24
            for i in 0..<steps {
                let t = Double(i) / Double(steps - 1)
                let color = t < 0.55
                    ? mixHex(HighwayPalette.bgTop, HighwayPalette.bgMid, t / 0.55)
                    : mixHex(HighwayPalette.bgMid, HighwayPalette.bgBottom, (t - 0.55) / 0.45)
                ctx.setFillColor(highwayColor(color).cgColor)
                ctx.fill(CGRect(x: 0, y: (h / Double(steps)) * Double(i), width: w, height: h / Double(steps) + 1))
            }
            // Warm halo behind the top (fakes the radial glow).
            for i in 0..<5 {
                let f = Double(i)
                let rx = w * (0.75 - f * 0.1), ry = h * (0.42 - f * 0.05)
                ctx.setFillColor(highwayColor(HighwayPalette.bgGlow, alpha: self.style.bgGlowAlpha * 0.25).cgColor)
                ctx.fillEllipse(in: CGRect(x: w / 2 - rx, y: -h * 0.1 - ry, width: rx * 2, height: ry * 2))
            }
            // Side vignettes.
            ctx.setFillColor(UIColor(white: 0, alpha: 0.22).cgColor)
            ctx.fill(CGRect(x: 0, y: 0, width: w * 0.12, height: h))
            ctx.fill(CGRect(x: w * 0.88, y: 0, width: w * 0.12, height: h))

            // Lane hairlines, brightening toward the hit line.
            self.drawLanes(ctx)
        }
    }

    private func drawLanes(_ ctx: CGContext) {
        guard let layout else { return }
        let a = style.laneLineAlpha
        let hitY = hitLineY
        func hairline(_ x: Double, _ alpha: Double) {
            // Stepped fade brightening toward the hit line: (from, to, alphaScale).
            let segs: [SIMD3<Double>] = [
                SIMD3(0.0, 0.45, 0.12), SIMD3(0.45, 0.75, 0.35), SIMD3(0.75, 1.0, 0.7)
            ]
            for s in segs {
                ctx.setFillColor(highwayColor(0xE0A43B, alpha: alpha * s.z).cgColor)
                ctx.fill(CGRect(x: x - 0.5, y: hitY * s.x, width: 1, height: hitY * (s.y - s.x)))
            }
        }
        if let piano = layout as? PianoLaneLayout {
            for lane in 0..<piano.laneCount where piano.midiForLane(lane) % 12 == 0 {
                hairline(piano.laneCenterX(lane) - piano.noteWidth(lane) / 2, a * 0.7)
            }
        } else {
            for lane in 0..<layout.laneCount { hairline(layout.laneCenterX(lane), a) }
        }
    }

    private func bakeHitLine(hitY: Double) -> SKTexture {
        // Local canvas 20px tall centered on the line (y = 10 is the line).
        let inset = width * 0.04
        return bake(width: width, height: 20) { ctx in
            let midY: Double = 10
            ctx.setFillColor(highwayColor(HighwayPalette.hitLineBloom, alpha: 0.16).cgColor)
            ctx.fill(CGRect(x: inset, y: midY - 7, width: self.width - inset * 2, height: 14))
            ctx.setFillColor(highwayColor(HighwayPalette.hitLineSoft, alpha: 0.3).cgColor)
            ctx.fill(CGRect(x: inset, y: midY - 3.5, width: self.width - inset * 2, height: 7))
            ctx.setFillColor(highwayColor(HighwayPalette.hitLineCore, alpha: 1).cgColor)
            ctx.fill(CGRect(x: inset, y: midY - 1, width: self.width - inset * 2, height: 2))
        }
    }

    private func bakeGlass(hitY: Double, bandH: Double) -> SKTexture {
        // Local canvas is the band itself (0 = hit line).
        bake(width: width, height: bandH) { ctx in
            let steps = 8
            for i in 0..<steps {
                let t = Double(i) / Double(steps)
                ctx.setFillColor(highwayColor(HighwayPalette.glassSheen,
                                              alpha: self.style.glassSheenAlpha * (1 - t) * (1 - t)).cgColor)
                ctx.fill(CGRect(x: 0, y: bandH * t, width: self.width, height: bandH / Double(steps) + 1))
            }
            ctx.setFillColor(highwayColor(HighwayPalette.glassEdge, alpha: 0.14).cgColor)
            ctx.fill(CGRect(x: self.width * 0.04, y: 5, width: self.width * 0.92, height: 1))
        }
    }

    private func bakeGlare(bandH: Double) -> SKTexture {
        let gw = width * 0.18
        return bake(width: gw, height: bandH) { ctx in
            let path = CGMutablePath()
            path.addLines(between: [
                CGPoint(x: gw * 0.35, y: 0), CGPoint(x: gw, y: 0),
                CGPoint(x: gw * 0.65, y: bandH), CGPoint(x: 0, y: bandH)
            ])
            path.closeSubpath()
            ctx.addPath(path)
            ctx.setFillColor(highwayColor(HighwayPalette.glassEdge, alpha: 1).cgColor)
            ctx.fillPath()
        }
    }

    private func buildDust() {
        let count = Int(style.dustCount.rounded())
        if dust.count == count, dustTexture != nil { return }
        dustContainer.removeAllChildren()
        if dustTexture == nil {
            dustTexture = bake(width: 6, height: 6) { ctx in
                ctx.setFillColor(highwayColor(0xFFE8BF, alpha: 1).cgColor)
                ctx.fillEllipse(in: CGRect(x: 1, y: 1, width: 4, height: 4))
            }
        }
        dust = []
        for _ in 0..<count {
            let node = SKSpriteNode(texture: dustTexture)
            node.blendMode = .add
            dustContainer.addChild(node)
            dust.append(DustMote(
                node: node,
                x: Double.random(in: 0...max(1, width)),
                y: Double.random(in: 0...max(1, height)),
                speed: 6 + Double.random(in: 0...10),
                sway: 6 + Double.random(in: 0...10),
                phase: Double.random(in: 0...(Double.pi * 2))
            ))
        }
    }
}

// swiftlint:enable identifier_name
