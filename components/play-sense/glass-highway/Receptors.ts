// components/play-sense/glass-highway/Receptors.ts
//
// What lanes land on. Two renderers:
//  - GlassPads: etched glass pads tinted per surface with uppercase labels
//  - PianoKeyboard: a real 88-key keyboard under the hit line, keys light up
// Both expose flash(lane, grade) and a per-frame update(dt) that decays flashes.

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { HitGrade } from '@/lib/play-sense/types'
import type { GlassStyle } from './style'
import type { LaneLayout } from './LaneLayout'
import { PianoLaneLayout, isBlackKey, PIANO_LOW_MIDI } from './LaneLayout'
import { FONT_DISPLAY, GRADE_COLORS_HEX, MISS_RED } from './constants'

export interface ReceptorRenderer {
  readonly container: Container
  resize(layout: LaneLayout, hitY: number, width: number, height: number): void
  flash(lane: number, grade: HitGrade): void
  update(dtSec: number): void
  setStyle(style: GlassStyle): void
  destroy(): void
}

interface Flash {
  gfx: Graphics
  energy: number // 1 → 0
  color: number
}

// ── Etched glass pads ─────────────────────────────────────────────────────

export class GlassPads implements ReceptorRenderer {
  readonly container = new Container()

  private pads = new Graphics()
  private labels: Text[] = []
  private flashes: Flash[] = []
  private style: GlassStyle
  private layout: LaneLayout | null = null
  private hitY = 0
  private padH = 0

  constructor(style: GlassStyle) {
    this.style = style
    this.container.addChild(this.pads)
  }

  setStyle(style: GlassStyle) {
    this.style = style
    if (this.layout) this.redraw()
  }

  resize(layout: LaneLayout, hitY: number, width: number, height: number) {
    void width
    this.layout = layout
    this.hitY = hitY
    this.padH = Math.min(34, (height - hitY) * 0.34)
    this.redraw()
  }

  private redraw() {
    const layout = this.layout
    if (!layout) return
    const g = this.pads
    g.clear()

    // Labels: rebuild when lane count changes
    if (this.labels.length !== layout.laneCount) {
      for (const t of this.labels) { this.container.removeChild(t); t.destroy() }
      this.labels = []
      for (let i = 0; i < layout.laneCount; i++) {
        const text = new Text({
          text: layout.laneLabel(i),
          style: new TextStyle({
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 2,
            fill: 0xfff6e6,
          }),
        })
        text.anchor.set(0.5)
        this.container.addChild(text)
        this.labels.push(text)
      }
      // Flash overlays — one Graphics per lane, drawn on demand
      for (const f of this.flashes) { this.container.removeChild(f.gfx); f.gfx.destroy() }
      this.flashes = []
      for (let i = 0; i < layout.laneCount; i++) {
        const gfx = new Graphics()
        gfx.visible = false
        this.container.addChild(gfx)
        this.flashes.push({ gfx, energy: 0, color: 0xffffff })
      }
    }

    const y = this.hitY + 10
    for (let i = 0; i < layout.laneCount; i++) {
      const cx = layout.laneCenterX(i)
      const w = layout.noteWidth(i) * 1.25
      const color = layout.laneColor(i)
      // Etched glass pad: faint tinted fill, brighter tinted stroke, inner top edge
      g.roundRect(cx - w / 2, y, w, this.padH, 7)
      g.fill({ color, alpha: this.style.padFillAlpha })
      g.roundRect(cx - w / 2, y, w, this.padH, 7)
      g.stroke({ color, width: 1, alpha: this.style.padStrokeAlpha })
      g.roundRect(cx - w / 2 + 2, y + 2, w - 4, 3, 2)
      g.fill({ color: 0xffffff, alpha: 0.07 })

      const label = this.labels[i]
      label.text = layout.laneLabel(i)
      label.alpha = 0.55
      label.position.set(cx, y + this.padH / 2)
      // Shrink label to fit the pad via scale (never mutate TextStyle in place
      // — that desyncs Pixi's text-texture refcounting and crashes on destroy)
      label.scale.set(1)
      if (label.width > w - 8) {
        label.scale.set(Math.max(0.6, (w - 8) / label.width))
      }
    }
  }

  flash(lane: number, grade: HitGrade) {
    const layout = this.layout
    const f = this.flashes[lane]
    if (!layout || !f) return
    f.energy = 1
    f.color = grade === 'miss' ? MISS_RED : GRADE_COLORS_HEX[grade]
    const cx = layout.laneCenterX(lane)
    const w = layout.noteWidth(lane) * 1.25
    const y = this.hitY + 10
    f.gfx.clear()
    f.gfx.roundRect(cx - w / 2, y, w, this.padH, 7)
    f.gfx.fill({ color: f.color, alpha: 1 })
    f.gfx.roundRect(cx - w / 2 - 3, y - 3, w + 6, this.padH + 6, 9)
    f.gfx.stroke({ color: f.color, width: 2, alpha: 0.8 })
    f.gfx.blendMode = 'add'
  }

  update(dtSec: number) {
    for (const f of this.flashes) {
      if (f.energy <= 0) {
        f.gfx.visible = false
        continue
      }
      f.energy = Math.max(0, f.energy - dtSec * 4)
      f.gfx.visible = true
      f.gfx.alpha = this.style.padFlashAlpha * f.energy * f.energy
    }
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}

// ── 88-key piano keyboard ─────────────────────────────────────────────────

const WHITE_KEY = 0xf1ece6
const WHITE_KEY_SHADOW = 0xb9b0a4
const BLACK_KEY = 0x14100d
const BLACK_KEY_HI = 0x3a3027

export class PianoKeyboard implements ReceptorRenderer {
  readonly container = new Container()

