// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import PlaySenseCore
import SpriteKit
import UIKit

// Port of `components/play-sense/glass-highway/Effects.ts`.
//
// Hit choreography, all pooled:
//   PERFECT — drumhead-water splash: crown of droplets with gravity arcs, hot flash, rising mist.
//   GOOD/OK — the note cracks into chunks that tumble down and fade.
//   MISS    — elliptical surface ripple + red glow seeping under the glass.
// Plus pooled floating grade text. Coordinate convention: scene y = `-webY`.

private final class Particle {
    let sprite = SKSpriteNode()
    var x = 0.0, y = 0.0, vx = 0.0, vy = 0.0
    var rot = 0.0, rotSpeed = 0.0
    var life = 0.0, maxLife = 1.0
    var size = 1.0, gravity = 0.0
    var active = false
}

private final class RippleState {
    let node = SKShapeNode()
    var x = 0.0, life = 0.0, maxLife = 1.0, delay = 0.0
    var active = false
}

private final class FloatingText {
    let label = SKLabelNode()
    let grade: HitGradeKind
    var life = 0.0, maxLife = 1.0, baseY = 0.0
    var active = false
    init(grade: HitGradeKind) { self.grade = grade }
}

// One class mirroring the web's single `Effects` module (splitting the choreographies would only
// fragment the 1:1 parity); its body runs a few lines over the default limit.
// swiftlint:disable:next type_body_length
public final class Effects {
    /// Above-glass effects (droplets, chunks, flash, mist, text).
    public let container = SKNode()
    /// Under-glass effects (red seep) — layered with the reflections.
    public let underGlassContainer = SKNode()

    private let droplets: [Particle]
    private let chunks: [Particle]
    private let mists: [Particle]
    private let flashes: [Particle]
    private let seeps: [Particle]
    private let ripples: [RippleState]
    private let texts: [FloatingText]

    private let textures: TextureBank
    private var style: GlassStyle
    private var hitY: Double = 0

    public init(textures: TextureBank, style: GlassStyle) {
        self.textures = textures
        self.style = style

        // Hoist to locals so the builder closures don't capture `self` before full init.
        let above = container
        let below = underGlassContainer
        func makeParticle(_ parent: SKNode) -> Particle {
            let p = Particle()
            p.sprite.isHidden = true
            p.sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            parent.addChild(p.sprite)
            return p
        }

        // Web parity: `Effects.ts`'s pools are also fixed-size (`makePool<T>(count, make)`), never grown.
        // When a pool is exhausted, `spawn*`'s `for p in pool where !p.active` loop simply finds nothing
        // free and drops the extra spawn — both platforms silently drop-on-exhaustion rather than queueing
        // or growing, since these are cosmetic flourishes sized generously for realistic note density.
        droplets = (0..<64).map { _ in makeParticle(above) }
        chunks = (0..<24).map { _ in makeParticle(above) }
        mists = (0..<12).map { _ in makeParticle(above) }
        flashes = (0..<6).map { _ in makeParticle(above) }
        seeps = (0..<4).map { _ in makeParticle(below) }

        ripples = (0..<6).map { _ in
            let r = RippleState()
            r.node.isHidden = true
            r.node.lineWidth = 1.5
            r.node.strokeColor = highwayColor(0xFFF6E6)
            r.node.fillColor = .clear
            above.addChild(r.node)
            return r
        }

        var texts: [FloatingText] = []
        for grade in HitGradeKind.allCases {
            for _ in 0..<3 {
                let ft = FloatingText(grade: grade)
                ft.label.text = HighwayPalette.gradeLabels[grade]
                ft.label.fontName = "HelveticaNeue-Bold"
                ft.label.fontSize = grade == .perfect ? 17 : 14
                ft.label.fontColor = highwayColor(HighwayPalette.gradeColors[grade] ?? 0xFFFFFF)
                ft.label.verticalAlignmentMode = .center
                ft.label.horizontalAlignmentMode = .center
                ft.label.isHidden = true
                above.addChild(ft.label)
                texts.append(ft)
            }
        }
        self.texts = texts
    }

    public func setStyle(_ style: GlassStyle) { self.style = style }
    public func resize(hitY: Double) { self.hitY = hitY }

