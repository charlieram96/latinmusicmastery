# PlaySense Rhythm Highway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current instrument visualization during gameplay with a PixiJS-powered Guitar Hero-style 3D highway that renders notes scrolling toward a hit zone with particle effects and a full game HUD.

**Architecture:** A self-contained `<RhythmHighway>` React component mounts a PixiJS canvas when `sessionState === 'playing'`. The existing `useExerciseSession` hook remains the single source of truth — PixiJS reads session data via refs (for 60fps perf) and never writes back. All scoring, onset detection, and state transitions stay untouched in React.

**Tech Stack:** PixiJS v8 (2D WebGL), React 19, TypeScript, Next.js 16

---

## File Structure

```
components/play-sense/rhythm-highway/
  constants.ts          — Colors, dimensions, particle configs, lane mappings
  Highway.ts            — Background: perspective road, gold edge rails, lane dividers, beat grid, starfield
  NoteManager.ts        — Note sprite creation/pooling/positioning, sustained note trails
  HitEffects.ts         — Particle bursts, floating grade text, receptor flashes, combo fire
  HUD.ts                — Score, combo, accuracy ring, progress bar, BPM display
  HighwayApp.ts         — PixiJS Application lifecycle, render loop, layer orchestration
  RhythmHighway.tsx     — React wrapper, ref bridging, mount/unmount lifecycle
```

**Modified:**
- `components/play-sense/exercise-player.tsx` — Swap `<VisualizationPanel>` for `<RhythmHighway>` when playing

---

## Task 1: Install PixiJS and Create Constants

**Files:**
- Create: `components/play-sense/rhythm-highway/constants.ts`

- [ ] **Step 1: Install pixi.js**

```bash
npm install pixi.js@^8
```

Expected: Package installs successfully, `pixi.js` appears in `package.json` dependencies.

- [ ] **Step 2: Create constants file**

```typescript
// components/play-sense/rhythm-highway/constants.ts
import type { HitGrade } from '@/lib/play-sense/types'

// ── Highway geometry ──
/** Fraction of canvas height where the hit zone line sits (from bottom) */
export const HIT_ZONE_Y_FRACTION = 0.85
/** Width of the highway at the hit zone (fraction of canvas width) */
export const HIGHWAY_BOTTOM_WIDTH = 0.6
/** Width of the highway at the vanishing point (fraction of canvas width) */
export const HIGHWAY_TOP_WIDTH = 0.08
/** Vertical position of the vanishing point (fraction of canvas height) */
export const VANISHING_POINT_Y = 0.25
/** How many seconds of upcoming notes are visible on the highway */
export const LOOK_AHEAD_SEC = 3.0

// ── Lane colors ──
export const LANE_COLORS: Record<string, number> = {
  // Conga
  quinto: 0xe74c3c,
  conga: 0x3498db,
  tumba: 0x2ecc71,
  // Timbale
  macho: 0xe74c3c,
  hembra: 0x3498db,
  campana: 0xf1c40f,
  cencerro: 0xe67e22,
  jamblock: 0x9b59b6,
  cascara: 0x1abc9c,
  // Fallback for technique-based lanes
  open: 0x3498db,
  slap: 0xe74c3c,
  mute: 0x9b59b6,
  bass: 0x2ecc71,
  touch: 0x1abc9c,
  rim: 0xf1c40f,
  shell: 0xe67e22,
  bell: 0xf39c12,
  tip: 0x3498db,
  heel: 0x9b59b6,
}

/** Default lane color when surface/technique not found */
export const DEFAULT_LANE_COLOR = 0x3498db

// ── Grade colors (hex numbers for PixiJS) ──
export const GRADE_COLORS_HEX: Record<HitGrade, number> = {
  perfect: 0xffd93d,
  good: 0xeab308,
  ok: 0xf97316,
  miss: 0xef4444,
}

// ── Grade labels ──
export const GRADE_LABELS: Record<HitGrade, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  ok: 'OK',
  miss: 'MISS',
}

// ── Grade point display ──
export const GRADE_POINTS_DISPLAY: Record<HitGrade, string> = {
  perfect: '+100',
  good: '+70',
  ok: '+40',
  miss: '',
}

// ── Particle configs ──
export const PARTICLE_COUNTS: Record<HitGrade, number> = {
  perfect: 12,
  good: 8,
  ok: 4,
  miss: 0,
}

export const PARTICLE_LIFETIME_SEC = 0.5
export const COMBO_FIRE_THRESHOLD = 10

// ── Highway visual ──
export const RAIL_COLOR = 0xd4a854
export const RAIL_GLOW_ALPHA = 0.3
export const GRID_LINE_ALPHA = 0.08
export const BG_COLOR_TOP = 0x050510
export const BG_COLOR_BOTTOM = 0x1a0f2e
export const STARFIELD_COUNT = 40
export const NOTE_MIN_SCALE = 0.3
export const NOTE_MAX_SCALE = 1.0
export const NOTE_MIN_ALPHA = 0.3
export const NOTE_MAX_ALPHA = 1.0

// ── HUD ──
export const HUD_FONT_FAMILY = 'Inter, system-ui, sans-serif'
export const HUD_SCORE_SIZE = 32
export const HUD_COMBO_SIZE = 36
export const HUD_LABEL_SIZE = 10
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json components/play-sense/rhythm-highway/constants.ts
git commit -m "feat(playsense): install pixi.js and add rhythm highway constants"
```

---

## Task 2: Highway Background Renderer

**Files:**
- Create: `components/play-sense/rhythm-highway/Highway.ts`

- [ ] **Step 1: Create Highway class**

This class renders the static + animated background: perspective road, edge rails, lane dividers, beat grid lines, and starfield particles.

