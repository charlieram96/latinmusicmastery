// components/play-sense/rhythm-highway/Highway.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import {
  HIT_ZONE_Y_FRACTION,
  HIGHWAY_BOTTOM_WIDTH,
  HIGHWAY_TOP_WIDTH,
  VANISHING_POINT_Y,
  RAIL_COLOR,
  RAIL_COLOR_FAR,
  RAIL_GLOW_ALPHA,
  GRID_LINE_ALPHA,
  GRID_LINE_COLOR,
  HIT_BAR_COLOR,
  BG_COLOR,
  ROAD_COLOR,
  ROAD_ALPHA,
  LOOK_AHEAD_SEC,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
  HUD_FONT_FAMILY,
  MELODIC_LANE_COLORS,
} from './constants'

export type ReceptorStyle = 'drum' | 'piano' | 'string'

// Internal alias so the helper can read the imported palette without re-exporting it
const MELODIC_LANE_COLORS_INTERNAL = MELODIC_LANE_COLORS

export interface FadeStyle {
  solidExtend: number    // how far solid block extends past vanishing point (fraction of highway)
  fadeLength: number     // how far the gradient extends (fraction of highway)
}

export const DEFAULT_FADE_STYLE: FadeStyle = {
  solidExtend: 0,
  fadeLength: 0.09,
}

export interface CongaStyle {
  bodyWidth: number        // base rx
  bodyHeight: number       // base ry
  barrelHeight: number
  barrelSideAlpha: number
  barrelBottomAlpha: number
  barrelFillAlpha: number
  outerGlowAlpha: number
  outerGlowStrokeAlpha: number
  headSurfaceAlpha: number
  mainRimAlpha: number
  whiteRimAlpha: number
  innerRingAlpha: number
  centerDotAlpha: number
}