    /// Hit at (x = lane center). Grade decides the choreography.
    public func triggerHit(x: Double, grade: HitGradeKind, color: UInt32) {
        switch grade {
        case .perfect:
            spawnSplash(x: x, color: color)
            spawnFlash(x: x, intensity: 1)
            spawnMist(x: x)
        case .good, .ok:
            spawnChunks(x: x, color: color, count: grade == .good ? Int(style.chunkCount) : 2)
            spawnFlash(x: x, intensity: 0.45)
        case .miss:
            break
        }
        spawnText(x: x, grade: grade)
    }

    /// A missed note just broke through the glass at x.
    public func triggerMissCross(x: Double) {
        spawnRipples(x: x)
        spawnSeep(x: x)
        spawnText(x: x, grade: .miss)
    }

    // MARK: - Spawners

    private func spawnSplash(x: Double, color: UInt32) {
        let count = Int(style.splashDropletCount.rounded())
        let speed = style.splashSpeed
        var spawned = 0
        for p in droplets where !p.active {
            let angle = -Double.pi / 2 + (Double.random(in: 0...1) - 0.5) * (Double.pi * 0.61)
            let v = speed * (0.45 + Double.random(in: 0...0.75))
            p.active = true
            p.sprite.texture = textures.droplet()
            p.sprite.color = highwayColor(Double.random(in: 0...1) < 0.4 ? HighwayPalette.noteHotTop : color)
            p.sprite.colorBlendFactor = 1
            p.sprite.blendMode = .add
            p.x = x + (Double.random(in: 0...1) - 0.5) * 14
            p.y = hitY - 2
            p.vx = cos(angle) * v
            p.vy = sin(angle) * v
            p.gravity = style.splashGravity
            p.life = 0
            p.maxLife = 0.55 + Double.random(in: 0...0.3)
            p.size = 4 + Double.random(in: 0...7)
            p.rot = 0; p.rotSpeed = 0
            spawned += 1
            if spawned >= count { break }
        }
    }

    private func spawnChunks(x: Double, color: UInt32, count: Int) {
        var spawned = 0
        for p in chunks where !p.active {
            let dir: Double = spawned % 2 == 0 ? -1 : 1
            p.active = true
            p.sprite.texture = textures.chunk(spawned)
            p.sprite.color = highwayColor(color)
            p.sprite.colorBlendFactor = 1
            p.sprite.blendMode = .alpha
            p.x = x + dir * (4 + Double.random(in: 0...8))
            p.y = hitY - 4
            p.vx = dir * style.chunkSpeed * (0.5 + Double.random(in: 0...0.8))
            p.vy = -40 - Double.random(in: 0...60)
            p.gravity = 900
            p.life = 0
            p.maxLife = 0.5 + Double.random(in: 0...0.2)
            p.size = 10 + Double.random(in: 0...8)
            p.rot = Double.random(in: 0...Double.pi)
            p.rotSpeed = dir * (3 + Double.random(in: 0...5))
            spawned += 1
            if spawned >= count { break }
        }
    }

    private func spawnMist(x: Double) {
        var spawned = 0
        for p in mists where !p.active {
            p.active = true
            p.sprite.texture = textures.mist()
            p.sprite.color = highwayColor(HighwayPalette.noteHotTop)
            p.sprite.colorBlendFactor = 1
            p.sprite.blendMode = .add
            p.x = x + (Double.random(in: 0...1) - 0.5) * 30
            p.y = hitY - 8
            p.vx = (Double.random(in: 0...1) - 0.5) * 20
            p.vy = -45 - Double.random(in: 0...30)
            p.gravity = -60
            p.life = 0
            p.maxLife = 0.7 + Double.random(in: 0...0.25)
            p.size = 40 + Double.random(in: 0...30)
            p.rot = 0; p.rotSpeed = 0
            spawned += 1
            if spawned >= 3 { break }
        }
    }

    private func spawnFlash(x: Double, intensity: Double) {
        for p in flashes where !p.active {
            p.active = true
            p.sprite.texture = textures.flash()
            p.sprite.color = .white
            p.sprite.colorBlendFactor = 0
            p.sprite.blendMode = .add
            p.x = x
            p.y = hitY
            p.vx = 0; p.vy = 0; p.gravity = 0
            p.life = 0
            p.maxLife = 0.16
            p.size = (90 + 60 * intensity) * intensity
            p.rot = 0; p.rotSpeed = 0
            break
        }
    }