```typescript
// components/play-sense/rhythm-highway/Highway.ts
import { Container, Graphics } from 'pixi.js'
import {
  HIT_ZONE_Y_FRACTION,
  HIGHWAY_BOTTOM_WIDTH,
  HIGHWAY_TOP_WIDTH,
  VANISHING_POINT_Y,
  RAIL_COLOR,
  RAIL_GLOW_ALPHA,
  GRID_LINE_ALPHA,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STARFIELD_COUNT,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
} from './constants'

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  color: number
}

/**
 * Renders the highway background: perspective road, rails, lane dividers,
 * beat grid, and starfield. Call resize() when canvas dimensions change,
 * and update() each frame with the current beat fraction for grid scrolling.
 */
export class Highway {
  readonly container = new Container()

  private bg = new Graphics()
  private road = new Graphics()
  private rails = new Graphics()
  private dividers = new Graphics()
  private gridLines = new Graphics()
  private starfield = new Graphics()

  private stars: Star[] = []
  private width = 0
  private height = 0
  private laneCount = 3
  private laneSurfaces: string[] = []

  constructor() {
    this.container.addChild(this.bg, this.starfield, this.road, this.rails, this.dividers, this.gridLines)
    this.initStars()
  }

  /** Set the lane configuration based on the instrument's surfaces */
  setLanes(surfaces: string[]) {
    this.laneSurfaces = surfaces
    this.laneCount = surfaces.length
    if (this.width > 0) this.draw()
  }

  /** Recalculate geometry on canvas resize */
  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.draw()
  }

  /** Animate beat grid scrolling. beatFraction is 0-1 within the current beat. */
  update(beatFraction: number) {
    this.drawGrid(beatFraction)
    this.drawStarfield()
  }

  /** Get the X position for a given lane index at a given Y position */
  getLaneX(laneIndex: number, y: number): number {
    const t = this.getDepthT(y)
    const halfWidth = this.getHalfWidthAtT(t)
    const cx = this.width / 2
    const laneWidth = (halfWidth * 2) / this.laneCount
    return cx - halfWidth + laneWidth * (laneIndex + 0.5)
  }

  /** Get the hit zone Y in pixels */
  getHitZoneY(): number {
    return this.height * HIT_ZONE_Y_FRACTION
  }

  /** Get the vanishing point Y in pixels */
  getVanishingY(): number {
    return this.height * VANISHING_POINT_Y
  }

  /** Map a depth fraction (0=vanishing, 1=hit zone) to a Y pixel */
  depthToY(depthFraction: number): number {
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    // Use quadratic easing for perspective foreshortening
    const t = depthFraction * depthFraction
    return vanishY + t * (hitY - vanishY)
  }

  /** Get the note scale at a given depth fraction */
  getScaleAtDepth(depthFraction: number): number {
    return 0.3 + depthFraction * 0.7
  }

  // ── Private ──

  private getDepthT(y: number): number {
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    if (hitY === vanishY) return 0
    return Math.max(0, Math.min(1, (y - vanishY) / (hitY - vanishY)))
  }

  private getHalfWidthAtT(t: number): number {
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2
    return halfTop + t * (halfBottom - halfTop)
  }

  private draw() {
    this.drawBackground()
    this.drawRoad()
    this.drawRails()
    this.drawDividers()
    this.drawGrid(0)
  }

  private drawBackground() {
    this.bg.clear()
    // Vertical gradient: dark at top, slightly purple at bottom
    this.bg.rect(0, 0, this.width, this.height)
    this.bg.fill(BG_COLOR_TOP)
    // Overlay gradient toward bottom
    const grd = this.bg
    grd.rect(0, this.height * 0.5, this.width, this.height * 0.5)
    grd.fill({ color: BG_COLOR_BOTTOM, alpha: 0.4 })
  }

  private drawRoad() {
    this.road.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2

    // Road surface — semi-transparent dark fill
    this.road.moveTo(cx - halfTop, vanishY)
    this.road.lineTo(cx + halfTop, vanishY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.lineTo(cx - halfBottom, hitY)
    this.road.closePath()
    this.road.fill({ color: 0x140a28, alpha: 0.6 })
  }

  private drawRails() {
    this.rails.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2

    // Left rail
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 3, alpha: 0.6 })

    // Right rail
    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 3, alpha: 0.6 })

    // Rail glow (wider, lower alpha)
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 8, alpha: RAIL_GLOW_ALPHA * 0.5 })

    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 8, alpha: RAIL_GLOW_ALPHA * 0.5 })
  }

  private drawDividers() {
    this.dividers.clear()
    if (this.laneCount <= 1) return

    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const steps = 20

    for (let lane = 1; lane < this.laneCount; lane++) {
      for (let i = 0; i < steps; i++) {
        const t1 = i / steps
        const t2 = (i + 1) / steps
        const y1 = vanishY + t1 * (hitY - vanishY)
        const y2 = vanishY + t2 * (hitY - vanishY)
        const x1 = this.getLaneX(lane, y1) - this.getLaneX(0, y1) + this.getLaneX(0, y1)
        // Recalculate: lane divider is between lane-1 and lane
        const halfW1 = this.getHalfWidthAtT(t1)
        const halfW2 = this.getHalfWidthAtT(t2)
        const cx = this.width / 2
        const laneW1 = (halfW1 * 2) / this.laneCount
        const laneW2 = (halfW2 * 2) / this.laneCount
        const dx1 = cx - halfW1 + laneW1 * lane
        const dx2 = cx - halfW2 + laneW2 * lane
        const alpha = 0.03 + t1 * 0.09 // Fade in as it gets closer

        this.dividers.moveTo(dx1, y1)
        this.dividers.lineTo(dx2, y2)
        this.dividers.stroke({ color: 0xffffff, width: 1, alpha })
      }
    }
  }

  private drawGrid(beatFraction: number) {
    this.gridLines.clear()
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const gridCount = 8
    const cx = this.width / 2

    for (let i = 0; i < gridCount; i++) {
      // Offset by beat fraction so grid scrolls
      let t = ((i + beatFraction) / gridCount)
      if (t > 1) t -= 1

      // Apply perspective compression (quadratic)
      const y = vanishY + t * t * (hitY - vanishY)
      const halfW = this.getHalfWidthAtT(t * t)
      const alpha = GRID_LINE_ALPHA * t

      this.gridLines.moveTo(cx - halfW, y)
      this.gridLines.lineTo(cx + halfW, y)
      this.gridLines.stroke({ color: 0xffffff, width: 1, alpha })
    }

    // Hit zone line — bright gold
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 4, alpha: 0.8 })

    // Hit zone glow
    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 12, alpha: 0.2 })
  }

  private initStars() {
    this.stars = Array.from({ length: STARFIELD_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.5, // Top half only
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.3,
      color: [0xffffff, 0xd4a854, 0x9b59b6, 0x3498db][Math.floor(Math.random() * 4)],
    }))
  }

  private drawStarfield() {
    this.starfield.clear()
    for (const star of this.stars) {
      // Gentle twinkle
      const flicker = star.alpha + Math.sin(Date.now() * 0.002 + star.x * 100) * 0.1
      this.starfield.circle(star.x * this.width, star.y * this.height, star.size)
      this.starfield.fill({ color: star.color, alpha: Math.max(0, flicker) })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/Highway.ts
git commit -m "feat(playsense): add Highway background renderer with perspective road and starfield"
```

