// components/play-sense/glass-highway/Scene.ts
//
// Static + ambient visuals: warm void background, hairline lanes (or octave
// guides for piano), the hit line with shimmer, the glass table band with a
// slow moving glare, and drifting dust. Geometry redraws only on resize;
// per-frame work is alpha/position modulation on a handful of objects.

import { Container, Graphics } from 'pixi.js'
import type { GlassStyle } from './style'
import type { LaneLayout } from './LaneLayout'
import { PianoLaneLayout } from './LaneLayout'
import {
  BG_TOP, BG_MID, BG_BOTTOM, BG_GLOW,
  HIT_LINE_CORE, HIT_LINE_SOFT, HIT_LINE_BLOOM,
  GLASS_SHEEN, GLASS_EDGE,
} from './constants'

interface Dust {
  gfx: Graphics
  x: number
  y: number
  speed: number
  sway: number
  phase: number
}

export class Scene {
  readonly container = new Container()
  /** Glass band drawn ABOVE the reflections so they read as under the surface. */
  readonly glassContainer = new Container()

  private bg = new Graphics()
  private laneLines = new Graphics()
  private hitGlow = new Graphics()
  private hitCore = new Graphics()
  private glassBand = new Graphics()
  private glare = new Graphics()
  private dustPool: Dust[] = []
  private dustContainer = new Container()

  private width = 0
  private height = 0
  private hitY = 0
  private elapsedMs = 0
  private style: GlassStyle
  private layout: LaneLayout | null = null

  constructor(style: GlassStyle) {
    this.style = style
    this.container.addChild(this.bg, this.laneLines, this.dustContainer)
    this.glassContainer.addChild(this.glassBand, this.glare, this.hitGlow, this.hitCore)
  }

  setStyle(style: GlassStyle) {
    this.style = style
    this.redraw()
  }

  setLayout(layout: LaneLayout) {
    this.layout = layout
    this.redraw()
  }

  get hitLineY(): number {
    return this.hitY
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.hitY = height * this.style.hitLineFraction
    this.redraw()
  }

  private redraw() {
    if (this.width === 0) return
    this.hitY = this.height * this.style.hitLineFraction
    this.drawBackground()
    this.drawLanes()
    this.drawHitLine()
    this.drawGlass()
    this.buildDust()
  }

  update(dtSec: number) {
    this.elapsedMs += dtSec * 1000
    const t = this.elapsedMs / 1000

    // Hit line shimmer — gentle brightness breathing
    const shimmer = 0.85 + 0.15 * Math.sin(t * this.style.hitLineShimmerSpeed)
    this.hitGlow.alpha = this.style.hitLineGlowAlpha * shimmer
    this.hitCore.alpha = 0.9 + 0.1 * shimmer

    // Moving diagonal glare across the glass band
    const period = Math.max(2, this.style.glareSpeed)
    const phase = (t % period) / period
    this.glare.x = -this.width * 0.4 + phase * this.width * 1.6
    this.glare.alpha = this.style.glareAlpha

    // Dust drifts upward with a slow sway
    for (const d of this.dustPool) {
      d.y -= d.speed * dtSec
      d.phase += dtSec
      if (d.y < -8) {
        d.y = this.height + 8
        d.x = Math.random() * this.width
      }
      d.gfx.x = d.x + Math.sin(d.phase * 0.7) * d.sway
      d.gfx.y = d.y
      // fade near top and bottom
      const edge = Math.min(d.y / 80, (this.height - d.y) / 80, 1)
      d.gfx.alpha = Math.max(0, edge) * this.style.dustAlpha
    }
  }

  // ── drawing ──

