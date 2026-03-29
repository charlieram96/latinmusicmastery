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

interface NoteSprite {
  gfx: Graphics
  eventIndex: number
  timestamp: number
  laneIndex: number
  color: number
  duration: number // in seconds
  active: boolean
}

/**
 * Manages note sprites on the highway. Pre-allocates a pool of Graphics objects
 * and assigns them to exercise events as they enter the visible window.
 * Call update() each frame with the current exercise elapsed time.
 */
export class NoteManager {
  readonly container = new Container()

  private pool: NoteSprite[] = []
  private expectedEvents: ExpectedEvent[] = []
  private exerciseDuration = 0
  private laneSurfaces: string[] = []
  private highway: Highway
  private exerciseEvents: ExerciseEvent[] = []
  private laneCount = 3

  /** Set of event indices that have been graded (hit or missed) */
  private gradedIndices = new Set<number>()

  constructor(highway: Highway) {
    this.highway = highway
  }

  /** Initialize with an exercise definition. Creates the expected event timeline. */
  init(exercise: ExerciseDefinition, laneSurfaces: string[]) {
    this.laneSurfaces = laneSurfaces
    this.laneCount = laneSurfaces.length
    this.exerciseEvents = exercise.events
    this.expectedEvents = generateExpectedTimestamps(exercise)
    this.exerciseDuration = getExerciseDuration(exercise)

    // Pre-allocate sprite pool (enough for visible window)
    const maxVisible = Math.min(this.expectedEvents.length, 50)
    this.ensurePoolSize(maxVisible)

    // Reset graded set
    this.gradedIndices.clear()
  }

  /** Mark an event as graded so it can be visually removed/faded */
  markGraded(eventIndex: number) {
    this.gradedIndices.add(eventIndex)
  }

  /**
   * Update note positions based on current elapsed time.
   * elapsedSec: seconds since exercise started playing.
   */
  update(elapsedSec: number) {
    // Deactivate all sprites first
    for (const sprite of this.pool) {
      sprite.active = false
      sprite.gfx.visible = false
    }

    let poolIdx = 0

    for (const expected of this.expectedEvents) {
      const timeDiff = expected.timestamp - elapsedSec // positive = upcoming

      // Skip events outside visible window
      if (timeDiff < -0.5 || timeDiff > LOOK_AHEAD_SEC) continue

      // Skip graded events (already hit or missed)
      if (this.gradedIndices.has(expected.eventIndex)) continue

      // Map to a lane
      const originalEvent = this.getOriginalEvent(expected.eventIndex)
      const laneIndex = this.getLaneIndex(originalEvent)
      const color = this.getLaneColor(originalEvent)

      // Depth fraction: 0 = vanishing point (far), 1 = hit zone (near)
      const depthFraction = 1 - (timeDiff / LOOK_AHEAD_SEC)
      if (depthFraction < 0 || depthFraction > 1.15) continue

      // Get or allocate sprite
      if (poolIdx >= this.pool.length) {
        this.ensurePoolSize(this.pool.length + 10)
      }
      const sprite = this.pool[poolIdx++]
      sprite.active = true
      sprite.gfx.visible = true
      sprite.eventIndex = expected.eventIndex
      sprite.laneIndex = laneIndex
      sprite.color = color
      sprite.timestamp = expected.timestamp

      // Position
      const y = this.highway.depthToY(Math.min(depthFraction, 1))
      const x = this.highway.getLaneX(laneIndex, y)
      const scale = this.highway.getScaleAtDepth(Math.min(depthFraction, 1))
      const alpha = NOTE_MIN_ALPHA + (NOTE_MAX_ALPHA - NOTE_MIN_ALPHA) * Math.min(depthFraction, 1)

      // Draw note
      sprite.gfx.clear()
      const noteWidth = 40 * scale
      const noteHeight = 14 * scale
      sprite.gfx.roundRect(-noteWidth / 2, -noteHeight / 2, noteWidth, noteHeight, noteHeight / 2)
      sprite.gfx.fill({ color, alpha })

      // Glow
      sprite.gfx.roundRect(-noteWidth / 2 - 4, -noteHeight / 2 - 4, noteWidth + 8, noteHeight + 8, (noteHeight + 8) / 2)
      sprite.gfx.fill({ color, alpha: alpha * 0.2 })

      sprite.gfx.x = x
      sprite.gfx.y = y
    }
  }

  /** Get the lane index for a note that just got hit (for targeting effects) */
  getLaneForEvent(eventIndex: number): number {
    const originalEvent = this.getOriginalEvent(eventIndex)
    return this.getLaneIndex(originalEvent)
  }

  // ── Private ──

  private getOriginalEvent(eventIndex: number): ExerciseEvent | undefined {
    // eventIndex may span multiple loops, mod back to original events array
    const idx = eventIndex % this.exerciseEvents.length
    return this.exerciseEvents[idx]
  }

  private getLaneIndex(event: ExerciseEvent | undefined): number {
    if (!event) return 0
    // Try surface first (PlaySense mode)
    if (event.surface) {
      const idx = this.laneSurfaces.indexOf(event.surface)
      if (idx >= 0) return idx
    }
    // Try technique for percussion without surface
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
        duration: 0,
        active: false,
      })
    }
  }
}
