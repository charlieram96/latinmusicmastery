// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import PlaySenseCore
import SpriteKit

// Port of `components/play-sense/glass-highway/NoteField.ts`.
//
// Falling notes. Pooled `SKSpriteNode`s (body + trail + reflection) stamped from baked textures — the
// per-frame work is transforms only. The selection / timing / miss-state logic lives in the pure
// ``NoteFieldModel``; this class turns each ``NoteFrame`` into sprite transforms and runs the visual
// miss sequence (refraction wobble → red swap → decaying shake → sink alpha) the web renders inline.

private struct PooledNote {
    let body: SKSpriteNode
    let trail: SKSpriteNode
    let refl: SKSpriteNode
}

public final class NoteField {
    /// Notes above the glass (over the hit line layer).
    public let container = SKNode()
    /// Reflections — layered under the glass band.
    public let reflectionContainer = SKNode()
    /// Sunk misses — also under the glass band so the table dims them.
    public let belowGlassContainer = SKNode()

    private let model = NoteFieldModel()
    private let textures: TextureBank
    private var style: GlassStyle
    private var layout: LaneLayout?
    private var exerciseEvents: [ExerciseEvent] = []

    private var pool: [PooledNote] = []
    private var width: Double = 0
    private var height: Double = 0
    private var hitY: Double = 0

    /// Called the moment a missed note breaks through the glass (x, lane).
    public var onMissCross: ((Double, Int) -> Void)?
    /// Called when a note is auto-missed by passing the line unjudged (visual-only on iOS; the
    /// coordinator's scorer is the authority for grades).
    public var onAutoMiss: ((Int) -> Void)?

    public init(textures: TextureBank, style: GlassStyle) {
        self.textures = textures
        self.style = style
    }

    public func setStyle(_ style: GlassStyle) { self.style = style }

    public func initialize(exercise: ExerciseDefinition, layout: LaneLayout) {
        self.layout = layout
        self.exerciseEvents = exercise.events
        model.setExpectedEvents(generateExpectedTimestamps(exercise))
        ensurePool(min(exercise.events.count * exercise.loopCount, 64))
    }

    public func resize(width: Double, height: Double, hitY: Double) {
        self.width = width
        self.height = height
        self.hitY = hitY
    }

    public func markHit(_ eventIndex: Int) { model.markHit(eventIndex) }
    public func markMissed(_ eventIndex: Int) { model.markMissed(eventIndex) }
    public func closestEventIndex(elapsedSec: Double) -> Int? { model.closestEventIndex(elapsedSec: elapsedSec) }

    public func laneForEvent(_ eventIndex: Int) -> Int { layout?.laneForEvent(originalEvent(eventIndex)) ?? 0 }
    public func colorForEvent(_ eventIndex: Int) -> UInt32 { layout?.laneColor(laneForEvent(eventIndex)) ?? 0xF2A12C }

    /// Hide everything without advancing state — paused / preview frames.
    public func clearVisible() {
        for n in pool { n.body.isHidden = true; n.trail.isHidden = true; n.refl.isHidden = true }
    }

    public func update(elapsedSec: Double, nowSec: Double) {
        guard let layout, hitY > 0 else { return }
        for n in pool { n.body.isHidden = true; n.trail.isHidden = true; n.refl.isHidden = true }

        let frame = model.frame(elapsedSec: elapsedSec, hitY: hitY, approachSec: style.approachSec)
        for index in frame.autoMissed { onAutoMiss?(index) }
        for index in frame.crossed {
            let lane = layout.laneForEvent(originalEvent(index))
            onMissCross?(layout.laneCenterX(lane), lane)
        }

        var poolIdx = 0
        for note in frame.visible {
            if poolIdx >= pool.count { ensurePool(pool.count + 12) }
            let n = pool[poolIdx]
            poolIdx += 1

            let event = originalEvent(note.eventIndex)
            let lane = layout.laneForEvent(event)
            let color = layout.laneColor(lane)
            let laneX = layout.laneCenterX(lane)
            let w = layout.noteWidth(lane)
            let h = min(max(w * style.noteAspect, 8), 20)

            if note.isMissed {
                renderMissed(n, note: note, laneX: laneX, w: w, h: h, nowSec: nowSec)
            } else {
                renderApproaching(n, note: note, laneX: laneX, color: color, w: w, h: h)
            }
        }
    }

    // MARK: - Rendering

