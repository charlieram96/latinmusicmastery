// components/play-sense/glass-highway/textures.ts
//
// One-time texture baking. Notes/droplets/chunks are sprites stamped from
// these textures (per-frame work is transform-only — no Graphics tessellation).
// Color variants are baked lazily per lane color and cached.

import { Graphics, Renderer, Texture } from 'pixi.js'
import { NOTE_HOT_TOP, MISS_RED, MISS_RED_HI } from './constants'

/** Canonical pill bake size — sprites scale down from here. */
const PILL_W = 128
const PILL_H = 44
const PILL_R = PILL_H / 2

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

function darken(color: number, t: number): number {
  return mixColor(color, 0x000000, t)
}

export class TextureBank {
  private renderer: Renderer
  private pills = new Map<number, Texture>()
  private softPills = new Map<number, Texture>()
  private _trail: Texture | null = null
  private _droplet: Texture | null = null
  private _mist: Texture | null = null
  private _flash: Texture | null = null
  private _glowDot: Texture | null = null
  private chunks: Texture[] = []
  private _missPill: Texture | null = null

  constructor(renderer: Renderer) {
    this.renderer = renderer
  }

  private bake(draw: (g: Graphics) => void): Texture {
    const g = new Graphics()
    draw(g)
    const tex = this.renderer.generateTexture({ target: g, resolution: 2, antialias: true })
    g.destroy()
    return tex
  }