---

## Task 3: Note Manager with Sprite Pooling

**Files:**
- Create: `components/play-sense/rhythm-highway/NoteManager.ts`

- [ ] **Step 1: Create NoteManager class**

Manages note sprites: creates them from exercise events, positions them each frame based on playhead progress, and recycles sprites via an object pool.

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/NoteManager.ts
git commit -m "feat(playsense): add NoteManager with sprite pooling and perspective positioning"
```

---

## Task 4: Hit Effects and Particle System

**Files:**
- Create: `components/play-sense/rhythm-highway/HitEffects.ts`

- [ ] **Step 1: Create HitEffects class**

Manages particle bursts on hit, floating grade text, receptor flashes, and combo fire embers.

```typescript
// components/play-sense/rhythm-highway/HitEffects.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { HitGrade } from '@/lib/play-sense/types'
import {
  GRADE_COLORS_HEX,
  GRADE_LABELS,
  GRADE_POINTS_DISPLAY,
  PARTICLE_COUNTS,
  PARTICLE_LIFETIME_SEC,
  COMBO_FIRE_THRESHOLD,
  RAIL_COLOR,
  HUD_FONT_FAMILY,
  HIGHWAY_BOTTOM_WIDTH,
  HIT_ZONE_Y_FRACTION,
} from './constants'
import type { Highway } from './Highway'