    // swiftlint:disable:next function_parameter_count
    private func renderApproaching(
        _ n: PooledNote, note: VisibleNote, laneX: Double, color: UInt32, w: Double, h: Double
    ) {
        // A prior miss may have re-parented this body under the glass.
        if n.body.parent !== container { n.body.removeFromParent(); container.addChild(n.body) }

        let body = n.body
        body.texture = textures.pill(color)
        body.colorBlendFactor = 0
        body.isHidden = false
        body.position = CGPoint(x: laneX, y: -note.y)
        body.size = CGSize(width: w * 1.28, height: h * 1.8)
        body.xScale = abs(body.xScale)
        body.yScale = abs(body.yScale)
        body.zRotation = 0
        body.alpha = note.fadeIn
        body.blendMode = .alpha

        // Trail above the note.
        let approachFrac = 1 - note.timeToHit / style.approachSec
        let trail = n.trail
        trail.isHidden = style.trailAlpha <= 0
        if !trail.isHidden {
            trail.texture = textures.trail()
            trail.anchorPoint = CGPoint(x: 0.5, y: 0)
            trail.position = CGPoint(x: laneX, y: -(note.y - h * 0.55))
            trail.size = CGSize(width: max(w * 0.2, 4), height: h * style.trailLength)
            trail.color = highwayColor(color)
            trail.colorBlendFactor = 1
            trail.alpha = note.fadeIn * style.trailAlpha * min(1, approachFrac + 0.25)
            trail.blendMode = .add
        }

        // Reflection rising to meet the note.
        if style.reflectionAlpha > 0, note.timeToHit >= 0 {
            let yR = 2 * hitY - note.y
            if yR < height + 30 {
                let refl = n.refl
                refl.texture = textures.softPill(color)
                refl.colorBlendFactor = 0
                refl.isHidden = false
                refl.position = CGPoint(x: laneX, y: -yR)
                refl.size = CGSize(width: w * 1.28, height: h * 1.8)
                refl.yScale = -abs(refl.yScale)
                let falloff = max(0.05, style.reflectionFalloff)
                let proximity = max(0, 1 - (hitY - note.y) / (hitY * falloff))
                refl.alpha = style.reflectionAlpha * proximity * note.fadeIn
            }
        }
    }

    // swiftlint:disable:next function_parameter_count
    private func renderMissed(_ n: PooledNote, note: VisibleNote, laneX: Double, w: Double, h: Double, nowSec: Double) {
        // Re-parent under the glass so the table band dims the sinking note.
        if n.body.parent !== belowGlassContainer { n.body.removeFromParent(); belowGlassContainer.addChild(n.body) }
        let body = n.body
        body.texture = textures.missPill()
        body.colorBlendFactor = 0
        body.isHidden = false
        body.blendMode = .alpha
        body.zRotation = 0

        let pastSec = note.pastSec

        // Decaying horizontal vibration.
        let shakeDecay = max(0, 1 - pastSec / shakeDecaySec)
        let shake = sin(nowSec * style.missShakeFreq * Double.pi * 2) * style.missShakeAmp * shakeDecay
        body.position = CGPoint(x: laneX + shake, y: -note.y)

        // Refraction wobble at the surface: squash wide, then recover.
        var sx = 1.0, sy = 1.0
        if pastSec < refractSec {
            let t = pastSec / refractSec
            let wob = sin(t * Double.pi)
            sx = 1 + 0.22 * wob
            sy = 1 - 0.3 * wob
        }
        body.size = CGSize(width: w * 1.28 * sx, height: h * 1.8 * sy)

        // Dim toward the sink alpha, then fade out at end of life.
        let sinkT = min(1, pastSec / 0.45)
        var alpha = 1 + (style.missSinkAlpha - 1) * sinkT
        let lifeT = pastSec / missLifeSec
        if lifeT > 0.7 { alpha *= max(0, 1 - (lifeT - 0.7) / 0.3) }
        body.alpha = alpha
        if pastSec >= missLifeSec { body.isHidden = true }
    }

    // MARK: - Pool

    private func originalEvent(_ eventIndex: Int) -> ExerciseEvent? {
        guard !exerciseEvents.isEmpty else { return nil }
        return exerciseEvents[eventIndex % exerciseEvents.count]
    }

    private func ensurePool(_ size: Int) {
        while pool.count < size {
            let body = SKSpriteNode()
            let trail = SKSpriteNode()
            let refl = SKSpriteNode()
            body.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            refl.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            body.isHidden = true; trail.isHidden = true; refl.isHidden = true
            container.addChild(trail)
            container.addChild(body)
            reflectionContainer.addChild(refl)
            pool.append(PooledNote(body: body, trail: trail, refl: refl))
        }
    }
}

// swiftlint:enable identifier_name
