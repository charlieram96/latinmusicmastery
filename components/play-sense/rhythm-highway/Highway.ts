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
  BOKEH_COUNT,
  LIGHT_RAY_COUNT,
  FOG_LAYER_COUNT,
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
} from './constants'

interface Bokeh {
  x: number
  y: number
  size: number
  alpha: number
  color: number
  driftX: number
  driftY: number
  phase: number
}

interface LightRay {
  angle: number
  width: number
  length: number
  alpha: number
  speed: number
}

interface FogLayer {
  y: number
  alpha: number
  speed: number
  phase: number
}

/**
 * Renders the highway background: perspective road, warm ambient glow, rails,
 * lane dividers, beat grid, and receptor pads. Call resize() when canvas
 * dimensions change, and update() each frame with the current beat fraction.
 */
export class Highway {
  readonly container = new Container()

  private bg = new Graphics()
  private lightRays = new Graphics()
  private fogLayers = new Graphics()
  private ambientGlow = new Graphics()
  private bokehLayer = new Graphics()
  private road = new Graphics()
  private rails = new Graphics()
  private dividers = new Graphics()
  private gridLines = new Graphics()
  private vignette = new Graphics()
  private receptors = new Graphics()

  private bokehs: Bokeh[] = []
  private rays: LightRay[] = []
  private fogs: FogLayer[] = []
  private width = 0
  private height = 0
  private laneCount = 3
  private laneSurfaces: string[] = []

  constructor() {
    this.container.addChild(
      this.bg, this.lightRays, this.fogLayers, this.ambientGlow,
      this.road, this.rails, this.dividers, this.gridLines,
      this.bokehLayer, this.vignette, this.receptors,
    )
    this.initBokehs()
    this.initRays()
    this.initFogs()
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

  /** Animate per-frame elements: grid scroll, bokeh drift, light rays, fog */
  update(beatFraction: number) {
    this.drawGrid(beatFraction)
    this.drawBokeh()
    this.drawLightRays()
    this.drawFog()
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
    this.drawVignette()
    this.drawRoad()
    this.drawRails()
    this.drawDividers()
    this.drawGrid(0)
    this.drawReceptors()
  }

  private drawReceptors() {
    this.receptors.clear()
    const hitY = this.getHitZoneY()

    // Drum sizes: quinto is smallest, tumba is largest
    const drumSizes: Record<string, number> = {
      quinto: 0.8, conga: 1.0, tumba: 1.15,
      macho: 0.85, hembra: 1.0, campana: 0.7,
      cencerro: 0.65, jamblock: 0.6, cascara: 0.7,
    }

    for (let i = 0; i < this.laneCount; i++) {
      const x = this.getLaneX(i, hitY)
      const surface = this.laneSurfaces[i]
      const color = LANE_COLORS[surface] ?? DEFAULT_LANE_COLOR
      const sizeMultiplier = drumSizes[surface] ?? 1.0
      this.drawConga(x, hitY, color, sizeMultiplier)
    }
  }

  /** Draw a conga drum illustration at the given position */
  private drawConga(cx: number, cy: number, color: number, sizeMultiplier: number) {
    const baseRx = 78 * sizeMultiplier
    const baseRy = 32 * sizeMultiplier
    const bodyHeight = 42 * sizeMultiplier

    // ── Drum body (barrel visible below the head) ──
    // Left side of barrel
    this.receptors.moveTo(cx - baseRx * 0.9, cy)
    this.receptors.lineTo(cx - baseRx * 0.85, cy + bodyHeight)
    // Bottom curve
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    // Right side
    this.receptors.moveTo(cx + baseRx * 0.9, cy)
    this.receptors.lineTo(cx + baseRx * 0.85, cy + bodyHeight)

    // Body fill — darker shade of the drum color
    this.receptors.ellipse(cx, cy + bodyHeight, baseRx * 0.85, baseRy * 0.6)
    this.receptors.fill({ color, alpha: 0.12 })

    // Body barrel sides
    this.receptors.moveTo(cx - baseRx * 0.9, cy)
    this.receptors.lineTo(cx - baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 1.5, alpha: 0.2 })
    this.receptors.moveTo(cx + baseRx * 0.9, cy)
    this.receptors.lineTo(cx + baseRx * 0.85, cy + bodyHeight)
    this.receptors.stroke({ color, width: 1.5, alpha: 0.2 })

    // Barrel stave lines (vertical detail)
    for (let s = -0.6; s <= 0.6; s += 0.3) {
      const sx = cx + baseRx * s
      this.receptors.moveTo(sx, cy + baseRy * 0.3)
      this.receptors.lineTo(sx * 0.98 + cx * 0.02, cy + bodyHeight - baseRy * 0.2)
      this.receptors.stroke({ color, width: 0.5, alpha: 0.08 })
    }

    // ── Drum head (top, main surface) ──
    // Outer rim glow
    this.receptors.ellipse(cx, cy, baseRx + 4, baseRy + 2)
    this.receptors.fill({ color, alpha: 0.06 })

    // Drum head skin — main surface
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.fill({ color, alpha: 0.15 })

    // Head rim (thick ring)
    this.receptors.ellipse(cx, cy, baseRx, baseRy)
    this.receptors.stroke({ color, width: 2.5, alpha: 0.45 })

    // Inner rim line
    this.receptors.ellipse(cx, cy, baseRx * 0.85, baseRy * 0.85)
    this.receptors.stroke({ color, width: 1, alpha: 0.15 })

    // Skin highlight — lighter patch for 3D dome
    this.receptors.ellipse(cx - baseRx * 0.1, cy - baseRy * 0.15, baseRx * 0.5, baseRy * 0.4)
    this.receptors.fill({ color: 0xffffff, alpha: 0.05 })

    // Center bearing spot
    this.receptors.circle(cx, cy, 2.5 * sizeMultiplier)
    this.receptors.fill({ color, alpha: 0.2 })

    // Metal ring detail at top of barrel
    this.receptors.ellipse(cx, cy + 2, baseRx * 0.95, baseRy * 0.95)
    this.receptors.stroke({ color: RAIL_COLOR, width: 0.8, alpha: 0.15 })
  }