    private func spawnSeep(x: Double) {
        for p in seeps where !p.active {
            p.active = true
            p.sprite.texture = textures.glowDot()
            p.sprite.color = highwayColor(HighwayPalette.missRed)
            p.sprite.colorBlendFactor = 1
            p.sprite.blendMode = .add
            p.x = x
            p.y = hitY + 26
            p.vx = 0; p.vy = 18; p.gravity = 0
            p.life = 0
            p.maxLife = 0.9
            p.size = 110
            p.rot = 0; p.rotSpeed = 0
            break
        }
    }

    private func spawnRipples(x: Double) {
        var spawned = 0
        for r in ripples where !r.active {
            r.active = true
            r.x = x
            r.life = 0
            r.maxLife = 0.6
            r.delay = Double(spawned) * 0.12
            spawned += 1
            if spawned >= 2 { break }
        }
    }

    private func spawnText(x: Double, grade: HitGradeKind) {
        for t in texts where !t.active && t.grade == grade {
            t.active = true
            t.label.isHidden = false
            t.label.position = CGPoint(x: x, y: -(hitY - 34))
            t.baseY = hitY - 34
            t.life = 0
            t.maxLife = grade == .perfect ? 0.8 : 0.65
            break
        }
    }

    // MARK: - Frame update

    public func update(_ dt: Double) {
        updateParticles(droplets, dt: dt, shrink: true)
        updateParticles(chunks, dt: dt, shrink: false)
        updateParticles(mists, dt: dt, shrink: true)
        updateParticles(flashes, dt: dt, shrink: false, isFlash: true)
        updateParticles(seeps, dt: dt, shrink: false, alphaScale: style.redGlowAlpha)
        updateRipples(dt)
        updateTexts(dt)
    }

    private func updateParticles(
        _ pool: [Particle], dt: Double, shrink: Bool, isFlash: Bool = false, alphaScale: Double = 1
    ) {
        for p in pool {
            if !p.active { p.sprite.isHidden = true; continue }
            p.life += dt
            if p.life >= p.maxLife { p.active = false; p.sprite.isHidden = true; continue }
            p.vy += p.gravity * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.rot += p.rotSpeed * dt

            let t = p.life / p.maxLife
            let fade = 1 - t * t
            p.sprite.isHidden = false
            p.sprite.position = CGPoint(x: p.x, y: -p.y)
            p.sprite.zRotation = -p.rot
            let scale = isFlash ? p.size * (0.55 + t * 1.1) : p.size * (shrink ? 1 - t * 0.5 : 1)
            p.sprite.size = CGSize(width: scale, height: isFlash ? scale * 0.32 : scale)
            p.sprite.alpha = isFlash ? style.flashAlpha * fade : fade * alphaScale
        }
    }

    private func updateRipples(_ dt: Double) {
        for r in ripples {
            if !r.active { r.node.isHidden = true; continue }
            if r.delay > 0 { r.delay -= dt; r.node.isHidden = true; continue }
            r.life += dt
            if r.life >= r.maxLife { r.active = false; r.node.isHidden = true; continue }
            let t = r.life / r.maxLife
            let rx = 14 + t * 52
            let ry = (14 + t * 52) * 0.22
            r.node.path = UIBezierPath(ovalIn: CGRect(x: -rx, y: -ry, width: rx * 2, height: ry * 2)).cgPath
            r.node.position = CGPoint(x: r.x, y: -hitY)
            r.node.isHidden = false
            r.node.alpha = style.rippleAlpha * (1 - t)
        }
    }

    private func updateTexts(_ dt: Double) {
        for ft in texts {
            if !ft.active { ft.label.isHidden = true; continue }
            ft.life += dt
            if ft.life >= ft.maxLife { ft.active = false; ft.label.isHidden = true; continue }
            let t = ft.life / ft.maxLife
            let pop = t < 0.18 ? 0.7 + (t / 0.18) * 0.45 : 1.15 - (t - 0.18) * 0.15
            ft.label.setScale(pop)
            ft.label.position = CGPoint(x: ft.label.position.x, y: -(ft.baseY - t * 40))
            ft.label.alpha = t < 0.15 ? t / 0.15 : 1 - max(0, (t - 0.45) / 0.55)
        }
    }
}

// swiftlint:enable identifier_name
