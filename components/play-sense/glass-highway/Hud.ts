// components/play-sense/glass-highway/Hud.ts
//
// Minimal in-canvas HUD: a thin, large score centered at the top and a small
// tracking-wide COMBO line under it. Frozen at 0 while paused (GlassApp gates).

import { Container, Text, TextStyle } from 'pixi.js'
import { FONT_DISPLAY } from './constants'

export class Hud {
  readonly container = new Container()

  private score: Text
  private combo: Text
  private lastCombo = 0
  private comboPop = 0
  private width = 0

  constructor() {
    this.score = new Text({
      text: '0',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 34,
        fontWeight: '200',
        letterSpacing: 7,
        fill: 0xfff6e6,
      }),
    })
    this.score.anchor.set(0.5, 0)

    this.combo = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONT_DISPLAY,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 4,
        fill: 0xf7c878,
      }),
    })
    this.combo.anchor.set(0.5, 0)
    this.combo.alpha = 0.85

    this.container.addChild(this.score, this.combo)
  }

  resize(width: number, height: number) {
    void height
    this.width = width
    // Scale instead of mutating fontSize — in-place TextStyle mutation breaks
    // Pixi's text-texture refcounting.
    const scale = Math.max(22, Math.min(36, width * 0.045)) / 34
    this.score.scale.set(scale)
    this.score.position.set(width / 2, 16)
    this.combo.position.set(width / 2, 16 + this.score.height + 6)
  }

  update(score: number, combo: number, dtSec: number) {
    this.score.text = score.toLocaleString('en-US')
    // keep centered as the number grows
    this.score.x = this.width / 2
    this.combo.x = this.width / 2

    if (combo > this.lastCombo) this.comboPop = 1
    this.lastCombo = combo
    this.comboPop = Math.max(0, this.comboPop - dtSec * 4)

    if (combo > 1) {
      this.combo.text = `COMBO ×${combo}`
      this.combo.visible = true
      this.combo.scale.set(1 + this.comboPop * 0.18)
    } else {
      this.combo.visible = false
    }
  }
}