interface Particle {
  gfx: Graphics
  vx: number
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface FloatingText {
  text: Text
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface ReceptorFlash {
  gfx: Graphics
  life: number
  active: boolean
  laneIndex: number
}

interface Ember {
  gfx: Graphics
  x: number
  y: number
  vy: number
  life: number
  active: boolean
}

/**
 * Visual effects layer: particle bursts, floating grade text, receptor flashes,
 * and combo fire embers. Call triggerHit() when a note is hit, and update() each frame.
 */
export class HitEffects {
  readonly container = new Container()

  private particles: Particle[] = []
  private floatingTexts: FloatingText[] = []
  private receptorFlashes: ReceptorFlash[] = []
  private embers: Ember[] = []
  private highway: Highway
  private laneCount = 3
  private width = 0
  private height = 0

  constructor(highway: Highway) {
    this.highway = highway
    // Pre-allocate particles
    for (let i = 0; i < 60; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.particles.push({ gfx, vx: 0, vy: 0, life: 0, maxLife: 0, active: false })
    }
    // Pre-allocate floating texts
    for (let i = 0; i < 8; i++) {
      const text = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: HUD_FONT_FAMILY,
          fontSize: 24,
          fontWeight: '900',
          fill: 0xffffff,
          letterSpacing: 3,
        }),
      })
      text.anchor.set(0.5)
      text.visible = false
      this.container.addChild(text)
      this.floatingTexts.push({ text, vy: 0, life: 0, maxLife: 0, active: false })
    }
    // Pre-allocate receptor flashes
    for (let i = 0; i < 6; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.receptorFlashes.push({ gfx, life: 0, active: false, laneIndex: 0 })
    }
    // Pre-allocate embers
    for (let i = 0; i < 20; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.embers.push({ gfx, x: 0, y: 0, vy: 0, life: 0, active: false })
    }
  }

  setLaneCount(count: number) {
    this.laneCount = count
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /** Trigger visual effects for a hit on a specific lane */
  triggerHit(laneIndex: number, grade: HitGrade) {
    const hitY = this.highway.getHitZoneY()
    const x = this.highway.getLaneX(laneIndex, hitY)

    // Particle burst
    this.spawnParticles(x, hitY, grade)

    // Floating grade text
    this.spawnGradeText(x, hitY - 30, grade)

    // Receptor flash
    this.spawnReceptorFlash(laneIndex, grade)
  }

  /** Spawn combo fire embers along the rails */
  updateComboFire(combo: number) {
    if (combo < COMBO_FIRE_THRESHOLD) return
    // Spawn an ember on each rail occasionally
    if (Math.random() > 0.3) return

    const hitY = this.highway.getHitZoneY()
    const cx = this.width / 2
    const halfW = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const side = Math.random() > 0.5 ? 1 : -1
    const x = cx + side * halfW

    const ember = this.embers.find(e => !e.active)
    if (!ember) return

    ember.active = true
    ember.x = x + (Math.random() - 0.5) * 6
    ember.y = hitY
    ember.vy = -(1 + Math.random() * 2)
    ember.life = 1.0
    ember.gfx.visible = true
  }

  /** Update all active effects. dt is delta time in seconds. */
  update(dt: number) {
    // Particles
    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.gfx.visible = false
        continue
      }
      p.gfx.x += p.vx * dt * 60
      p.gfx.y += p.vy * dt * 60
      p.gfx.alpha = p.life / p.maxLife
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      if (!ft.active) continue
      ft.life -= dt
      if (ft.life <= 0) {
        ft.active = false
        ft.text.visible = false
        continue
      }
      ft.text.y += ft.vy * dt * 60
      const progress = 1 - ft.life / ft.maxLife
      // Fade in quickly, hold, then fade out
      if (progress < 0.15) {
        ft.text.alpha = progress / 0.15
      } else if (progress > 0.6) {
        ft.text.alpha = (1 - progress) / 0.4
      } else {
        ft.text.alpha = 1
      }
      ft.text.scale.set(1 + Math.sin(progress * Math.PI) * 0.1)
    }

    // Receptor flashes
    for (const rf of this.receptorFlashes) {
      if (!rf.active) continue
      rf.life -= dt
      if (rf.life <= 0) {
        rf.active = false
        rf.gfx.visible = false
        continue
      }
      rf.gfx.alpha = rf.life / 0.2
    }

    // Embers
    for (const e of this.embers) {
      if (!e.active) continue
      e.life -= dt
      if (e.life <= 0) {
        e.active = false
        e.gfx.visible = false
        continue
      }
      e.y += e.vy * dt * 60
      e.x += (Math.random() - 0.5) * 0.5
      e.gfx.clear()
      const size = 1.5 + e.life * 2
      e.gfx.circle(0, 0, size)
      e.gfx.fill({ color: RAIL_COLOR, alpha: e.life * 0.6 })
      e.gfx.x = e.x
      e.gfx.y = e.y
    }
  }

  // ── Private ──

  private spawnParticles(x: number, y: number, grade: HitGrade) {
    const count = PARTICLE_COUNTS[grade]
    const color = GRADE_COLORS_HEX[grade]

    for (let i = 0; i < count; i++) {
      const p = this.particles.find(p => !p.active)
      if (!p) break

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 2 + Math.random() * 3

      p.active = true
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed - 1 // Bias upward
      p.life = PARTICLE_LIFETIME_SEC
      p.maxLife = PARTICLE_LIFETIME_SEC
      p.gfx.visible = true
      p.gfx.clear()
      const size = 2 + Math.random() * 2
      p.gfx.circle(0, 0, size)
      p.gfx.fill(color)
      p.gfx.x = x
      p.gfx.y = y
    }
  }

  private spawnGradeText(x: number, y: number, grade: HitGrade) {
    const ft = this.floatingTexts.find(f => !f.active)
    if (!ft) return

    const label = GRADE_LABELS[grade]
    const points = GRADE_POINTS_DISPLAY[grade]
    const displayText = points ? `${label}\n${points}` : label

    ft.active = true
    ft.text.text = displayText
    ft.text.style.fill = GRADE_COLORS_HEX[grade]
    ft.text.style.fontSize = grade === 'perfect' ? 28 : 22
    ft.text.x = x
    ft.text.y = y
    ft.text.alpha = 0
    ft.text.visible = true
    ft.vy = -1.2
    ft.life = 1.0
    ft.maxLife = 1.0
  }

  private spawnReceptorFlash(laneIndex: number, grade: HitGrade) {
    const rf = this.receptorFlashes.find(r => !r.active)
    if (!rf) return

    const hitY = this.highway.getHitZoneY()
    const x = this.highway.getLaneX(laneIndex, hitY)
    const scale = this.highway.getScaleAtDepth(1)
    const w = 50 * scale
    const h = 28 * scale
    const color = GRADE_COLORS_HEX[grade]

    rf.active = true
    rf.life = 0.2
    rf.laneIndex = laneIndex
    rf.gfx.visible = true
    rf.gfx.clear()
    rf.gfx.roundRect(-w / 2, -h / 2, w, h, 6)
    rf.gfx.fill({ color, alpha: 0.3 })
    rf.gfx.roundRect(-w / 2, -h / 2, w, h, 6)
    rf.gfx.stroke({ color, width: 2, alpha: 0.8 })
    rf.gfx.x = x
    rf.gfx.y = hitY
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/HitEffects.ts
git commit -m "feat(playsense): add HitEffects with particle bursts, grade text, and combo fire"
```

---

## Task 5: HUD Renderer

**Files:**
- Create: `components/play-sense/rhythm-highway/HUD.ts`

- [ ] **Step 1: Create HUD class**

Renders score, combo counter, accuracy ring, progress bar, and exercise info — all in PixiJS.

```typescript
// components/play-sense/rhythm-highway/HUD.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import {
  HUD_FONT_FAMILY,
  HUD_SCORE_SIZE,
  HUD_COMBO_SIZE,
  HUD_LABEL_SIZE,
  RAIL_COLOR,
  COMBO_FIRE_THRESHOLD,
} from './constants'

/**
 * In-canvas HUD: score, combo, accuracy ring, progress bar, BPM/title.
 * Call resize() on canvas resize, update() each frame with current values.
 */
export class HUD {
  readonly container = new Container()

