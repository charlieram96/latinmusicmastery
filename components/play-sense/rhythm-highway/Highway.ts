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
  GRID_LINE_COLOR,
  BG_COLOR,
  ROAD_COLOR,
  ROAD_ALPHA,
  LOOK_AHEAD_SEC,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
} from './constants'

/**
 * Beat Saber-style highway: dark void background, neon-outlined flat runway,
 * glowing rails, and neon receptor targets. Clean and minimal.
 */
export class Highway {
  readonly container = new Container()

  private bg = new Graphics()
  private sideFog = new Graphics()
  private road = new Graphics()
  private rails = new Graphics()
  private dividers = new Graphics()
  private gridLines = new Graphics()
  private receptors = new Graphics()
  private topFade = new Graphics()

  /** Separate container for the top fade overlay — placed above notes in HighwayApp */
  readonly overlayContainer = new Container()

  private width = 0
  private height = 0
  private laneCount = 3
  private laneSurfaces: string[] = []

  constructor() {
    this.container.addChild(
      this.bg, this.sideFog, this.road, this.rails,
      this.dividers, this.gridLines, this.receptors,
    )
    this.overlayContainer.addChild(this.topFade)
  }

  setLanes(surfaces: string[]) {
    this.laneSurfaces = surfaces
    this.laneCount = surfaces.length
    if (this.width > 0) this.draw()
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.draw()
  }

  update(elapsedSec: number, bpm: number) {
    this.drawGrid(elapsedSec, bpm)
    this.drawSideFog()
  }

  getLaneX(laneIndex: number, y: number): number {
    const t = this.getDepthTUnclamped(y)
    const halfWidth = this.getHalfWidthAtT(t)
    const cx = this.width / 2
    const laneWidth = (halfWidth * 2) / this.laneCount
    return cx - halfWidth + laneWidth * (laneIndex + 0.5)
  }

  getHitZoneY(): number {
    return this.height * HIT_ZONE_Y_FRACTION
  }

  getVanishingY(): number {
    return this.height * VANISHING_POINT_Y
  }

  depthToY(depthFraction: number): number {
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const t = depthFraction * depthFraction
    return vanishY + t * (hitY - vanishY)
  }

  /** Continues past the hit zone at the same velocity it had at depth=1 */
  depthToYExtended(depthFraction: number): number {
    if (depthFraction <= 1) return this.depthToY(depthFraction)
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const velocityAtHit = 2 * (hitY - vanishY)
    const past = depthFraction - 1
    return hitY + past * velocityAtHit
  }

  getScaleAtDepth(depthFraction: number): number {
    const t = depthFraction * depthFraction
    return 0.28 + t * 0.72
  }

  // ── Private ──

  /** Clamped to [0, 1] — used for drawing road/rails within highway bounds */
  private getDepthT(y: number): number {
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    if (hitY === vanishY) return 0
    return Math.max(0, Math.min(1, (y - vanishY) / (hitY - vanishY)))
  }

  /** Unclamped — allows values > 1 for notes past the hit zone */
  private getDepthTUnclamped(y: number): number {
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    if (hitY === vanishY) return 0
    return Math.max(0, (y - vanishY) / (hitY - vanishY))
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
    this.drawGrid(0, 120)
    this.drawReceptors()
    this.drawTopFade()
  }

  private drawBackground() {
    this.bg.clear()
    // Pure dark void
    this.bg.rect(0, 0, this.width, this.height)
    this.bg.fill(BG_COLOR)

    // Subtle blue fog at the vanishing point (distant glow)
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    this.bg.ellipse(cx, vanishY, this.width * 0.25, this.height * 0.08)
    this.bg.fill({ color: RAIL_COLOR, alpha: 0.06 })
    this.bg.ellipse(cx, vanishY, this.width * 0.12, this.height * 0.03)
    this.bg.fill({ color: RAIL_COLOR, alpha: 0.04 })
  }

