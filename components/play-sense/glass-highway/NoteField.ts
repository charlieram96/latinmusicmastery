// components/play-sense/glass-highway/NoteField.ts
//
// Falling notes. Pooled sprites (body + trail + reflection) stamped from
// baked textures — per-frame work is transforms only. Uniform fall speed:
// every note travels top → hit line in style.approachSec seconds.
//
// Miss sequence (the note itself; ripple/red-seep live in Effects):
//   crossing the line → refraction wobble + red texture swap
//   → decaying horizontal shake while it keeps falling
//   → dims to missSinkAlpha under the glass → expires.

import { Container, Sprite } from 'pixi.js'
import type { ExerciseDefinition, ExerciseEvent } from '@/lib/play-sense/types'
import { generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'
import type { ExpectedEvent } from '@/lib/play-sense/scoring'
import type { GlassStyle } from './style'
import type { LaneLayout } from './LaneLayout'
import type { TextureBank } from './textures'

interface PooledNote {
  body: Sprite
  trail: Sprite
  refl: Sprite
}

/** Seconds of refraction wobble after crossing the line. */
const REFRACT_SEC = 0.18
/** Seconds over which the shake decays. */
const SHAKE_DECAY_SEC = 0.75
/** Seconds after crossing before a missed note fully expires. */
const MISS_LIFE_SEC = 1.1

export class NoteField {
  /** Notes above the glass (over the hit line layer). */
  readonly container = new Container()
  /** Reflections — layered under the glass band. */
  readonly reflectionContainer = new Container()
  /** Sunk misses — also under the glass band so the table dims them. */
  readonly belowGlassContainer = new Container()

  private pool: PooledNote[] = []
  private expectedEvents: ExpectedEvent[] = []
  private exerciseEvents: ExerciseEvent[] = []
  private layout: LaneLayout | null = null
  private textures: TextureBank
  private style: GlassStyle

  private hitIndices = new Set<number>()
  private missedIndices = new Set<number>()
  /** Events whose line-crossing has been announced (ripple fired once). */
  private crossedIndices = new Set<number>()

  private width = 0
  private height = 0
  private hitY = 0

  /** Called the moment a missed note breaks through the glass. */
  onMissCross: ((x: number, lane: number) => void) | null = null
  /** Called when any note is auto-missed by passing the line unjudged. */
  onAutoMiss: ((eventIndex: number) => void) | null = null

  constructor(textures: TextureBank, style: GlassStyle) {
    this.textures = textures
    this.style = style
  }

  setStyle(style: GlassStyle) {
    this.style = style
  }

  init(exercise: ExerciseDefinition, layout: LaneLayout) {
    this.layout = layout
    this.exerciseEvents = exercise.events
    this.expectedEvents = generateExpectedTimestamps(exercise)
    this.hitIndices.clear()
    this.missedIndices.clear()
    this.crossedIndices.clear()
    this.ensurePoolSize(Math.min(this.expectedEvents.length, 64))
  }

  resize(width: number, height: number, hitY: number) {
    this.width = width
    this.height = height
    this.hitY = hitY
  }

  markHit(eventIndex: number) {
    this.hitIndices.add(eventIndex)
  }

  markMissed(eventIndex: number) {
    this.missedIndices.add(eventIndex)
  }

  /** Hide everything without advancing state — paused/preview frames. */
  clearVisible() {
    for (const n of this.pool) {
      n.body.visible = false
      n.trail.visible = false
      n.refl.visible = false
    }
  }

  getClosestEventIndex(elapsedSec: number): number | null {
    let bestIdx: number | null = null
    let bestDist = Infinity
    for (const expected of this.expectedEvents) {
      if (this.hitIndices.has(expected.eventIndex)) continue
      if (this.missedIndices.has(expected.eventIndex)) continue
      const dist = Math.abs(expected.timestamp - elapsedSec)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = expected.eventIndex
      }
    }
    return bestIdx
  }

  getLaneForEvent(eventIndex: number): number {
    return this.layout?.laneForEvent(this.originalEvent(eventIndex)) ?? 0
  }

  getColorForEvent(eventIndex: number): number {
    const lane = this.getLaneForEvent(eventIndex)
    return this.layout?.laneColor(lane) ?? 0xf2a12c
  }

  update(elapsedSec: number, nowMs: number) {
    const layout = this.layout
    if (!layout || this.hitY === 0) return

    for (const n of this.pool) {
      n.body.visible = false
      n.trail.visible = false
      n.refl.visible = false
    }

    const approach = this.style.approachSec
    const pxPerSec = this.hitY / approach
    // Visible time window around the playhead
    const windowStart = elapsedSec - MISS_LIFE_SEC
    const windowEnd = elapsedSec + approach * 1.15

    // Binary search: first event with timestamp >= windowStart
    let lo = 0
    let hi = this.expectedEvents.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.expectedEvents[mid].timestamp < windowStart) lo = mid + 1
      else hi = mid
    }

    let poolIdx = 0
    for (let i = lo; i < this.expectedEvents.length; i++) {
      const expected = this.expectedEvents[i]
      if (expected.timestamp > windowEnd) break
      if (this.hitIndices.has(expected.eventIndex)) continue

      const timeToHit = expected.timestamp - elapsedSec
      const y = this.hitY - timeToHit * pxPerSec
      if (y < -30) continue

      const pastSec = -timeToHit // seconds past the hit line

      // Auto-miss once meaningfully past the line and unjudged
      if (pastSec > 0.03 && !this.missedIndices.has(expected.eventIndex)) {
        this.missedIndices.add(expected.eventIndex)
        this.onAutoMiss?.(expected.eventIndex)
      }

      const isMissed = this.missedIndices.has(expected.eventIndex)
      if (isMissed && pastSec > MISS_LIFE_SEC) continue
      // Non-missed notes past the line shouldn't linger (markHit removes them)
      if (!isMissed && pastSec > 0.05) continue

      if (poolIdx >= this.pool.length) this.ensurePoolSize(this.pool.length + 12)
      const n = this.pool[poolIdx++]

      const event = this.originalEvent(expected.eventIndex)
      const lane = layout.laneForEvent(event)
      const color = layout.laneColor(lane)
      const laneX = layout.laneCenterX(lane)
      const w = layout.noteWidth(lane)
      const h = Math.min(Math.max(w * this.style.noteAspect, 8), 20)

      // Fade in over the first 15% of the approach
      const approachFrac = 1 - timeToHit / approach
      const fadeIn = Math.min(1, Math.max(0, approachFrac / 0.15))

      if (isMissed && pastSec > 0) {
        this.renderMissedNote(n, expected, laneX, y, w, h, pastSec, nowMs)
        continue
      }

      // ── Approaching note ──
      const body = n.body
      // A prior miss may have re-parented this sprite under the glass
      if (body.parent !== this.container) this.container.addChild(body)
      body.texture = this.textures.pill(color)
      body.visible = true
      body.anchor.set(0.5)
      body.position.set(laneX, y)
      // pill texture has baked padding ≈ 18px on a 128×44 core → scale by core
      body.width = w * 1.28
      body.height = h * 1.8
      body.alpha = fadeIn * (isMissed ? 0.85 : 1)
      body.blendMode = 'normal'

      // Trail above the note
      const trail = n.trail
      trail.texture = this.textures.trail()
      trail.visible = this.style.trailAlpha > 0
      trail.anchor.set(0.5, 1)
      trail.position.set(laneX, y - h * 0.55)
      trail.width = Math.max(w * 0.2, 4)
      trail.height = h * this.style.trailLength
      trail.tint = color
      trail.alpha = fadeIn * this.style.trailAlpha * Math.min(1, approachFrac + 0.25)
      trail.blendMode = 'add'

      // Reflection rising to meet the note
      if (this.style.reflectionAlpha > 0 && timeToHit >= 0) {
        const yR = 2 * this.hitY - y
        if (yR < this.height + 30) {
          const refl = n.refl
          refl.texture = this.textures.softPill(color)
          refl.visible = true
          refl.anchor.set(0.5)
          refl.position.set(laneX, yR)
          refl.width = w * 1.28
          refl.height = h * 1.8
          refl.scale.y = -Math.abs(refl.scale.y)
          const falloff = Math.max(0.05, this.style.reflectionFalloff)
          const proximity = Math.max(0, 1 - (this.hitY - y) / (this.hitY * falloff))
          refl.alpha = this.style.reflectionAlpha * proximity * fadeIn
        }
      }
    }
  }

  // ── Miss rendering ──

  private renderMissedNote(
    n: PooledNote,
    expected: ExpectedEvent,
    laneX: number,
    y: number,
    w: number,
    h: number,
    pastSec: number,
    nowMs: number,
  ) {
    // Announce the crossing once (Effects fires ripple + red seep)
    if (!this.crossedIndices.has(expected.eventIndex)) {
      this.crossedIndices.add(expected.eventIndex)
      const lane = this.layout!.laneForEvent(this.originalEvent(expected.eventIndex))
      this.onMissCross?.(laneX, lane)
      // Re-parent under the glass so the table band dims the sinking note
      this.belowGlassContainer.addChild(n.body)
    }

    const body = n.body
    body.texture = this.textures.missPill()
    body.visible = true
    body.anchor.set(0.5)

    // Decaying horizontal vibration
    const shakeDecay = Math.max(0, 1 - pastSec / SHAKE_DECAY_SEC)
    const shake = Math.sin((nowMs / 1000) * this.style.missShakeFreq * Math.PI * 2)
      * this.style.missShakeAmp * shakeDecay

    body.position.set(laneX + shake, y)

    // Refraction wobble right at the surface: squash wide, then recover
    let sx = 1
    let sy = 1
    if (pastSec < REFRACT_SEC) {
      const t = pastSec / REFRACT_SEC
      const wob = Math.sin(t * Math.PI)
      sx = 1 + 0.22 * wob
      sy = 1 - 0.3 * wob
    }
    body.width = w * 1.28 * sx
    body.height = h * 1.8 * sy

    // Dim toward the sink alpha, then fade out entirely at end of life
    const sinkT = Math.min(1, pastSec / 0.45)
    let alpha = 1 + (this.style.missSinkAlpha - 1) * sinkT
    const lifeT = pastSec / MISS_LIFE_SEC
    if (lifeT > 0.7) alpha *= Math.max(0, 1 - (lifeT - 0.7) / 0.3)
    body.alpha = alpha

    if (pastSec >= MISS_LIFE_SEC) body.visible = false
  }

  private originalEvent(eventIndex: number): ExerciseEvent | undefined {
    if (this.exerciseEvents.length === 0) return undefined
    return this.exerciseEvents[eventIndex % this.exerciseEvents.length]
  }

  private ensurePoolSize(size: number) {
    while (this.pool.length < size) {
      const body = new Sprite()
      const trail = new Sprite()
      const refl = new Sprite()
      body.visible = trail.visible = refl.visible = false
      this.container.addChild(trail, body)
      this.reflectionContainer.addChild(refl)
      this.pool.push({ body, trail, refl })
    }
  }
}