  // Score (top-right)
  private scoreText: Text
  private scoreLabelText: Text
  private scorePopText: Text
  private scorePopLife = 0

  // Combo (top-left)
  private comboText: Text
  private comboLabelText: Text
  private comboBar = new Graphics()
  private comboBarBg = new Graphics()

  // Accuracy ring (top-center)
  private accuracyText: Text
  private accuracyRing = new Graphics()

  // Progress bar (bottom)
  private progressBg = new Graphics()
  private progressFill = new Graphics()
  private timeLeftText: Text
  private timeRightText: Text
  private titleText: Text
  private bpmText: Text

  private width = 0
  private height = 0
  private lastScore = 0

  constructor() {
    const labelStyle = new TextStyle({
      fontFamily: HUD_FONT_FAMILY,
      fontSize: HUD_LABEL_SIZE,
      fontWeight: '600',
      fill: 0xffffff,
      letterSpacing: 2,
    })

    // Score
    this.scoreText = new Text({
      text: '0',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: HUD_SCORE_SIZE, fontWeight: '900', fill: 0xffffff }),
    })
    this.scoreText.anchor.set(1, 0)
    this.scoreLabelText = new Text({ text: 'SCORE', style: { ...labelStyle, alpha: 0.4 } as TextStyle })
    this.scoreLabelText.anchor.set(1, 0)
    this.scoreLabelText.alpha = 0.4
    this.scorePopText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 14, fontWeight: '700', fill: RAIL_COLOR }),
    })
    this.scorePopText.anchor.set(1, 0)
    this.scorePopText.visible = false

    // Combo
    this.comboText = new Text({
      text: '0',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: HUD_COMBO_SIZE, fontWeight: '900', fill: 0x2ecc71 }),
    })
    this.comboLabelText = new Text({ text: 'COMBO', style: { ...labelStyle } as TextStyle })
    this.comboLabelText.alpha = 0.7
    this.comboLabelText.style.fill = 0x2ecc71

    // Accuracy
    this.accuracyText = new Text({
      text: '100%',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 14, fontWeight: '800', fill: 0x2ecc71 }),
    })
    this.accuracyText.anchor.set(0.5)

    // Progress
    this.timeLeftText = new Text({
      text: '0:00',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff }),
    })
    this.timeLeftText.alpha = 0.4
    this.timeRightText = new Text({
      text: '0:00',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff }),
    })
    this.timeRightText.anchor.set(1, 0)
    this.timeRightText.alpha = 0.4
    this.titleText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff, letterSpacing: 1 }),
    })
    this.titleText.anchor.set(0.5, 0)
    this.titleText.alpha = 0.3
    this.bpmText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff, letterSpacing: 1 }),
    })
    this.bpmText.anchor.set(0.5, 0)
    this.bpmText.alpha = 0.3

    this.container.addChild(
      this.comboBarBg, this.comboBar,
      this.scoreText, this.scoreLabelText, this.scorePopText,
      this.comboText, this.comboLabelText,
      this.accuracyRing, this.accuracyText,
      this.progressBg, this.progressFill,
      this.timeLeftText, this.timeRightText, this.titleText, this.bpmText,
    )
  }

  /** Set exercise info (call once on init) */
  setExerciseInfo(title: string, bpm: number) {
    this.titleText.text = title.toUpperCase()
    this.bpmText.text = `♩ ${bpm} BPM`
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
  }

  /**
   * Update HUD values each frame.
   * progress: 0-1, elapsed/total in seconds
   */
  update(
    score: number,
    combo: number,
    accuracy: number,
    progress: number,
    elapsedSec: number,
    totalSec: number,
    dt: number,
  ) {
    // Score
    if (score !== this.lastScore) {
      const diff = score - this.lastScore
      if (diff > 0) {
        this.scorePopText.text = `+${diff}`
        this.scorePopText.visible = true
        this.scorePopLife = 0.6
      }
      this.lastScore = score
    }
    this.scoreText.text = score.toLocaleString()

    // Score pop animation
    if (this.scorePopLife > 0) {
      this.scorePopLife -= dt
      this.scorePopText.alpha = Math.max(0, this.scorePopLife / 0.6)
      if (this.scorePopLife <= 0) this.scorePopText.visible = false
    }

    // Combo
    this.comboText.text = String(combo)
    const comboColor = combo >= COMBO_FIRE_THRESHOLD ? 0xffd93d : 0x2ecc71
    this.comboText.style.fill = comboColor
    this.comboLabelText.style.fill = comboColor

    // Combo bar
    this.comboBar.clear()
    const barWidth = 120
    const barFill = Math.min(combo / COMBO_FIRE_THRESHOLD, 1)
    this.comboBar.roundRect(20, 60, barWidth * barFill, 4, 2)
    if (combo >= COMBO_FIRE_THRESHOLD) {
      this.comboBar.fill(0xffd93d)
    } else {
      this.comboBar.fill(0x2ecc71)
    }

    // Accuracy
    const accPct = Math.round(accuracy)
    this.accuracyText.text = `${accPct}%`
    this.drawAccuracyRing(accuracy / 100)

    // Progress
    this.drawProgress(progress)
    this.timeLeftText.text = this.formatTime(elapsedSec)
    this.timeRightText.text = this.formatTime(totalSec)
  }

  // ── Private ──

  private layout() {
    const pad = 20

    // Score — top right
    this.scoreText.x = this.width - pad
    this.scoreText.y = pad
    this.scoreLabelText.x = this.width - pad
    this.scoreLabelText.y = pad + HUD_SCORE_SIZE + 2
    this.scorePopText.x = this.width - pad
    this.scorePopText.y = pad + HUD_SCORE_SIZE + 16

    // Combo — top left
    this.comboText.x = pad
    this.comboText.y = pad
    this.comboLabelText.x = pad + 50
    this.comboLabelText.y = pad + HUD_COMBO_SIZE - HUD_LABEL_SIZE - 2

    // Combo bar bg
    this.comboBarBg.clear()
    this.comboBarBg.roundRect(pad, 60, 120, 4, 2)
    this.comboBarBg.fill({ color: 0xffffff, alpha: 0.1 })

    // Accuracy ring — top center
    this.accuracyRing.x = this.width / 2
    this.accuracyRing.y = pad + 24
    this.accuracyText.x = this.width / 2
    this.accuracyText.y = pad + 24

    // Progress — bottom
    const bottomY = this.height - 30
    this.timeLeftText.x = pad
    this.timeLeftText.y = bottomY
    this.timeRightText.x = this.width - pad
    this.timeRightText.y = bottomY
    this.titleText.x = this.width / 2
    this.titleText.y = bottomY - 16
    this.bpmText.x = this.width / 2
    this.bpmText.y = this.height * 0.12
  }

  private drawAccuracyRing(fraction: number) {
    this.accuracyRing.clear()
    const r = 22
    // Background ring
    this.accuracyRing.circle(0, 0, r)
    this.accuracyRing.stroke({ color: 0xffffff, width: 3, alpha: 0.1 })
    // Fill arc
    if (fraction > 0) {
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + Math.PI * 2 * fraction
      this.accuracyRing.arc(0, 0, r, startAngle, endAngle)
      this.accuracyRing.stroke({ color: 0x2ecc71, width: 3, alpha: 0.6 })
    }
  }

  private drawProgress(fraction: number) {
    const pad = 20
    const y = this.height - 18
    const w = this.width - pad * 2

    this.progressBg.clear()
    this.progressBg.roundRect(pad, y, w, 3, 1.5)
    this.progressBg.fill({ color: 0xffffff, alpha: 0.08 })

    this.progressFill.clear()
    if (fraction > 0) {
      this.progressFill.roundRect(pad, y, w * Math.min(fraction, 1), 3, 1.5)
      this.progressFill.fill(RAIL_COLOR)
    }
  }

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/HUD.ts
git commit -m "feat(playsense): add in-canvas HUD with score, combo, accuracy ring, and progress bar"
```

---

## Task 6: HighwayApp — PixiJS Application Orchestrator

**Files:**
- Create: `components/play-sense/rhythm-highway/HighwayApp.ts`

- [ ] **Step 1: Create HighwayApp class**

Orchestrates all layers: creates the PixiJS Application, manages the render loop, and exposes methods for the React wrapper.

```typescript
// components/play-sense/rhythm-highway/HighwayApp.ts
import { Application } from 'pixi.js'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { PLAYSENSE_MAPPINGS } from '@/lib/play-sense/playsense-mappings'
import { Highway } from './Highway'
import { NoteManager } from './NoteManager'
import { HitEffects } from './HitEffects'
import { HUD } from './HUD'