  /** Gradient overlay at the top of the board — notes/frets emerge from fog */
  private drawTopFade() {
    this.topFade.clear()
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const fadeHeight = (hitY - vanishY) * 0.25
    const w = this.width

    // Stack rectangles from top, decreasing opacity — simulates gradient
    const steps = 12
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const y = vanishY + t * fadeHeight
      const h = fadeHeight / steps
      const alpha = 1 - t // fully opaque at top, transparent at bottom
      this.topFade.rect(0, y, w, h + 1) // +1 to avoid gaps
      this.topFade.fill({ color: BG_COLOR, alpha })
    }
  }

  /** Animated colored fog hugging the sides of the runway */
  private drawSideFog() {
    this.sideFog.clear()
    const time = Date.now()
    const cx = this.width / 2
    const hitY = this.getHitZoneY()
    const vanishY = this.getVanishingY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2

    // Left side fog
    const leftPulse = 0.03 + Math.sin(time * 0.0008) * 0.01
    this.sideFog.ellipse(cx - halfBottom - 30, (vanishY + hitY) / 2, 60, (hitY - vanishY) * 0.4)
    this.sideFog.fill({ color: RAIL_COLOR, alpha: leftPulse })

    // Right side fog
    const rightPulse = 0.03 + Math.sin(time * 0.0008 + 1.5) * 0.01
    this.sideFog.ellipse(cx + halfBottom + 30, (vanishY + hitY) / 2, 60, (hitY - vanishY) * 0.4)
    this.sideFog.fill({ color: RAIL_COLOR, alpha: rightPulse })

    // Hit zone floor glow
    const floorPulse = 0.04 + Math.sin(time * 0.001) * 0.015
    this.sideFog.ellipse(cx, hitY + 10, halfBottom * 0.8, 25)
    this.sideFog.fill({ color: RAIL_COLOR, alpha: floorPulse })
  }

  private drawRoad() {
    this.road.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2

    // Estimate how much wider the road gets past the hit zone to the bottom
    const extraHeight = this.height - hitY
    const widthGrowthRate = (halfBottom - halfTop) / (hitY - vanishY)
    const halfEnd = halfBottom + widthGrowthRate * extraHeight

    // Road surface — extends all the way to the container bottom
    this.road.moveTo(cx - halfTop, vanishY)
    this.road.lineTo(cx + halfTop, vanishY)
    this.road.lineTo(cx + halfEnd, this.height)
    this.road.lineTo(cx - halfEnd, this.height)
    this.road.closePath()
    this.road.fill({ color: ROAD_COLOR, alpha: ROAD_ALPHA })

    // Timing line at hit zone — thin, low opacity, full highway width
    this.road.moveTo(cx - halfBottom, hitY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.stroke({ color: 0xffffff, width: 1, alpha: 0.18 })
  }

  private drawRails() {
    this.rails.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2
    const extraHeight = this.height - this.getHitZoneY()
    const widthGrowthRate = (halfBottom - halfTop) / (this.getHitZoneY() - vanishY)
    const halfEnd = halfBottom + widthGrowthRate * extraHeight

    // Wide neon glow (outer) — full length to bottom
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfEnd, this.height)
    this.rails.stroke({ color: RAIL_COLOR, width: 10, alpha: RAIL_GLOW_ALPHA * 0.2 })
    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfEnd, this.height)
    this.rails.stroke({ color: RAIL_COLOR, width: 10, alpha: RAIL_GLOW_ALPHA * 0.2 })

    // Mid glow
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfEnd, this.height)
    this.rails.stroke({ color: RAIL_COLOR, width: 4, alpha: RAIL_GLOW_ALPHA * 0.5 })
    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfEnd, this.height)
    this.rails.stroke({ color: RAIL_COLOR, width: 4, alpha: RAIL_GLOW_ALPHA * 0.5 })

    // Bright core line
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfEnd, this.height)
    this.rails.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 })
    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfEnd, this.height)
    this.rails.stroke({ color: 0xffffff, width: 1.5, alpha: 0.6 })
  }

  private drawDividers() {
    this.dividers.clear()
    if (this.laneCount <= 1) return

    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const steps = 24

    for (let lane = 1; lane < this.laneCount; lane++) {
      for (let i = 0; i < steps; i++) {
        const t1 = i / steps
        const t2 = (i + 1) / steps
        const halfW1 = this.getHalfWidthAtT(t1)
        const halfW2 = this.getHalfWidthAtT(t2)
        const cx = this.width / 2
        const laneW1 = (halfW1 * 2) / this.laneCount
        const laneW2 = (halfW2 * 2) / this.laneCount
        const dx1 = cx - halfW1 + laneW1 * lane
        const dx2 = cx - halfW2 + laneW2 * lane
        const y1 = vanishY + t1 * (hitY - vanishY)
        const y2 = vanishY + t2 * (hitY - vanishY)
        const alpha = 0.03 + t1 * 0.1

        this.dividers.moveTo(dx1, y1)
        this.dividers.lineTo(dx2, y2)
        this.dividers.stroke({ color: RAIL_COLOR, width: 1, alpha })
      }
    }
  }

  /**
   * Draw fret lines that travel with the notes. Each fret = 1 quarter beat.
   * Uses the same depth math as NoteManager so frets and notes move in sync.
   */
  private drawGrid(elapsedSec: number, bpm: number) {
    this.gridLines.clear()
    const cx = this.width / 2
    const beatDuration = 60 / bpm // seconds per quarter beat

    // Find the first quarter beat visible in the look-ahead window
    const firstBeatTime = Math.ceil(elapsedSec / beatDuration) * beatDuration

    for (let i = 0; i < 20; i++) {
      const beatTime = firstBeatTime + i * beatDuration
      const timeDiff = beatTime - elapsedSec

      // Same window as notes
      if (timeDiff < -0.1) continue
      if (timeDiff > LOOK_AHEAD_SEC) break

      // Same depth fraction math as NoteManager
      const depthFraction = 1 - (timeDiff / LOOK_AHEAD_SEC)
      if (depthFraction < 0 || depthFraction > 1.05) continue

      const clampedDepth = Math.min(depthFraction, 1)
      const y = this.depthToY(clampedDepth)
      const halfW = this.getHalfWidthAtT(clampedDepth * clampedDepth)
      // Fade in over top 20% of highway, matching note fade
      const fadeIn = Math.min(1, depthFraction / 0.2)
      const alpha = GRID_LINE_ALPHA * clampedDepth * fadeIn

      // Check if this is a downbeat (beat 1 of a measure) — brighter
      const beatNumber = Math.round(beatTime / beatDuration)
      const isDownbeat = beatNumber % 4 === 0

      // Neon fret line
      this.gridLines.moveTo(cx - halfW, y)
      this.gridLines.lineTo(cx + halfW, y)
      this.gridLines.stroke({ color: GRID_LINE_COLOR, width: isDownbeat ? 1.5 : 1, alpha: isDownbeat ? alpha * 1.5 : alpha })

      // Glow on closer frets
      if (clampedDepth > 0.5) {
        this.gridLines.moveTo(cx - halfW, y)
        this.gridLines.lineTo(cx + halfW, y)
        this.gridLines.stroke({ color: GRID_LINE_COLOR, width: isDownbeat ? 6 : 4, alpha: alpha * 0.12 })
      }
    }

  }

  private drawReceptors() {
    this.receptors.clear()
    const hitY = this.getHitZoneY()

    for (let i = 0; i < this.laneCount; i++) {
      const x = this.getLaneX(i, hitY)
      const surface = this.laneSurfaces[i]
      const color = LANE_COLORS[surface] ?? DEFAULT_LANE_COLOR
      this.drawNeonConga(x, hitY, color)
    }
  }

  /** Beat Saber-style neon conga — glowing outlines, minimal fill */
  private drawNeonConga(cx: number, cy: number, color: number) {
    const baseRx = 96
    const baseRy = 40
    const bodyHeight = 56

    // ── Drum body (barrel outline) ──
    this.receptors.moveTo(cx - baseRx * 0.9, cy)
    this.receptors.lineTo(cx - baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 2, alpha: 1 })
    this.receptors.moveTo(cx + baseRx * 0.9, cy)
    this.receptors.lineTo(cx + baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 2, alpha: 1 })

    // Bottom ellipse
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    this.receptors.stroke({ color, width: 1.5, alpha: 0.8 })

    // Body fill
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    this.receptors.fill({ color, alpha: 0.15 })

    // ── Drum head — neon ring ──
    // Outer glow
    this.receptors.ellipse(cx, cy, baseRx + 6, baseRy + 3)
    this.receptors.fill({ color, alpha: 0.1 })
    this.receptors.ellipse(cx, cy, baseRx + 3, baseRy + 1.5)
    this.receptors.stroke({ color, width: 6, alpha: 0.25 })

    // Head surface
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.fill({ color, alpha: 0.15 })

    // Main neon rim
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.stroke({ color, width: 2.5, alpha: 1 })

    // Bright core of rim
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.stroke({ color: 0xffffff, width: 1, alpha: 0.6 })

    // Inner ring
    this.receptors.ellipse(cx, cy, baseRx * 0.7, baseRy * 0.7)
    this.receptors.stroke({ color, width: 1, alpha: 0.4 })

    // Center dot
    this.receptors.circle(cx, cy, 3)
    this.receptors.fill({ color, alpha: 0.8 })
  }
}
