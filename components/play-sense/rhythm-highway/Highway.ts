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
  BG_COLOR_MID,
  BG_COLOR_BOTTOM,
  ROAD_COLOR,
  AMBIENT_PARTICLE_COUNT,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
} from './constants'

interface AmbientParticle {
  x: number
  y: number
  size: number
  alpha: number
  speed: number
}

/**
 * Renders the highway background: perspective road, warm ambient glow, rails,
 * lane dividers, beat grid, and receptor pads. Call resize() when canvas
 * dimensions change, and update() each frame with the current beat fraction.
 */
export class Highway {
  readonly container = new Container()

  private bg = new Graphics()
  private ambientGlow = new Graphics()
  private road = new Graphics()
  private rails = new Graphics()
  private dividers = new Graphics()
  private gridLines = new Graphics()
  private ambientParticles = new Graphics()
  private receptors = new Graphics()

  private particles: AmbientParticle[] = []
  private width = 0
  private height = 0
  private laneCount = 3
  private laneSurfaces: string[] = []

  constructor() {
    this.container.addChild(
      this.bg, this.ambientGlow, this.ambientParticles,
      this.road, this.rails, this.dividers, this.gridLines, this.receptors,
    )
    this.initParticles()
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
    this.drawAmbientParticles()
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
    this.drawAmbientGlow()
    this.drawRoad()
    this.drawRails()
    this.drawDividers()
    this.drawGrid(0)
    this.drawReceptors()
  }

  private drawReceptors() {
    this.receptors.clear()
    const hitY = this.getHitZoneY()

    for (let i = 0; i < this.laneCount; i++) {
      const x = this.getLaneX(i, hitY)
      const scale = this.getScaleAtDepth(1)
      const w = 44 * scale
      const h = 24 * scale
      const color = LANE_COLORS[this.laneSurfaces[i]] ?? DEFAULT_LANE_COLOR

      this.receptors.roundRect(x - w / 2, hitY - h / 2, w, h, 5)
      this.receptors.stroke({ color, width: 2, alpha: 0.4 })
      this.receptors.roundRect(x - w / 2, hitY - h / 2, w, h, 5)
      this.receptors.fill({ color, alpha: 0.08 })
    }
  }

  private drawBackground() {
    this.bg.clear()
    // Dark warm base
    this.bg.rect(0, 0, this.width, this.height)
    this.bg.fill(BG_COLOR_TOP)
    // Mid-section warmth
    this.bg.rect(0, this.height * 0.3, this.width, this.height * 0.4)
    this.bg.fill({ color: BG_COLOR_MID, alpha: 0.5 })
    // Bottom warm glow
    this.bg.rect(0, this.height * 0.6, this.width, this.height * 0.4)
    this.bg.fill({ color: BG_COLOR_BOTTOM, alpha: 0.6 })
  }

  /** Subtle warm ambient glow around the highway center */
  private drawAmbientGlow() {
    this.ambientGlow.clear()
    const cx = this.width / 2
    const cy = this.height * 0.55

    // Large soft warm glow behind the highway
    this.ambientGlow.circle(cx, cy, this.height * 0.5)
    this.ambientGlow.fill({ color: 0x2a1a0a, alpha: 0.3 })

    // Tighter gold glow near hit zone
    const hitY = this.getHitZoneY()
    this.ambientGlow.circle(cx, hitY, this.width * 0.25)
    this.ambientGlow.fill({ color: RAIL_COLOR, alpha: 0.04 })
  }

  private drawRoad() {
    this.road.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const halfTop = (this.width * HIGHWAY_TOP_WIDTH) / 2

    this.road.moveTo(cx - halfTop, vanishY)
    this.road.lineTo(cx + halfTop, vanishY)
    this.road.lineTo(cx + halfBottom, hitY)
    this.road.lineTo(cx - halfBottom, hitY)
    this.road.closePath()
    this.road.fill({ color: ROAD_COLOR, alpha: 0.7 })
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
    this.rails.stroke({ color: RAIL_COLOR, width: 2, alpha: 0.5 })

    // Right rail
    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 2, alpha: 0.5 })

    // Rail glow
    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 6, alpha: RAIL_GLOW_ALPHA * 0.4 })

    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 6, alpha: RAIL_GLOW_ALPHA * 0.4 })
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
        const halfW1 = this.getHalfWidthAtT(t1)
        const halfW2 = this.getHalfWidthAtT(t2)
        const cx = this.width / 2
        const laneW1 = (halfW1 * 2) / this.laneCount
        const laneW2 = (halfW2 * 2) / this.laneCount
        const dx1 = cx - halfW1 + laneW1 * lane
        const dx2 = cx - halfW2 + laneW2 * lane
        const y1 = vanishY + t1 * (hitY - vanishY)
        const y2 = vanishY + t2 * (hitY - vanishY)
        const alpha = 0.02 + t1 * 0.06

        this.dividers.moveTo(dx1, y1)
        this.dividers.lineTo(dx2, y2)
        this.dividers.stroke({ color: RAIL_COLOR, width: 1, alpha })
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
      let t = ((i + beatFraction) / gridCount)
      if (t > 1) t -= 1

      const y = vanishY + t * t * (hitY - vanishY)
      const halfW = this.getHalfWidthAtT(t * t)
      const alpha = GRID_LINE_ALPHA * t

      this.gridLines.moveTo(cx - halfW, y)
      this.gridLines.lineTo(cx + halfW, y)
      this.gridLines.stroke({ color: RAIL_COLOR, width: 1, alpha })
    }

    // Hit zone line
    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 3, alpha: 0.7 })

    // Hit zone glow
    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 10, alpha: 0.15 })
  }

  private initParticles() {
    this.particles = Array.from({ length: AMBIENT_PARTICLE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1,
      alpha: 0.05 + Math.random() * 0.12,
      speed: 0.0001 + Math.random() * 0.0003,
    }))
  }

  private drawAmbientParticles() {
    this.ambientParticles.clear()
    const time = Date.now()
    for (const p of this.particles) {
      // Gentle upward drift
      const yOffset = (time * p.speed) % 1
      const y = ((p.y - yOffset + 1) % 1) * this.height
      const flicker = p.alpha + Math.sin(time * 0.001 + p.x * 50) * 0.04
      this.ambientParticles.circle(p.x * this.width, y, p.size)
      this.ambientParticles.fill({ color: RAIL_COLOR, alpha: Math.max(0, flicker) })
    }
  }
}