  private drawBackground() {
    this.bg.clear()
    const w = this.width
    const h = this.height

    // Base — deep dark
    this.bg.rect(0, 0, w, h)
    this.bg.fill(BG_COLOR_TOP)

    // Layered gradient bands for depth
    this.bg.rect(0, h * 0.15, w, h * 0.25)
    this.bg.fill({ color: BG_COLOR_MID, alpha: 0.3 })
    this.bg.rect(0, h * 0.35, w, h * 0.3)
    this.bg.fill({ color: BG_COLOR_MID, alpha: 0.5 })
    this.bg.rect(0, h * 0.55, w, h * 0.25)
    this.bg.fill({ color: BG_COLOR_BOTTOM, alpha: 0.55 })
    this.bg.rect(0, h * 0.75, w, h * 0.25)
    this.bg.fill({ color: BG_COLOR_BOTTOM, alpha: 0.7 })

    // Warm horizon glow at vanishing point
    const vanishY = this.getVanishingY()
    const cx = w / 2
    this.bg.ellipse(cx, vanishY, w * 0.35, h * 0.12)
    this.bg.fill({ color: 0x3d2510, alpha: 0.35 })
    this.bg.ellipse(cx, vanishY, w * 0.2, h * 0.06)
    this.bg.fill({ color: RAIL_COLOR, alpha: 0.08 })
  }

  private drawAmbientGlow() {
    this.ambientGlow.clear()
    const cx = this.width / 2
    const hitY = this.getHitZoneY()
    const vanishY = this.getVanishingY()

    // Large atmospheric glow filling the highway corridor
    this.ambientGlow.ellipse(cx, (vanishY + hitY) / 2, this.width * 0.3, (hitY - vanishY) * 0.5)
    this.ambientGlow.fill({ color: 0x1a0f05, alpha: 0.4 })

    // Warm pool of light near the hit zone (stage lighting feel)
    this.ambientGlow.ellipse(cx, hitY - 40, this.width * 0.28, 80)
    this.ambientGlow.fill({ color: RAIL_COLOR, alpha: 0.04 })
    this.ambientGlow.ellipse(cx, hitY - 20, this.width * 0.15, 40)
    this.ambientGlow.fill({ color: RAIL_COLOR, alpha: 0.03 })

    // Subtle warm haze at the very top (horizon heat)
    this.ambientGlow.ellipse(cx, vanishY - 10, this.width * 0.4, 30)
    this.ambientGlow.fill({ color: 0x4a2a10, alpha: 0.12 })
  }