  private drawBackground() {
    const g = this.bg
    const { width: w, height: h } = this
    g.clear()
    // Vertical gradient in three blended bands
    const steps = 24
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      const color = t < 0.55
        ? mix(BG_TOP, BG_MID, t / 0.55)
        : mix(BG_MID, BG_BOTTOM, (t - 0.55) / 0.45)
      g.rect(0, (h / steps) * i, w, h / steps + 1)
      g.fill({ color })
    }
    // Warm halo behind the top of the stage (fakes the radial glow)
    for (let i = 0; i < 5; i++) {
      g.ellipse(w / 2, -h * 0.1, w * (0.75 - i * 0.1), h * (0.42 - i * 0.05))
      g.fill({ color: BG_GLOW, alpha: this.style.bgGlowAlpha * 0.25 })
    }
    // Side vignette
    g.rect(0, 0, w * 0.12, h)
    g.fill({ color: 0x000000, alpha: 0.22 })
    g.rect(w * 0.88, 0, w * 0.12, h)
    g.fill({ color: 0x000000, alpha: 0.22 })
  }

  private drawLanes() {
    const g = this.laneLines
    g.clear()
    const layout = this.layout
    if (!layout) return
    const a = this.style.laneLineAlpha

    if (layout.kind === 'piano') {
      // 88 hairlines would be noise — draw octave guides at each C instead.
      const piano = layout as PianoLaneLayout
      for (let lane = 0; lane < piano.laneCount; lane++) {
        const midi = piano.midiForLane(lane)
        if (midi % 12 !== 0) continue // C only
        const x = piano.laneCenterX(lane) - piano.noteWidth(lane) / 2
        this.drawHairline(g, x, a * 0.7)
      }
      return
    }

    // Pads: a hairline at each lane boundary + faint center guides
    for (let lane = 0; lane < layout.laneCount; lane++) {
      this.drawHairline(g, layout.laneCenterX(lane), a)
    }
  }

  /** Vertical hairline that brightens toward the hit line (stepped fade). */
  private drawHairline(g: Graphics, x: number, alpha: number) {
    const segs = [
      { from: 0.0, to: 0.45, a: 0.12 },
      { from: 0.45, to: 0.75, a: 0.35 },
      { from: 0.75, to: 1.0, a: 0.7 },
    ]
    for (const s of segs) {
      g.rect(x - 0.5, this.hitY * s.from, 1, this.hitY * (s.to - s.from))
      g.fill({ color: 0xe0a43b, alpha: alpha * s.a })
    }
  }

  private drawHitLine() {
    const { width: w } = this
    const y = this.hitY
    const inset = w * 0.04

    const glow = this.hitGlow
    glow.clear()
    // Wide bloom
    glow.rect(inset, y - 7, w - inset * 2, 14)
    glow.fill({ color: HIT_LINE_BLOOM, alpha: 0.16 })
    glow.rect(inset, y - 3.5, w - inset * 2, 7)
    glow.fill({ color: HIT_LINE_SOFT, alpha: 0.3 })

    const core = this.hitCore
    core.clear()
    core.rect(inset, y - 1, w - inset * 2, 2)
    core.fill({ color: HIT_LINE_CORE, alpha: 1 })
    // Soft ends — small fading caps
    core.rect(inset - 14, y - 0.5, 14, 1)
    core.fill({ color: HIT_LINE_SOFT, alpha: 0.3 })
    core.rect(w - inset, y - 0.5, 14, 1)
    core.fill({ color: HIT_LINE_SOFT, alpha: 0.3 })
  }

  private drawGlass() {
    const g = this.glassBand
    const { width: w, height: h } = this
    const y = this.hitY
    const bandH = h - y
    g.clear()
    // Sheen: brightest right under the line, fading down (stepped)
    const steps = 8
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      g.rect(0, y + bandH * t, w, bandH / steps + 1)
      g.fill({ color: GLASS_SHEEN, alpha: this.style.glassSheenAlpha * (1 - t) * (1 - t) })
    }
    // Edge highlight just under the hit line
    g.rect(w * 0.04, y + 5, w * 0.92, 1)
    g.fill({ color: GLASS_EDGE, alpha: 0.14 })

    // Glare bar (animated horizontally in update)
    const glare = this.glare
    glare.clear()
    const gw = w * 0.18
    glare.poly([gw * 0.35, y, gw, y, gw * 0.65, h, 0, h])
    glare.fill({ color: GLASS_EDGE, alpha: 1 })
    glare.alpha = this.style.glareAlpha
  }

  private buildDust() {
    // Rebuild pool only when the count changes
    const count = Math.round(this.style.dustCount)
    if (this.dustPool.length === count) return
    this.dustContainer.removeChildren()
    for (const d of this.dustPool) d.gfx.destroy()
    this.dustPool = []
    for (let i = 0; i < count; i++) {
      const gfx = new Graphics()
      gfx.circle(0, 0, 1 + Math.random())
      gfx.fill({ color: 0xffe8bf, alpha: 1 })
      this.dustContainer.addChild(gfx)
      this.dustPool.push({
        gfx,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 6 + Math.random() * 10,
        sway: 6 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
      })
    }
  }
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}