export const DEFAULT_CONGA_STYLE: CongaStyle = {
  bodyWidth: 96,
  bodyHeight: 40,
  barrelHeight: 120,
  barrelSideAlpha: 0.16,
  barrelBottomAlpha: 0.32,
  barrelFillAlpha: 0.12,
  outerGlowAlpha: 0.51,
  outerGlowStrokeAlpha: 0.28,
  headSurfaceAlpha: 0.4,
  mainRimAlpha: 1,
  whiteRimAlpha: 0.45,
  innerRingAlpha: 0.6,
  centerDotAlpha: 0,
}

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
  private labelContainer = new Container()
  private labelTexts: Text[] = []

  /** Separate container for the top fade overlay — placed above notes in HighwayApp */
  readonly overlayContainer = new Container()

  private width = 0
  private height = 0
  private laneCount = 3
  private laneSurfaces: string[] = []
  private laneLabels: string[] = []
  private receptorStyle: ReceptorStyle = 'drum'

  /** Pulse intensity 0..1 — driven by metronome beat to make receptors throb during countdown/playing */
  private receptorPulse = 0

  fadeStyle: FadeStyle = { ...DEFAULT_FADE_STYLE }
  congaStyle: CongaStyle = { ...DEFAULT_CONGA_STYLE }

  constructor() {
    this.container.addChild(
      this.bg, this.sideFog, this.road, this.rails,
      this.dividers, this.gridLines, this.receptors, this.labelContainer,
    )
    this.overlayContainer.addChild(this.topFade)
  }

  setLanes(surfaces: string[], labels?: string[]) {
    this.laneSurfaces = surfaces
    this.laneLabels = labels && labels.length === surfaces.length ? labels : surfaces
    this.laneCount = surfaces.length
    this.rebuildLabels()
    if (this.width > 0) this.draw()
  }

  setReceptorStyle(style: ReceptorStyle) {
    this.receptorStyle = style
    this.rebuildLabels()
    if (this.width > 0) this.draw()
  }

  /** Set the metronome-beat pulse intensity (0..1) used to throb receptors. */
  setReceptorPulse(pulse: number) {
    this.receptorPulse = Math.max(0, Math.min(1, pulse))
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.draw()
  }

  update(elapsedSec: number, bpm: number) {
    this.drawGrid(elapsedSec, bpm)
    this.drawSideFog()
    this.drawReceptors()
    this.drawTopFade()
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
    const t = depthFraction * depthFraction * depthFraction * depthFraction
    return vanishY + t * (hitY - vanishY)
  }

  /** Continues past the hit zone at the same velocity it had at depth=1 */
  depthToYExtended(depthFraction: number): number {
    if (depthFraction <= 1) return this.depthToY(depthFraction)
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const velocityAtHit = 4 * (hitY - vanishY) // derivative of t⁴ at t=1
    const past = depthFraction - 1
    return hitY + past * velocityAtHit
  }

  getScaleAtDepth(depthFraction: number): number {
    const t = depthFraction * depthFraction * depthFraction * depthFraction
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
    // Warm near-black void
    this.bg.rect(0, 0, this.width, this.height)
    this.bg.fill(BG_COLOR)

    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()

    // Warm amber glow blooming from the vanishing point (distant stage haze)
    this.bg.ellipse(cx, vanishY + this.height * 0.02, this.width * 0.32, this.height * 0.12)
    this.bg.fill({ color: RAIL_COLOR, alpha: 0.07 })
    this.bg.ellipse(cx, vanishY, this.width * 0.16, this.height * 0.05)
    this.bg.fill({ color: RAIL_COLOR, alpha: 0.05 })

    // Terracotta warmth pooling toward the floor (hit zone)
    this.bg.ellipse(cx, hitY + (this.height - hitY) * 0.5, this.width * 0.42, (this.height - hitY) * 0.7)
    this.bg.fill({ color: RAIL_COLOR_FAR, alpha: 0.05 })
  }

  /** Gradient overlay at the top of the board — notes/frets emerge from fog */
  private drawTopFade() {
    this.topFade.clear()
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const f = this.fadeStyle
    const fadeEnd = vanishY + (hitY - vanishY) * f.fadeLength
    const w = this.width

    // Solid block from top of canvas past vanishing point into the highway
    const solidEnd = vanishY + (hitY - vanishY) * f.solidExtend
    this.topFade.rect(0, 0, w, solidEnd)
    this.topFade.fill({ color: BG_COLOR, alpha: 1 })

    // Smooth gradient from solid end to fade end
    const steps = 80
    const fadeHeight = fadeEnd - solidEnd
    const stripH = fadeHeight / steps + 0.5
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const y = solidEnd + t * fadeHeight
      const alpha = 1 - t * t * t
      this.topFade.rect(0, y, w, stripH)
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

    // Hit zone floor glow — warm terracotta pool
    const floorPulse = 0.05 + Math.sin(time * 0.001) * 0.02
    this.sideFog.ellipse(cx, hitY + 10, halfBottom * 0.9, 30)
    this.sideFog.fill({ color: RAIL_COLOR_FAR, alpha: floorPulse })
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

    // Warm floor wash just above the hit line (amber → terracotta pool)
    const washTop = hitY - 90
    this.road.rect(cx - halfBottom * 1.05, washTop, halfBottom * 2.1, this.height - washTop)
    this.road.fill({ color: RAIL_COLOR_FAR, alpha: 0.05 })

    // Timing line at hit zone — prominent gold glow
    // Wide glow
    this.road.moveTo(cx - halfBottom, hitY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.stroke({ color: HIT_BAR_COLOR, width: 13, alpha: 0.12 })
    // Mid glow
    this.road.moveTo(cx - halfBottom, hitY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.stroke({ color: HIT_BAR_COLOR, width: 5, alpha: 0.32 })
    // Core line
    this.road.moveTo(cx - halfBottom, hitY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.stroke({ color: HIT_BAR_COLOR, width: 2, alpha: 0.85 })
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

    // Rails run amber (distant, at the vanishing point) → terracotta (near the floor).
    // Drawn in segments so the colour can interpolate smoothly along the runway.
    const SEG = 14
    const railPoint = (side: 1 | -1, t: number): [number, number] => {
      const half = halfTop + t * (halfEnd - halfTop)
      const y = vanishY + t * (this.height - vanishY)
      return [cx + side * half, y]
    }

    const passes: Array<{ width: number; alpha: number; color: 'grad' | number }> = [
      { width: 11, alpha: RAIL_GLOW_ALPHA * 0.18, color: 'grad' }, // wide outer glow
      { width: 4.5, alpha: RAIL_GLOW_ALPHA * 0.5, color: 'grad' }, // mid glow
      { width: 1.5, alpha: 0.7, color: 0xfff0dc },                 // warm cream core
    ]

    for (const side of [-1, 1] as const) {
      for (const pass of passes) {
        for (let i = 0; i < SEG; i++) {
          const t0 = i / SEG
          const t1 = (i + 1) / SEG
          const [x0, y0] = railPoint(side, t0)
          const [x1, y1] = railPoint(side, t1)
          const color = pass.color === 'grad'
            ? lerpColor(RAIL_COLOR, RAIL_COLOR_FAR, (t0 + t1) / 2)
            : pass.color
          this.rails.moveTo(x0, y0)
          this.rails.lineTo(x1, y1)
          this.rails.stroke({ color, width: pass.width, alpha: pass.alpha })
        }
      }
    }
  }

  private drawDividers() {
    this.dividers.clear()
    if (this.laneCount <= 1) return

    const vanishY = this.getVanishingY()
    const endY = this.height
    const hitY = this.getHitZoneY()
    const totalHeight = endY - vanishY
    const steps = 30
    const cx = this.width / 2

    // Compute half-width at bottom of canvas (extrapolate past hit zone)
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2
    const widthGrowthRate = (halfBottom - halfTop) / (hitY - vanishY)

    for (let lane = 1; lane < this.laneCount; lane++) {
      for (let i = 0; i < steps; i++) {
        const t1 = i / steps
        const t2 = (i + 1) / steps
        const y1 = vanishY + t1 * totalHeight
        const y2 = vanishY + t2 * totalHeight

        // Half-width at each Y, extrapolating past hit zone
        const hw1 = y1 <= hitY ? this.getHalfWidthAtT((y1 - vanishY) / (hitY - vanishY)) : halfBottom + widthGrowthRate * (y1 - hitY)
        const hw2 = y2 <= hitY ? this.getHalfWidthAtT((y2 - vanishY) / (hitY - vanishY)) : halfBottom + widthGrowthRate * (y2 - hitY)

        const laneW1 = (hw1 * 2) / this.laneCount
        const laneW2 = (hw2 * 2) / this.laneCount
        const dx1 = cx - hw1 + laneW1 * lane
        const dx2 = cx - hw2 + laneW2 * lane
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
      const halfW = this.getHalfWidthAtT(clampedDepth * clampedDepth * clampedDepth)
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
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const cx = this.width / 2
    const laneWidth = (halfBottom * 2) / Math.max(this.laneCount, 1)

    for (let i = 0; i < this.laneCount; i++) {
      const x = this.getLaneX(i, hitY)
      const surface = this.laneSurfaces[i]
      const color = this.getLaneColorForIndex(i, surface)

      if (this.receptorStyle === 'piano') {
        this.drawNeonPianoKey(x, hitY, laneWidth, color)
      } else if (this.receptorStyle === 'string') {
        this.drawNeonString(x, hitY, laneWidth, color, cx, halfBottom)
      } else {
        this.drawNeonConga(x, hitY, color)
      }
    }

    // Position labels in front of receptor shapes
    this.layoutLabels(hitY, laneWidth)
  }

  private getLaneColorForIndex(i: number, surface: string): number {
    if (LANE_COLORS[surface] != null) return LANE_COLORS[surface]
    // Fallback: cycle melodic palette by index
    const palette = MELODIC_LANE_COLORS_INTERNAL
    return palette[i % palette.length]
  }

  private rebuildLabels() {
    // Remove existing
    for (const t of this.labelTexts) this.labelContainer.removeChild(t)
    this.labelTexts = []

    if (this.receptorStyle === 'drum') return // Conga has no in-canvas labels

    for (let i = 0; i < this.laneCount; i++) {
      const label = this.laneLabels[i] ?? this.laneSurfaces[i] ?? ''
      const t = new Text({
        text: label,
        style: new TextStyle({
          fontFamily: HUD_FONT_FAMILY,
          fontSize: this.receptorStyle === 'piano' ? 14 : 16,
          fontWeight: '800',
          fill: 0xffffff,
          letterSpacing: 1,
        }),
      })
      t.anchor.set(0.5)
      t.alpha = 0.9
      this.labelContainer.addChild(t)
      this.labelTexts.push(t)
    }
  }

  private layoutLabels(hitY: number, laneWidth: number) {
    if (this.labelTexts.length === 0) return
    for (let i = 0; i < this.labelTexts.length; i++) {
      const t = this.labelTexts[i]
      const x = this.getLaneX(i, hitY)
      if (this.receptorStyle === 'piano') {
        t.x = x
        t.y = hitY + 36
      } else if (this.receptorStyle === 'string') {
        t.x = x
        t.y = hitY - 30
      }
      // Cap label width so it doesn't overflow lane
      const maxWidth = laneWidth * 0.9
      t.scale.x = t.width > maxWidth ? maxWidth / t.width : 1
      t.scale.y = t.scale.x
    }
  }

  /** Beat Saber-style neon piano key — flat front face, glowing rim, intense underglow */
  private drawNeonPianoKey(cx: number, cy: number, laneWidth: number, color: number) {
    const pulse = 1 + this.receptorPulse * 0.06
    const w = laneWidth * 0.78 * pulse
    const h = 34 * pulse
    const x = cx - w / 2
    const y = cy - h / 2

    // Outer glow
    this.receptors.roundRect(x - 4, y - 4, w + 8, h + 8, 8)
    this.receptors.fill({ color, alpha: 0.18 })

    // Body
    this.receptors.roundRect(x, y, w, h, 6)
    this.receptors.fill({ color: 0x080814, alpha: 0.85 })

    // Neon rim
    this.receptors.roundRect(x, y, w, h, 6)
    this.receptors.stroke({ color, width: 2, alpha: 0.95 })

    // Inner faint rim (white core)
    this.receptors.roundRect(x + 1, y + 1, w - 2, h - 2, 5)
    this.receptors.stroke({ color: 0xffffff, width: 0.5, alpha: 0.35 })

    // Top inner highlight
    this.receptors.roundRect(x + 4, y + 3, w - 8, 4, 2)
    this.receptors.fill({ color, alpha: 0.4 })

    // Bottom underglow strip (suggests key depression light)
    this.receptors.roundRect(x + 3, y + h - 5, w - 6, 3, 1.5)
    this.receptors.fill({ color, alpha: 0.6 + this.receptorPulse * 0.3 })
  }

  /** Beat Saber-style neon string — a long horizontal glowing line through the lane */
  private drawNeonString(cx: number, cy: number, laneWidth: number, color: number, _highwayCx: number, halfBottom: number) {
    const pulse = 1 + this.receptorPulse * 0.15
    const stringExtend = laneWidth * 0.92
    const x1 = cx - stringExtend / 2
    const x2 = cx + stringExtend / 2

    // Outer wide glow
    this.receptors.moveTo(x1, cy)
    this.receptors.lineTo(x2, cy)
    this.receptors.stroke({ color, width: 14 * pulse, alpha: 0.12 + this.receptorPulse * 0.18 })

    // Mid glow
    this.receptors.moveTo(x1, cy)
    this.receptors.lineTo(x2, cy)
    this.receptors.stroke({ color, width: 6 * pulse, alpha: 0.45 })

    // Core string
    this.receptors.moveTo(x1, cy)
    this.receptors.lineTo(x2, cy)
    this.receptors.stroke({ color, width: 2, alpha: 0.95 })

    // White core
    this.receptors.moveTo(x1, cy)
    this.receptors.lineTo(x2, cy)
    this.receptors.stroke({ color: 0xffffff, width: 0.6, alpha: 0.55 })

    // Bridge endpoints (small circles)
    this.receptors.circle(x1, cy, 4)
    this.receptors.fill({ color, alpha: 0.7 })
    this.receptors.circle(x1, cy, 2.5)
    this.receptors.fill({ color: 0xffffff, alpha: 0.6 })

    this.receptors.circle(x2, cy, 4)
    this.receptors.fill({ color, alpha: 0.7 })
    this.receptors.circle(x2, cy, 2.5)
    this.receptors.fill({ color: 0xffffff, alpha: 0.6 })

    // Suppress unused-param lints
    void _highwayCx
    void halfBottom
  }

  /** Beat Saber-style neon conga — all values driven by this.congaStyle */
  private drawNeonConga(cx: number, cy: number, color: number) {
    const c = this.congaStyle
    const baseRx = c.bodyWidth
    const baseRy = c.bodyHeight
    const bodyHeight = c.barrelHeight

    // ── Drum body (barrel outline) ──
    this.receptors.moveTo(cx - baseRx * 0.9, cy)
    this.receptors.lineTo(cx - baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 2, alpha: c.barrelSideAlpha })
    this.receptors.moveTo(cx + baseRx * 0.9, cy)
    this.receptors.lineTo(cx + baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 2, alpha: c.barrelSideAlpha })

    // Bottom ellipse
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    this.receptors.stroke({ color, width: 1.5, alpha: c.barrelBottomAlpha })

    // Body fill
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    this.receptors.fill({ color, alpha: c.barrelFillAlpha })

    // ── Drum head — neon ring ──
    // Outer glow
    this.receptors.ellipse(cx, cy, baseRx + 6, baseRy + 3)
    this.receptors.fill({ color, alpha: c.outerGlowAlpha })
    this.receptors.ellipse(cx, cy, baseRx + 3, baseRy + 1.5)
    this.receptors.stroke({ color, width: 6, alpha: c.outerGlowStrokeAlpha })

    // Head surface
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.fill({ color, alpha: c.headSurfaceAlpha })

    // Main neon rim
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.stroke({ color, width: 2.5, alpha: c.mainRimAlpha })

    // Bright core of rim
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.stroke({ color: 0xffffff, width: 1, alpha: c.whiteRimAlpha })

    // Inner ring
    this.receptors.ellipse(cx, cy, baseRx * 0.7, baseRy * 0.7)
    this.receptors.stroke({ color, width: 1, alpha: c.innerRingAlpha })

    // Center dot
    this.receptors.circle(cx, cy, 3)
    this.receptors.fill({ color, alpha: c.centerDotAlpha })
  }
}

/** Linear-interpolate between two 0xRRGGBB colors. t in [0,1]. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}
