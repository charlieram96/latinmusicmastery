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
    this.bg.rect(0, 0, this.width, this.height)
    this.bg.fill(BG_COLOR_TOP)
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

    this.rails.moveTo(cx - halfTop, vanishY)
    this.rails.lineTo(cx - halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 3, alpha: 0.6 })

    this.rails.moveTo(cx + halfTop, vanishY)
    this.rails.lineTo(cx + halfBottom, hitY)
    this.rails.stroke({ color: RAIL_COLOR, width: 3, alpha: 0.6 })

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
        const halfW1 = this.getHalfWidthAtT(t1)
        const halfW2 = this.getHalfWidthAtT(t2)
        const cx = this.width / 2
        const laneW1 = (halfW1 * 2) / this.laneCount
        const laneW2 = (halfW2 * 2) / this.laneCount
        const dx1 = cx - halfW1 + laneW1 * lane
        const dx2 = cx - halfW2 + laneW2 * lane
        const alpha = 0.03 + t1 * 0.09

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
      let t = ((i + beatFraction) / gridCount)
      if (t > 1) t -= 1

      const y = vanishY + t * t * (hitY - vanishY)
      const halfW = this.getHalfWidthAtT(t * t)
      const alpha = GRID_LINE_ALPHA * t

      this.gridLines.moveTo(cx - halfW, y)
      this.gridLines.lineTo(cx + halfW, y)
      this.gridLines.stroke({ color: 0xffffff, width: 1, alpha })
    }

    const halfBottom = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 4, alpha: 0.8 })

    this.gridLines.moveTo(cx - halfBottom, hitY)
    this.gridLines.lineTo(cx + halfBottom, hitY)
    this.gridLines.stroke({ color: RAIL_COLOR, width: 12, alpha: 0.2 })
  }

  private initStars() {
    this.stars = Array.from({ length: STARFIELD_COUNT }, () => ({
      x: Math.random(),
      y: Math.random() * 0.5,
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.3,
      color: [0xffffff, 0xd4a854, 0x9b59b6, 0x3498db][Math.floor(Math.random() * 4)],
    }))
  }

  private drawStarfield() {
    this.starfield.clear()
    for (const star of this.stars) {
      const flicker = star.alpha + Math.sin(Date.now() * 0.002 + star.x * 100) * 0.1
      this.starfield.circle(star.x * this.width, star.y * this.height, star.size)
      this.starfield.fill({ color: star.color, alpha: Math.max(0, flicker) })
    }
  }
}