/**
 * Top-level PixiJS application for the rhythm highway.
 * Create with HighwayApp.create(), then call init() with an exercise.
 * The render loop reads from refs provided by the React wrapper.
 */
export class HighwayApp {
  private app: Application
  private highway: Highway
  private noteManager: NoteManager
  private hitEffects: HitEffects
  private hud: HUD

  private exerciseDuration = 0
  private destroyed = false

  // Refs set by React wrapper — read each frame
  playheadProgress = 0
  currentScore = 0
  currentCombo = 0
  currentAccuracy = 100
  metronomeBeat = 0
  private lastMetronomeBeat = 0

  private constructor(app: Application) {
    this.app = app

    this.highway = new Highway()
    this.noteManager = new NoteManager(this.highway)
    this.hitEffects = new HitEffects(this.highway)
    this.hud = new HUD()

    // Layer order: highway (bg) → notes → effects → hud (top)
    app.stage.addChild(
      this.highway.container,
      this.noteManager.container,
      this.hitEffects.container,
      this.hud.container,
    )
  }

  /**
   * Factory: creates the PixiJS Application and attaches it to the given container.
   */
  static async create(container: HTMLDivElement): Promise<HighwayApp> {
    const app = new Application()
    await app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    container.appendChild(app.canvas as HTMLCanvasElement)

    const instance = new HighwayApp(app)
    instance.resize()

    // Watch for resizes
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container)
    // Store observer reference for cleanup
    ;(instance as any)._resizeObserver = observer

    // Start render loop
    app.ticker.add((ticker) => {
      if (!instance.destroyed) {
        instance.update(ticker.deltaMS / 1000)
      }
    })