  /**
   * Luminous pill: cream-hot top fading to the lane color, dark base, bright
   * rim, soft outer glow halo baked in.
   */
  pill(color: number): Texture {
    const cached = this.pills.get(color)
    if (cached) return cached
    const tex = this.bake((g) => {
      const pad = 18 // room for the baked glow halo
      // Outer glow halo — expanding fills, decreasing alpha
      for (let i = 0; i < 4; i++) {
        g.roundRect(pad - i * 4, pad - i * 4, PILL_W + i * 8, PILL_H + i * 8, PILL_R + i * 4)
        g.fill({ color, alpha: 0.07 - i * 0.014 })
      }
      // Body base (darkened lane color)
      g.roundRect(pad, pad, PILL_W, PILL_H, PILL_R)
      g.fill({ color: darken(color, 0.35) })
      // Vertical gradient: stacked top-anchored rounded layers, shorter and
      // hotter toward the top — silhouette stays a clean pill throughout.
      const layers = 6
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1) // 0 = full height, 1 = top sliver
        const h = PILL_H * (0.9 - t * 0.62)
        const c = mixColor(color, NOTE_HOT_TOP, t * 0.85)
        g.roundRect(pad, pad, PILL_W, h, Math.min(PILL_R, h / 2))
        g.fill({ color: c, alpha: 0.38 })
      }
      // Hot core sheen near the top
      g.roundRect(pad + PILL_W * 0.12, pad + PILL_H * 0.1, PILL_W * 0.76, PILL_H * 0.3, PILL_H * 0.15)
      g.fill({ color: 0xffffff, alpha: 0.5 })
      // Bright rim
      g.roundRect(pad, pad, PILL_W, PILL_H, PILL_R)
      g.stroke({ color: NOTE_HOT_TOP, width: 2, alpha: 0.9 })
    })
    this.pills.set(color, tex)
    return tex
  }

  /** Pre-softened (blurred-looking) pill for reflections / sunk misses. */
  softPill(color: number): Texture {
    const cached = this.softPills.get(color)
    if (cached) return cached
    const tex = this.bake((g) => {
      const pad = 14
      for (let i = 0; i < 5; i++) {
        const spread = i * 5
        g.roundRect(pad - spread, pad - spread, PILL_W + spread * 2, PILL_H + spread * 2, PILL_R + spread)
        g.fill({ color, alpha: 0.22 - i * 0.04 })
      }
      g.roundRect(pad + PILL_W * 0.15, pad + PILL_H * 0.2, PILL_W * 0.7, PILL_H * 0.45, PILL_H * 0.22)
      g.fill({ color: NOTE_HOT_TOP, alpha: 0.25 })
    })
    this.softPills.set(color, tex)
    return tex
  }

  /** Red miss pill (single bake, tint-free). */
  missPill(): Texture {
    if (this._missPill) return this._missPill
    this._missPill = this.bake((g) => {
      const pad = 18
      for (let i = 0; i < 4; i++) {
        g.roundRect(pad - i * 4, pad - i * 4, PILL_W + i * 8, PILL_H + i * 8, PILL_R + i * 4)
        g.fill({ color: MISS_RED, alpha: 0.09 - i * 0.018 })
      }
      g.roundRect(pad, pad, PILL_W, PILL_H, PILL_R)
      g.fill({ color: darken(MISS_RED, 0.4) })
      const layers = 6
      for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1)
        const h = PILL_H * (0.9 - t * 0.62)
        g.roundRect(pad, pad, PILL_W, h, Math.min(PILL_R, h / 2))
        g.fill({ color: mixColor(MISS_RED, MISS_RED_HI, t * 0.8), alpha: 0.38 })
      }
      g.roundRect(pad, pad, PILL_W, PILL_H, PILL_R)
      g.stroke({ color: MISS_RED_HI, width: 2, alpha: 0.9 })
    })
    return this._missPill
  }

  /** White vertical trail strip (transparent top → bright bottom). Tint per lane. */
  trail(): Texture {
    if (this._trail) return this._trail
    this._trail = this.bake((g) => {
      const W = 24
      const H = 160
      const steps = 32
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1)
        // wider + brighter toward the bottom, seamless slices
        const w = W * (0.3 + t * 0.4)
        g.rect((W - w) / 2, (H / steps) * i, w, H / steps + 1.5)
        g.fill({ color: 0xffffff, alpha: t * t * 0.5 })
      }
    })
    return this._trail
  }

  /** Soft white droplet — tint per lane color. */
  droplet(): Texture {
    if (this._droplet) return this._droplet
    this._droplet = this.bake((g) => {
      g.circle(12, 12, 11)
      g.fill({ color: 0xffffff, alpha: 0.18 })
      g.circle(12, 12, 7)
      g.fill({ color: 0xffffff, alpha: 0.5 })
      g.circle(12, 12, 4)
      g.fill({ color: 0xffffff, alpha: 1 })
    })
    return this._droplet
  }

  /** Soft round mist puff. */
  mist(): Texture {
    if (this._mist) return this._mist
    this._mist = this.bake((g) => {
      const R = 40
      for (let i = 0; i < 5; i++) {
        g.circle(R, R, R - i * 7)
        g.fill({ color: 0xffffff, alpha: 0.05 + i * 0.02 })
      }
    })
    return this._mist
  }

  /** Horizontal hot flash ellipse. */
  flash(): Texture {
    if (this._flash) return this._flash
    this._flash = this.bake((g) => {
      const W = 140
      const H = 44
      for (let i = 0; i < 5; i++) {
        const t = i / 4
        g.ellipse(W / 2, H / 2, (W / 2) * (1 - t * 0.7), (H / 2) * (1 - t * 0.65))
        g.fill({ color: 0xffffff, alpha: 0.12 + t * 0.2 })
      }
    })
    return this._flash
  }

  /** Generic soft radial glow dot (ripple glow, red seep, pad flash). */
  glowDot(): Texture {
    if (this._glowDot) return this._glowDot
    this._glowDot = this.bake((g) => {
      const R = 48
      for (let i = 0; i < 6; i++) {
        g.circle(R, R, R - i * 7.5)
        g.fill({ color: 0xffffff, alpha: 0.04 + i * 0.035 })
      }
    })
    return this._glowDot
  }

  /** Three irregular fragment shapes — tint per lane color. */
  chunk(index: number): Texture {
    if (this.chunks.length === 0) {
      this.chunks = [
        this.bake((g) => {
          g.poly([0, 6, 10, 0, 22, 4, 18, 14, 6, 16])
          g.fill({ color: 0xffffff, alpha: 1 })
        }),
        this.bake((g) => {
          g.poly([0, 0, 14, 2, 16, 12, 4, 10])
          g.fill({ color: 0xffffff, alpha: 1 })
        }),
        this.bake((g) => {
          g.poly([2, 8, 8, 0, 14, 6, 10, 14])
          g.fill({ color: 0xffffff, alpha: 1 })
        }),
      ]
    }
    return this.chunks[index % this.chunks.length]
  }

  /**
   * Drop all references without destroying — call AFTER app.destroy(), which
   * already frees GPU resources for stage-reachable textures. Destroying them
   * again here races the renderer teardown (renderPipeId errors).
   */
  dispose() {
    this.pills.clear()
    this.softPills.clear()
    this.chunks = []
    this._trail = this._droplet = this._mist = this._flash = this._glowDot = this._missPill = null
  }
}
