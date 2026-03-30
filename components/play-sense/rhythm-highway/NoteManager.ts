// components/play-sense/rhythm-highway/NoteManager.ts
import { Container, Graphics } from 'pixi.js'
import type { ExerciseDefinition, ExerciseEvent } from '@/lib/play-sense/types'
import { generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'
import type { ExpectedEvent } from '@/lib/play-sense/scoring'
import {
  LOOK_AHEAD_SEC,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
} from './constants'
import type { Highway } from './Highway'

export interface NoteStyle {
  neonBloomAlpha: number
  bottomFaceAlpha: number
  sideWallAlpha: number
  sideHighlightAlpha: number
  sideShadowAlpha: number
  topFaceShadowAlpha: number
  bottomRimAlpha: number
  bottomRimWhiteAlpha: number
  verticalEdgeAlpha: number
  topFaceAlpha: number
  topRimGlowAlpha: number
  topRimMainAlpha: number
  topRimWhiteAlpha: number
  dropShadowAlpha: number
  wingLineAlpha: number
  pulseGlowAlpha: number
  thickness: number
}

export const DEFAULT_NOTE_STYLE: NoteStyle = {
  neonBloomAlpha: 0.17,
  bottomFaceAlpha: 0.21,
  sideWallAlpha: 0,
  sideHighlightAlpha: 0,
  sideShadowAlpha: 0,
  topFaceShadowAlpha: 0,
  bottomRimAlpha: 0.59,
  bottomRimWhiteAlpha: 0.38,
  verticalEdgeAlpha: 0,
  topFaceAlpha: 0.89,
  topRimGlowAlpha: 0.5,
  topRimMainAlpha: 0.4,
  topRimWhiteAlpha: 0.39,
  dropShadowAlpha: 0,
  wingLineAlpha: 0.43,
  pulseGlowAlpha: 0.08,
  thickness: 24,
}

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

/** How far past hit zone (in depth units) before a missed note disappears */
const MISS_PAST_DEPTH = 0.5

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

  /** Live-editable note style — change values and notes update next frame */
  noteStyle: NoteStyle = { ...DEFAULT_NOTE_STYLE }

  /** Events that were hit — remove immediately */
  private hitIndices = new Set<number>()
  /** Events that were missed — continue traveling with red glow */
  private missedIndices = new Set<number>()

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
  }

  /** Mark an event as successfully hit — it will be removed and shatter effect triggered externally */
  markHit(eventIndex: number) {
    this.hitIndices.add(eventIndex)
  }

  /** Mark an event as missed — it will continue traveling with red glow */
  markMissed(eventIndex: number) {
    this.missedIndices.add(eventIndex)
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

      // depthFraction: 0 = vanishing point, 1 = hit zone, >1 = past hit zone
      const depthFraction = 1 - (timeDiff / LOOK_AHEAD_SEC)

      // Not visible yet
      if (depthFraction < 0) continue

      // Auto-mark as missed once past the hit zone
      if (depthFraction > 1.02 && !this.missedIndices.has(expected.eventIndex)) {
        this.missedIndices.add(expected.eventIndex)
      }

      const isMissed = this.missedIndices.has(expected.eventIndex)

      // How far past hit zone (for fade out)
      const pastHitZone = depthFraction - 1
      if (isMissed && pastHitZone > MISS_PAST_DEPTH) continue // fully gone

      const originalEvent = this.getOriginalEvent(expected.eventIndex)
      const laneIndex = this.getLaneIndex(originalEvent)
      const color = this.getLaneColor(originalEvent)

      if (poolIdx >= this.pool.length) this.ensurePoolSize(this.pool.length + 10)
      const sprite = this.pool[poolIdx++]
      sprite.active = true
      sprite.gfx.visible = true
      sprite.eventIndex = expected.eventIndex
      sprite.laneIndex = laneIndex
      sprite.color = color

      // Use the same continuous depth math for position — notes just keep going
      const y = this.highway.depthToYExtended(depthFraction)
      const x = this.highway.getLaneX(laneIndex, y)
      // Scale keeps growing past hit zone at the same rate
      const scale = this.highway.getScaleAtDepth(depthFraction)

      // Fade in over the first 20% of the highway (Rock Band style)
      const fadeIn = Math.min(1, depthFraction / 0.2)

      if (isMissed) {
        sprite.state = 'missed'
        const fadeAlpha = 1 - (pastHitZone / MISS_PAST_DEPTH)
        this.drawMissedNote(sprite.gfx, x, y, scale, Math.max(0, fadeAlpha), color)
      } else {
        sprite.state = 'approaching'
        this.draw3DOval(sprite.gfx, x, y, scale, fadeIn, color, Math.min(depthFraction, 1))
      }
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

  /** 3D hockey puck note — all alphas driven by this.noteStyle */
  private draw3DOval(gfx: Graphics, x: number, y: number, scale: number, alpha: number, color: number, depth: number) {
    gfx.clear()
    gfx.alpha = alpha
    const s = this.noteStyle

    const rx = 96 * scale
    const ry = 40 * scale
    const thickness = s.thickness * scale

    // 1. Neon bloom
    gfx.ellipse(x, y, rx + 12 * scale, ry + 6 * scale)
    gfx.fill({ color, alpha: s.neonBloomAlpha })

    // 2. Bottom face
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.fill({ color, alpha: s.bottomFaceAlpha })

    // 3. Side wall
    gfx.rect(x - rx, y, rx * 2, thickness)
    gfx.fill({ color, alpha: s.sideWallAlpha })

    // 4. Side highlight (left)
    gfx.rect(x - rx, y + thickness * 0.1, rx * 0.35, thickness * 0.8)
    gfx.fill({ color: 0xffffff, alpha: s.sideHighlightAlpha })

    // 5. Side shadow (right)
    gfx.rect(x + rx * 0.65, y + thickness * 0.1, rx * 0.35, thickness * 0.8)
    gfx.fill({ color: 0x000000, alpha: s.sideShadowAlpha })

    // 6. Top face shadow on side wall
    gfx.rect(x - rx, y, rx * 2, thickness * 0.35)
    gfx.fill({ color: 0x000000, alpha: s.topFaceShadowAlpha })

    // 7. Bottom edge rim (neon)
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.stroke({ color, width: 2 * scale, alpha: s.bottomRimAlpha })

    // 8. Bottom edge rim (white)
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.stroke({ color: 0xffffff, width: 0.5 * scale, alpha: s.bottomRimWhiteAlpha })

    // 9. Side vertical neon edges
    gfx.moveTo(x - rx, y)
    gfx.lineTo(x - rx, y + thickness)
    gfx.stroke({ color, width: 1.5 * scale, alpha: s.verticalEdgeAlpha })
    gfx.moveTo(x + rx, y)
    gfx.lineTo(x + rx, y + thickness)
    gfx.stroke({ color, width: 1.5 * scale, alpha: s.verticalEdgeAlpha })

    // 10. Top face
    gfx.ellipse(x, y, rx, ry)
    gfx.fill({ color, alpha: s.topFaceAlpha })

    // 11. Top rim glow
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color, width: 5 * scale, alpha: s.topRimGlowAlpha })

    // 12. Top rim main
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color, width: 2.5 * scale, alpha: s.topRimMainAlpha })

    // 13. Top rim white core
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color: 0xffffff, width: 1 * scale, alpha: s.topRimWhiteAlpha })

    // 14. Drop shadow
    gfx.ellipse(x, y + thickness + 4 * scale, rx * 0.85, ry * 0.4)
    gfx.fill({ color: 0x000000, alpha: s.dropShadowAlpha })

    // 15. Wing lines
    const wingExtend = 30 * scale
    gfx.moveTo(x - rx - 2, y)
    gfx.lineTo(x - rx - wingExtend, y)
    gfx.stroke({ color, width: 1 * scale, alpha: s.wingLineAlpha })
    gfx.moveTo(x + rx + 2, y)
    gfx.lineTo(x + rx + wingExtend, y)
    gfx.stroke({ color, width: 1 * scale, alpha: s.wingLineAlpha })

    // 16. Pulsing approach glow
    if (depth > 0.7) {
      const intensity = (depth - 0.7) / 0.3
      const time = Date.now() * 0.008
      const pulse = 1 + Math.sin(time) * 0.2 * intensity
      gfx.ellipse(x, y, (rx + 16 * scale) * pulse, (ry + 8 * scale) * pulse)
      gfx.fill({ color, alpha: s.pulseGlowAlpha * intensity })
    }
  }

  /** Draw a missed note — red neon rim and red wing lines, fading out */
  private drawMissedNote(gfx: Graphics, x: number, y: number, scale: number, fadeAlpha: number, color: number) {
    gfx.clear()
    const rx = 96 * scale
    const ry = 40 * scale
    const thickness = 16 * scale
    const missRed = 0xff1744
    const a = fadeAlpha

    // 3D side band
    gfx.ellipse(x, y + thickness, rx, ry)
    gfx.fill({ color: missRed, alpha: a * 0.1 })
    gfx.rect(x - rx, y, rx * 2, thickness)
    gfx.fill({ color: missRed, alpha: a * 0.08 })

    // Dark body
    gfx.ellipse(x, y, rx, ry)
    gfx.fill({ color: 0x080818, alpha: a * 0.9 })

    // Red neon rim
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color: missRed, width: 6 * scale, alpha: a * 0.15 })
    gfx.ellipse(x, y, rx, ry)
    gfx.stroke({ color: missRed, width: 2.5 * scale, alpha: a * 0.6 })

    // Red wing lines
    const wingExtend = 30 * scale
    gfx.moveTo(x - rx - 2, y)
    gfx.lineTo(x - rx - wingExtend, y)
    gfx.stroke({ color: missRed, width: 1.5, alpha: a * 0.7 })
    gfx.moveTo(x - rx - 2, y)
    gfx.lineTo(x - rx - wingExtend, y)
    gfx.stroke({ color: missRed, width: 5, alpha: a * 0.12 })

    gfx.moveTo(x + rx + 2, y)
    gfx.lineTo(x + rx + wingExtend, y)
    gfx.stroke({ color: missRed, width: 1.5, alpha: a * 0.7 })
    gfx.moveTo(x + rx + 2, y)
    gfx.lineTo(x + rx + wingExtend, y)
    gfx.stroke({ color: missRed, width: 5, alpha: a * 0.12 })
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