    return instance
  }

  /** Initialize with an exercise. Call once before gameplay starts. */
  init(exercise: ExerciseDefinition) {
    this.exerciseDuration = getExerciseDuration(exercise)

    // Determine lane surfaces
    const laneSurfaces = this.getLaneSurfaces(exercise)

    this.highway.setLanes(laneSurfaces)
    this.noteManager.init(exercise, laneSurfaces)
    this.hitEffects.setLaneCount(laneSurfaces.length)
    this.hud.setExerciseInfo(exercise.title, exercise.bpm)
  }

  /** Called by React when a hit is detected */
  triggerHitEffect(eventIndex: number, grade: HitGrade) {
    const laneIndex = this.noteManager.getLaneForEvent(eventIndex)
    this.noteManager.markGraded(eventIndex)
    this.hitEffects.triggerHit(laneIndex, grade)
  }

  /** Called by React when a miss is detected */
  triggerMiss(eventIndex: number) {
    this.noteManager.markGraded(eventIndex)
    const laneIndex = this.noteManager.getLaneForEvent(eventIndex)
    this.hitEffects.triggerHit(laneIndex, 'miss')
  }

  /** Destroy the PixiJS application and free resources */
  destroy() {
    this.destroyed = true
    const observer = (this as any)._resizeObserver as ResizeObserver | undefined
    observer?.disconnect()
    this.app.destroy(true, { children: true, texture: true })
  }

  // ── Private ──

  private resize() {
    const w = this.app.screen.width
    const h = this.app.screen.height
    this.highway.resize(w, h)
    this.hitEffects.resize(w, h)
    this.hud.resize(w, h)
  }

  private update(dt: number) {
    const elapsed = this.playheadProgress * this.exerciseDuration

    // Beat fraction for grid scrolling
    const beat = this.metronomeBeat
    const beatFraction = beat % 1 || 0

    this.highway.update(beatFraction)
    this.noteManager.update(elapsed)
    this.hitEffects.updateComboFire(this.currentCombo)
    this.hitEffects.update(dt)
    this.hud.update(
      this.currentScore,
      this.currentCombo,
      this.currentAccuracy,
      this.playheadProgress,
      elapsed,
      this.exerciseDuration,
      dt,
    )
  }

  private getLaneSurfaces(exercise: ExerciseDefinition): string[] {
    // Check for PlaySense mapping first
    const mapping = PLAYSENSE_MAPPINGS[exercise.instrument]
    if (mapping) {
      return Object.values(mapping.piezoMap)
    }

    // For percussion without PlaySense mapping, use unique techniques from events
    const category = getInstrumentCategory(exercise.instrument)
    if (category === 'percussion') {
      const techniques = [...new Set(exercise.events.map(e => e.surface || e.technique))]
      return techniques.length > 0 ? techniques : ['open', 'slap', 'mute']
    }

    // For melodic instruments, use pitch-based lanes
    // Group notes into ranges (e.g., low, mid-low, mid, mid-high, high)
    const pitches = exercise.events
      .filter(e => e.expectedPitch != null)
      .map(e => e.expectedPitch!)
    if (pitches.length === 0) return ['low', 'mid', 'high']

    const minPitch = Math.min(...pitches)
    const maxPitch = Math.max(...pitches)
    const range = maxPitch - minPitch
    if (range <= 4) return ['low', 'mid', 'high']
    if (range <= 8) return ['low', 'mid-low', 'mid', 'mid-high', 'high']
    return ['low', 'mid-low', 'mid', 'mid-high', 'high', 'high+']
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/HighwayApp.ts
git commit -m "feat(playsense): add HighwayApp orchestrator with render loop and layer management"
```

---

## Task 7: React Wrapper Component

**Files:**
- Create: `components/play-sense/rhythm-highway/RhythmHighway.tsx`

- [ ] **Step 1: Create RhythmHighway React component**

Bridges React session state to the PixiJS render loop via refs. Mounts the canvas on render, destroys on unmount.

```tsx
// components/play-sense/rhythm-highway/RhythmHighway.tsx
'use client'

import { useEffect, useRef } from 'react'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { HighwayApp } from './HighwayApp'

interface RhythmHighwayProps {
  exercise: ExerciseDefinition
  playheadProgress: number
  currentScore: number
  currentCombo: number
  currentAccuracy: number
  metronomeBeat: number
  lastHitGrade: string | null
  eventResultsLength: number
  eventResults: Array<{ eventIndex: number; grade: HitGrade }>
}

/**
 * React wrapper for the PixiJS rhythm highway.
 * Mounts a full-bleed canvas and bridges session state via refs.
 */
export function RhythmHighway({
  exercise,
  playheadProgress,
  currentScore,
  currentCombo,
  currentAccuracy,
  metronomeBeat,
  lastHitGrade,
  eventResultsLength,
  eventResults,
}: RhythmHighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HighwayApp | null>(null)
  const prevEventCountRef = useRef(0)

  // Mount PixiJS app
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let app: HighwayApp | null = null
    let mounted = true

    HighwayApp.create(container).then((instance) => {
      if (!mounted) {
        instance.destroy()
        return
      }
      app = instance
      appRef.current = instance
      instance.init(exercise)
    })

    return () => {
      mounted = false
      if (app) {
        app.destroy()
        appRef.current = null
      }
    }
  }, [exercise])

  // Sync reactive values to PixiJS refs (every render, no re-mount)
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    app.playheadProgress = playheadProgress
    app.currentScore = currentScore
    app.currentCombo = currentCombo
    app.currentAccuracy = currentAccuracy
    app.metronomeBeat = metronomeBeat
  })

  // Trigger hit effects when new event results arrive
  useEffect(() => {
    const app = appRef.current
    if (!app) return

    const newCount = eventResultsLength
    if (newCount > prevEventCountRef.current) {
      // Process new results
      for (let i = prevEventCountRef.current; i < newCount; i++) {
        const result = eventResults[i]
        if (result) {
          if (result.grade === 'miss') {
            app.triggerMiss(result.eventIndex)
          } else {
            app.triggerHitEffect(result.eventIndex, result.grade)
          }
        }
      }
      prevEventCountRef.current = newCount
    }
  }, [eventResultsLength, eventResults])

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/RhythmHighway.tsx
git commit -m "feat(playsense): add RhythmHighway React wrapper with ref bridging"
```

---

## Task 8: Integrate into ExercisePlayer

**Files:**
- Modify: `components/play-sense/exercise-player.tsx`

- [ ] **Step 1: Import RhythmHighway and add it to the playing state**

In `exercise-player.tsx`, add the import at the top:

```typescript
import { RhythmHighway } from './rhythm-highway/RhythmHighway'
```

Then replace the `<VisualizationPanel>` usage when `sessionState === 'playing'`. The current code at lines 204-235 renders the visualization panel for `selecting` (with audio mode) and all other active states. Change it so that during `playing`, we render `<RhythmHighway>` instead.

Replace the block at lines 208-235 (the ternary chain inside the visualization area):

```tsx
{session.sessionState === 'selecting' && session.audioMode === null ? (
  <div className="flex-1 flex items-center justify-center">
    <AudioModePrompt onSelect={session.setAudioMode} instrument={session.exercise?.instrument} />
  </div>
) : session.sessionState === 'selecting' && session.audioMode === 'playsense' && session.exercise ? (
  <div className="flex-1 flex items-center justify-center">
    <PlaysenseTestPanel
      instrument={session.exercise.instrument}
      onReady={session.startExercise}
      onBack={session.clearAudioMode}
    />
  </div>
) : session.sessionState === 'playing' && session.exercise ? (
  <RhythmHighway
    exercise={session.exercise}
    playheadProgress={session.playheadProgress}
    currentScore={session.currentScore}
    currentCombo={session.currentCombo}
    currentAccuracy={session.currentAccuracy}
    metronomeBeat={session.metronomeBeat}
    lastHitGrade={session.lastHitGrade}
    eventResultsLength={session.eventResults.length}
    eventResults={session.eventResults}
  />
) : (
  <VisualizationPanel
    exercise={session.exercise}
    sessionState={session.sessionState}
    eventResults={session.eventResults}
    playheadProgress={session.playheadProgress}
    countdownBeat={session.countdownBeat}
    floatingGrades={floatingGrades}
    edgeFlash={edgeFlash}
    metronomeBeat={session.metronomeBeat}
    metronomeDownbeat={session.metronomeDownbeat}
    detectedMidiNote={session.detectedMidiNote}
    audioMode={session.audioMode}
  />
)}
```

- [ ] **Step 2: Verify the app builds**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/play-sense/exercise-player.tsx
git commit -m "feat(playsense): integrate RhythmHighway into ExercisePlayer during playing state"
```