  private drawVignette() {
    this.vignette.clear()
    const w = this.width
    const h = this.height

    // Top edge darkening
    this.vignette.rect(0, 0, w, h * 0.12)
    this.vignette.fill({ color: 0x000000, alpha: 0.4 })
    this.vignette.rect(0, 0, w, h * 0.06)
    this.vignette.fill({ color: 0x000000, alpha: 0.3 })

    // Left edge
    this.vignette.rect(0, 0, w * 0.08, h)
    this.vignette.fill({ color: 0x000000, alpha: 0.3 })
    this.vignette.rect(0, 0, w * 0.04, h)
    this.vignette.fill({ color: 0x000000, alpha: 0.2 })

    // Right edge (less vignette since HUD is there)
    this.vignette.rect(w * 0.92, 0, w * 0.08, h)
    this.vignette.fill({ color: 0x000000, alpha: 0.15 })

    // Bottom below hit zone
    const hitY = this.getHitZoneY()
    this.vignette.rect(0, hitY + 60, w, h - hitY - 60)
    this.vignette.fill({ color: 0x000000, alpha: 0.5 })
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

  // ── Bokeh (warm out-of-focus light circles) ──

  private initBokehs() {
    const colors = [RAIL_COLOR, 0xc4884a, 0xe8c080, 0x8a6030, 0xf0d8a0]
    this.bokehs = Array.from({ length: BOKEH_COUNT }, () => ({
      x: Math.random(),
      y: 0.1 + Math.random() * 0.8,
      size: 4 + Math.random() * 16,
      alpha: 0.02 + Math.random() * 0.06,
      color: colors[Math.floor(Math.random() * colors.length)],
      driftX: (Math.random() - 0.5) * 0.00005,
      driftY: -0.00002 - Math.random() * 0.00004,
      phase: Math.random() * Math.PI * 2,
    }))
  }

  private drawBokeh() {
    this.bokehLayer.clear()
    const time = Date.now()
    for (const b of this.bokehs) {
      const drift = time
      const x = ((b.x + drift * b.driftX) % 1) * this.width
      const y = ((b.y + drift * b.driftY + 1) % 1) * this.height
      const breathe = b.alpha + Math.sin(time * 0.0008 + b.phase) * 0.015

      // Soft outer halo
      this.bokehLayer.circle(x, y, b.size * 1.8)
      this.bokehLayer.fill({ color: b.color, alpha: Math.max(0, breathe * 0.3) })
      // Core
      this.bokehLayer.circle(x, y, b.size)
      this.bokehLayer.fill({ color: b.color, alpha: Math.max(0, breathe) })
      // Bright center
      this.bokehLayer.circle(x, y, b.size * 0.3)
      this.bokehLayer.fill({ color: 0xffffff, alpha: Math.max(0, breathe * 0.4) })
    }
  }

  // ── Volumetric light rays from vanishing point ──

  private initRays() {
    this.rays = Array.from({ length: LIGHT_RAY_COUNT }, (_, i) => ({
      angle: -0.5 + (i / (LIGHT_RAY_COUNT - 1)) * 1.0, // spread across highway
      width: 15 + Math.random() * 25,
      length: 0.3 + Math.random() * 0.4,
      alpha: 0.015 + Math.random() * 0.02,
      speed: 0.0002 + Math.random() * 0.0003,
    }))
  }

  private drawLightRays() {
    this.lightRays.clear()
    const cx = this.width / 2
    const vanishY = this.getVanishingY()
    const hitY = this.getHitZoneY()
    const time = Date.now()

    for (const ray of this.rays) {
      const sway = Math.sin(time * ray.speed + ray.angle * 5) * 0.08
      const angle = ray.angle + sway
      const reach = (hitY - vanishY) * ray.length

      // Ray is a tapered quad from vanishing point downward
      const topX = cx
      const topY = vanishY
      const botLeftX = cx + Math.tan(angle - 0.02) * reach - ray.width / 2
      const botRightX = cx + Math.tan(angle + 0.02) * reach + ray.width / 2
      const botY = vanishY + reach

      const flicker = ray.alpha + Math.sin(time * 0.001 + ray.angle * 10) * 0.008

      this.lightRays.moveTo(topX - 2, topY)
      this.lightRays.lineTo(topX + 2, topY)
      this.lightRays.lineTo(botRightX, botY)
      this.lightRays.lineTo(botLeftX, botY)
      this.lightRays.closePath()
      this.lightRays.fill({ color: RAIL_COLOR, alpha: Math.max(0, flicker) })
    }
  }

  // ── Horizontal fog layers for atmospheric depth ──

  private initFogs() {
    this.fogs = Array.from({ length: FOG_LAYER_COUNT }, (_, i) => ({
      y: 0.25 + i * 0.18,
      alpha: 0.03 + Math.random() * 0.03,
      speed: 0.00003 + Math.random() * 0.00005,
      phase: Math.random() * Math.PI * 2,
    }))
  }

  private drawFog() {
    this.fogLayers.clear()
    const time = Date.now()
    const cx = this.width / 2

    for (const fog of this.fogs) {
      const y = fog.y * this.height
      const breathe = fog.alpha + Math.sin(time * 0.0005 + fog.phase) * 0.01
      const drift = Math.sin(time * fog.speed + fog.phase) * this.width * 0.05

      // Wide soft fog band
      this.fogLayers.ellipse(cx + drift, y, this.width * 0.45, 25)
      this.fogLayers.fill({ color: 0x1a1008, alpha: Math.max(0, breathe) })
      // Brighter core
      this.fogLayers.ellipse(cx + drift * 0.5, y, this.width * 0.2, 12)
      this.fogLayers.fill({ color: RAIL_COLOR, alpha: Math.max(0, breathe * 0.3) })
    }
  }
}