  private board = new Graphics()
  private lights: Flash[] = []
  private cLabels: Text[] = []
  private style: GlassStyle
  private layout: PianoLaneLayout | null = null
  private hitY = 0
  private kbH = 0

  constructor(style: GlassStyle) {
    this.style = style
    this.container.addChild(this.board)
  }

  setStyle(style: GlassStyle) {
    this.style = style
    if (this.layout) this.redraw()
  }

  resize(layout: LaneLayout, hitY: number, width: number, height: number) {
    if (!(layout instanceof PianoLaneLayout)) return
    this.layout = layout
    this.hitY = hitY
    this.kbH = Math.min(110, Math.max(48, (height - hitY) * 0.74))
    void width
    this.redraw()
  }

  private redraw() {
    const layout = this.layout
    if (!layout) return
    const g = this.board
    g.clear()
    const y = this.hitY + 6
    const whiteW = layout.whiteKeyWidth()
    const detailed = whiteW >= 6 // below this, drop strokes/bevels

    // Felt strip above the keys
    g.rect(0, y - 3, whiteW * 52, 3)
    g.fill({ color: 0x8a2a1c, alpha: 0.8 })

    // White keys first
    for (let lane = 0; lane < layout.laneCount; lane++) {
      const midi = layout.midiForLane(lane)
      if (isBlackKey(midi)) continue
      const cx = layout.laneCenterX(lane)
      const w = whiteW - (detailed ? 1 : 0.5)
      g.roundRect(cx - w / 2, y, w, this.kbH, detailed ? 2.5 : 0)
      g.fill({ color: WHITE_KEY })
      if (detailed) {
        // bottom shadow lip
        g.roundRect(cx - w / 2, y + this.kbH - 4, w, 4, 2)
        g.fill({ color: WHITE_KEY_SHADOW, alpha: 0.6 })
      }
    }

    // Black keys on top
    const blackH = this.kbH * 0.62
    for (let lane = 0; lane < layout.laneCount; lane++) {
      const midi = layout.midiForLane(lane)
      if (!isBlackKey(midi)) continue
      const cx = layout.laneCenterX(lane)
      const w = Math.max(layout.noteWidth(lane) / 0.9, 2)
      g.roundRect(cx - w / 2, y, w, blackH, detailed ? 2 : 0)
      g.fill({ color: BLACK_KEY })
      if (detailed) {
        g.roundRect(cx - w / 2 + 1, y + 1, w - 2, blackH * 0.25, 1.5)
        g.fill({ color: BLACK_KEY_HI, alpha: 0.7 })
      }
    }

    // C labels for orientation (only when keys are wide enough)
    for (const t of this.cLabels) { this.container.removeChild(t); t.destroy() }
    this.cLabels = []
    if (whiteW >= 11) {
      for (let lane = 0; lane < layout.laneCount; lane++) {
        const label = layout.laneLabel(lane)
        if (!label) continue
        const text = new Text({
          text: label,
          style: new TextStyle({
            fontFamily: FONT_DISPLAY,
            fontSize: Math.min(9, whiteW * 0.55),
            fontWeight: '600',
            fill: 0x9a8f83,
          }),
        })
        text.anchor.set(0.5, 1)
        text.position.set(layout.laneCenterX(lane), y + this.kbH - 5)
        this.container.addChild(text)
        this.cLabels.push(text)
      }
    }

    // Per-key light overlays
    if (this.lights.length !== layout.laneCount) {
      for (const f of this.lights) { this.container.removeChild(f.gfx); f.gfx.destroy() }
      this.lights = []
      for (let i = 0; i < layout.laneCount; i++) {
        const gfx = new Graphics()
        gfx.visible = false
        this.container.addChild(gfx)
        this.lights.push({ gfx, energy: 0, color: 0xffffff })
      }
    }
  }

  flash(lane: number, grade: HitGrade) {
    const layout = this.layout
    const f = this.lights[lane]
    if (!layout || !f) return
    f.energy = 1
    f.color = grade === 'miss' ? MISS_RED : layout.laneColor(lane)
    const y = this.hitY + 6
    const midi = layout.midiForLane(lane)
    const black = isBlackKey(midi)
    const h = black ? this.kbH * 0.62 : this.kbH
    const w = black ? Math.max(layout.noteWidth(lane) / 0.9, 2) : layout.whiteKeyWidth() - 1
    const cx = layout.laneCenterX(lane)
    f.gfx.clear()
    f.gfx.roundRect(cx - w / 2, y, w, h, 2)
    f.gfx.fill({ color: f.color, alpha: 1 })
    // Glow halo above the key, at the hit line
    f.gfx.ellipse(cx, this.hitY, w * 1.4, 10)
    f.gfx.fill({ color: f.color, alpha: 0.5 })
    f.gfx.blendMode = 'add'
  }

  update(dtSec: number) {
    for (const f of this.lights) {
      if (f.energy <= 0) {
        f.gfx.visible = false
        continue
      }
      f.energy = Math.max(0, f.energy - dtSec * 3.2)
      f.gfx.visible = true
      f.gfx.alpha = this.style.keyLightAlpha * f.energy * f.energy
    }
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}

export function createReceptors(layout: LaneLayout, style: GlassStyle): ReceptorRenderer {
  return layout.kind === 'piano' ? new PianoKeyboard(style) : new GlassPads(style)
}