---

## Task 9: Manual Smoke Test and Polish

**Files:**
- Possibly modify: any files from Tasks 1-8 based on testing

- [ ] **Step 1: Start the dev server and test**

```bash
npm run dev
```

Navigate to the PlaySense page in the browser. Select a conga exercise, complete the audio mode selection, and enter gameplay. Verify:

1. PixiJS canvas appears during `playing` state
2. Notes scroll down the highway toward the hit zone
3. Hit zone line is visible with receptor pads per lane
4. Score, combo, and accuracy update in the HUD
5. When you hit notes, particle bursts and floating grade text appear
6. When `playing` ends, the canvas unmounts and results screen appears normally
7. The `VisualizationPanel` still works correctly for `countdown` and `idle` states
8. No console errors or WebGL warnings

- [ ] **Step 2: Test responsive behavior**

Resize the browser window during gameplay. Verify:
1. Canvas resizes without visual artifacts
2. Highway proportions remain correct
3. HUD elements reposition appropriately

- [ ] **Step 3: Test with a melodic exercise**

Select a guitar or piano exercise and verify:
1. Lanes are assigned based on pitch ranges
2. Notes appear in the correct lanes
3. Scoring still works correctly

- [ ] **Step 4: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix(playsense): polish rhythm highway after smoke testing"
```

---

## Task 10: Receptor Pads (Visual Targets at Hit Zone)

**Files:**
- Modify: `components/play-sense/rhythm-highway/Highway.ts`

The highway currently draws the hit zone line but not the receptor pads that show where each lane's target is. Add receptor pad drawing.

- [ ] **Step 1: Add drawReceptors method to Highway**

Add this method and call it from `draw()`:

```typescript
/** Draw receptor pads at the hit zone — one per lane */
private drawReceptors() {
  if (!this.receptors) {
    this.receptors = new Graphics()
    this.container.addChild(this.receptors)
  }
  this.receptors.clear()

  const hitY = this.getHitZoneY()

  for (let i = 0; i < this.laneCount; i++) {
    const x = this.getLaneX(i, hitY)
    const scale = this.getScaleAtDepth(1)
    const w = 44 * scale
    const h = 24 * scale
    const color = LANE_COLORS[this.laneSurfaces[i]] ?? DEFAULT_LANE_COLOR

    // Receptor outline
    this.receptors.roundRect(x - w / 2, hitY - h / 2, w, h, 5)
    this.receptors.stroke({ color, width: 2, alpha: 0.4 })
    this.receptors.roundRect(x - w / 2, hitY - h / 2, w, h, 5)
    this.receptors.fill({ color, alpha: 0.08 })
  }
}
```

Add `private receptors: Graphics | null = null` to the class fields, and add `this.drawReceptors()` at the end of the `draw()` method. Also import `LANE_COLORS` and `DEFAULT_LANE_COLOR` at the top if not already imported.

- [ ] **Step 2: Commit**

```bash
git add components/play-sense/rhythm-highway/Highway.ts
git commit -m "feat(playsense): add receptor pads at hit zone for each lane"
```

---

## Verification Plan

After all tasks are complete:

1. **Build check:** `npm run build` passes with no errors
2. **Conga exercise flow:** idle → select → audio mode → countdown → playing (highway visible) → results → displays correct score
3. **Guitar exercise flow:** Same flow, verify pitch-based lane mapping
4. **Hit detection:** Tap during gameplay, verify particle bursts and grade text appear at correct lane
5. **HUD updates:** Score increments, combo counter works, accuracy ring fills, progress bar advances
6. **Resize:** Resize browser mid-gameplay, everything adapts
7. **Cleanup:** After gameplay ends, no WebGL warnings in console, memory does not leak on repeated play/stop cycles
