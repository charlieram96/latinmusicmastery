// components/play-sense/rhythm-highway/NoteManager.ts
import { Container, Graphics } from 'pixi.js'
import type { ExerciseDefinition, ExerciseEvent } from '@/lib/play-sense/types'
import { generateExpectedTimestamps, getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import type { ExpectedEvent } from '@/lib/play-sense/scoring'
import {
  LOOK_AHEAD_SEC,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
  NOTE_MIN_ALPHA,
  NOTE_MAX_ALPHA,
} from './constants'
import type { Highway } from './Highway'

type NoteState = 'approaching' | 'missed'

interface NoteSprite {
  gfx: Graphics
  eventIndex: number
  timestamp: number
  laneIndex: number
  color: number
  active: boolean
  state: NoteState
  /** For missed notes: how long they've been sliding past (seconds) */
  missAge: number
}

const MISS_SLIDE_DURATION = 0.6 // seconds to fade out after passing

/**
 * Manages 3D oval note sprites on the highway. Notes are glowing circles/ovals
 * that gain intensity as they approach the hit zone. Missed notes slide past
 * the congas and fade out instead of disappearing instantly.
 */
export class NoteManager {
  readonly container = new Container()

  private pool: NoteSprite[] = []
  private expectedEvents: ExpectedEvent[] = []
  private laneSurfaces: string[] = []
  private highway: Highway
  private exerciseEvents: ExerciseEvent[] = []
  private laneCount = 3

  /** Events that were hit — remove immediately */
  private hitIndices = new Set<number>()
  /** Events that were missed — let them slide past */
  private missedIndices = new Set<number>()
  /** Track when each miss started for slide animation */
  private missTimestamps = new Map<number, number>()

  constructor(highway: Highway) {
    this.highway = highway
  }

  init(exercise: ExerciseDefinition, laneSurfaces: string[]) {
    this.laneSurfaces = laneSurfaces
    this.laneCount = laneSurfaces.length
    this.exerciseEvents = exercise.events
    this.expectedEvents = generateExpectedTimestamps(exercise)

    const maxVisible = Math.min(this.expectedEvents.length, 50)
    this.ensurePoolSize(maxVisible)

    this.hitIndices.clear()
    this.missedIndices.clear()
    this.missTimestamps.clear()
  }

  /** Mark an event as successfully hit — it will be removed and shatter effect triggered externally */
  markHit(eventIndex: number) {
    this.hitIndices.add(eventIndex)
  }

  /** Mark an event as missed — it will slide past the congas and fade out */
  markMissed(eventIndex: number, elapsedSec: number) {
    this.missedIndices.add(eventIndex)
    this.missTimestamps.set(eventIndex, elapsedSec)
  }

  update(elapsedSec: number) {
    // Deactivate all sprites first
    for (const sprite of this.pool) {
      sprite.active = false
      sprite.gfx.visible = false
    }

    let poolIdx = 0

    for (const expected of this.expectedEvents) {
      const timeDiff = expected.timestamp - elapsedSec

      // Skip hit notes entirely
      if (this.hitIndices.has(expected.eventIndex)) continue

      // Handle missed notes — they slide past
      if (this.missedIndices.has(expected.eventIndex)) {
        const missStart = this.missTimestamps.get(expected.eventIndex) ?? elapsedSec
        const missAge = elapsedSec - missStart
        if (missAge > MISS_SLIDE_DURATION) continue // fully faded

        if (poolIdx >= this.pool.length) this.ensurePoolSize(this.pool.length + 10)
        const sprite = this.pool[poolIdx++]
        this.drawMissedNote(sprite, expected, missAge)
        continue
      }

      // Skip events outside visible window
      if (timeDiff < -0.3 || timeDiff > LOOK_AHEAD_SEC) continue

      // Auto-miss notes that pass the hit zone without being graded
      if (timeDiff < -0.15) {
        this.missedIndices.add(expected.eventIndex)
        this.missTimestamps.set(expected.eventIndex, elapsedSec)
        continue
      }

      const originalEvent = this.getOriginalEvent(expected.eventIndex)
      const laneIndex = this.getLaneIndex(originalEvent)
      const color = this.getLaneColor(originalEvent)

      const depthFraction = 1 - (timeDiff / LOOK_AHEAD_SEC)
      if (depthFraction < 0) continue

      if (poolIdx >= this.pool.length) this.ensurePoolSize(this.pool.length + 10)
      const sprite = this.pool[poolIdx++]
      sprite.active = true
      sprite.gfx.visible = true
      sprite.eventIndex = expected.eventIndex
      sprite.laneIndex = laneIndex
      sprite.color = color
      sprite.state = 'approaching'

      const clampedDepth = Math.min(depthFraction, 1)
      const y = this.highway.depthToY(clampedDepth)
      const x = this.highway.getLaneX(laneIndex, y)
      const scale = this.highway.getScaleAtDepth(clampedDepth)
      const alpha = NOTE_MIN_ALPHA + (NOTE_MAX_ALPHA - NOTE_MIN_ALPHA) * clampedDepth

      this.draw3DOval(sprite.gfx, x, y, scale, alpha, color, clampedDepth)
    }
  }

  getLaneForEvent(eventIndex: number): number {
    const originalEvent = this.getOriginalEvent(eventIndex)
    return this.getLaneIndex(originalEvent)
  }

  getColorForEvent(eventIndex: number): number {
    const originalEvent = this.getOriginalEvent(eventIndex)
    return this.getLaneColor(originalEvent)
  }

  // ── Private ──

  /** Draw a 3D disc/puck note with visible thickness, lighting, and glow */
  private draw3DOval(gfx: Graphics, x: number, y: number, scale: number, alpha: number, color: number, depth: number) {
    gfx.clear()

    const rx = 48 * scale  // horizontal radius (much larger)
    const ry = 20 * scale  // vertical radius (perspective-flattened)
    const thickness = 8 * scale // visible 3D thickness of the disc

    // ── Outer ambient glow ──
    gfx.ellipse(x, y, rx + 10 * scale, ry + 5 * scale)
    gfx.fill({ color, alpha: alpha * 0.08 })

    gfx.ellipse(x, y, rx + 5 * scale, ry + 2.5 * scale)
    gfx.fill({ color, alpha: alpha * 0.14 })

    // ── 3D disc edge (visible thickness / side) ──
    // Draw the "side" of the disc as a band below the top face
    // Left arc of bottom ellipse
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.fill({ color, alpha: alpha * 0.35 })

    // Connect top and bottom with side walls
    gfx.moveTo(x - rx, y)
    gfx.lineTo(x - rx, y + thickness)
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.moveTo(x + rx, y + thickness)
    gfx.lineTo(x + rx, y)
    // Fill the side band darker for depth
    gfx.rect(x - rx, y, rx * 2, thickness)
    gfx.fill({ color, alpha: alpha * 0.3 })

    // Bottom edge highlight
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.stroke({ color, width: 1 * scale, alpha: alpha * 0.25 })

    // ── Top face (main surface) ──
    gfx.ellipse(x, y, rx, ry)
    gfx.fill({ color, alpha: alpha * 0.8 })

    // ── Top face lighting ──
    // Broad highlight across upper half (diffuse light from above)
    gfx.ellipse(x, y - ry * 0.15, rx * 0.8, ry * 0.55)
    gfx.fill({ color: 0xffffff, alpha: alpha * 0.15 })

    // Tighter highlight (specular band)
    gfx.ellipse(x - rx * 0.05, y - ry * 0.25, rx * 0.5, ry * 0.3)
    gfx.fill({ color: 0xffffff, alpha: alpha * 0.2 })

    // Hot specular dot (point light reflection)
    gfx.circle(x - rx * 0.18, y - ry * 0.3, 3 * scale)
    gfx.fill({ color: 0xffffff, alpha: alpha * 0.4 })

    // ── Rim stroke ──
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color, width: 2 * scale, alpha: alpha * 0.5 })

    // Inner rim detail (gives a "lip" feel)
    gfx.ellipse(x, y, rx * 0.88, ry * 0.88)
    gfx.stroke({ color: 0xffffff, width: 0.5 * scale, alpha: alpha * 0.08 })

    // ── Bottom shadow (below the disc) ──
    gfx.ellipse(x, y + thickness + 3 * scale, rx * 0.9, ry * 0.5)
    gfx.fill({ color: 0x000000, alpha: alpha * 0.1 })

    // ── Pulsing approach glow ──
    if (depth > 0.75) {
      const pulseIntensity = (depth - 0.75) / 0.25
      const time = Date.now() * 0.006
      const pulse = 1 + Math.sin(time) * 0.15 * pulseIntensity
      gfx.ellipse(x, y, (rx + 14 * scale) * pulse, (ry + 7 * scale) * pulse)
      gfx.fill({ color, alpha: alpha * 0.06 * pulseIntensity })
      gfx.ellipse(x, y, (rx + 8 * scale) * pulse, (ry + 4 * scale) * pulse)
      gfx.fill({ color, alpha: alpha * 0.04 * pulseIntensity })
    }
  }

  /** Draw a missed note sliding past the congas, fading and greying out */
  private drawMissedNote(sprite: NoteSprite, expected: ExpectedEvent, missAge: number) {
    const originalEvent = this.getOriginalEvent(expected.eventIndex)
    const laneIndex = this.getLaneIndex(originalEvent)
    const color = this.getLaneColor(originalEvent)

    sprite.active = true
    sprite.gfx.visible = true
    sprite.state = 'missed'
    sprite.eventIndex = expected.eventIndex

    const hitY = this.highway.getHitZoneY()
    const fadeProgress = missAge / MISS_SLIDE_DURATION
    const alpha = (1 - fadeProgress) * 0.5

    // Slide downward past the congas
    const slideDistance = fadeProgress * 80
    const y = hitY + slideDistance
    const x = this.highway.getLaneX(laneIndex, hitY)
    const scale = this.highway.getScaleAtDepth(1) * (1 - fadeProgress * 0.3)

    sprite.gfx.clear()
    const rx = 22 * scale
    const ry = 10 * scale

    // Dimmed, desaturated oval
    sprite.gfx.ellipse(x, y, rx, ry)
    sprite.gfx.fill({ color: 0x666666, alpha: alpha * 0.6 })
    sprite.gfx.ellipse(x, y, rx, ry)
    sprite.gfx.stroke({ color: 0x444444, width: 1, alpha: alpha * 0.4 })

    // Faint original color ghost
    sprite.gfx.ellipse(x, y, rx + 2, ry + 1)
    sprite.gfx.fill({ color, alpha: alpha * 0.1 })
  }

  private getOriginalEvent(eventIndex: number): ExerciseEvent | undefined {
    const idx = eventIndex % this.exerciseEvents.length
    return this.exerciseEvents[idx]
  }

  private getLaneIndex(event: ExerciseEvent | undefined): number {
    if (!event) return 0
    if (event.surface) {
      const idx = this.laneSurfaces.indexOf(event.surface)
      if (idx >= 0) return idx
    }
    const techIdx = this.laneSurfaces.indexOf(event.technique)
    if (techIdx >= 0) return techIdx
    return 0
  }

  private getLaneColor(event: ExerciseEvent | undefined): number {
    if (!event) return DEFAULT_LANE_COLOR
    const surface = event.surface || event.technique
    return LANE_COLORS[surface] ?? DEFAULT_LANE_COLOR
  }

  private ensurePoolSize(size: number) {
    while (this.pool.length < size) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.pool.push({
        gfx,
        eventIndex: -1,
        timestamp: 0,
        laneIndex: 0,
        color: DEFAULT_LANE_COLOR,
        active: false,
        state: 'approaching',
        missAge: 0,
      })
    }
  }
}
