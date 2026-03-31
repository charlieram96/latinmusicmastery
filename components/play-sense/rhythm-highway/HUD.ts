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
 * In-canvas HUD: all stats rendered in a right-side vertical panel.
 * Score, combo, accuracy, progress, title/BPM — stacked on the right.
 * Call resize() on canvas resize, update() each frame with current values.
 */
export class HUD {
  readonly container = new Container()

  // Right-side panel background
  private panelBg = new Graphics()

  // Score
  private scoreText: Text
  private scoreLabelText: Text
  private scorePopText: Text
  private scorePopLife = 0

  // Combo
  private comboText: Text
  private comboLabelText: Text
  private comboBar = new Graphics()
  private comboBarBg = new Graphics()

  // Accuracy ring
  private accuracyText: Text
  private accuracyRing = new Graphics()
  private accuracyLabelText: Text

  // Progress
  private progressBg = new Graphics()
  private progressFill = new Graphics()
  private timeText: Text

  // Exercise info
  private titleText: Text
  private bpmText: Text

  // Separator lines
  private separators = new Graphics()

  private width = 0
  private height = 0
  private lastScore = 0
  private panelWidth = 180

  constructor() {
    const labelOpts = {
      fontFamily: HUD_FONT_FAMILY,
      fontSize: HUD_LABEL_SIZE,
      fontWeight: '600' as const,
      fill: 0xffffff,
      letterSpacing: 2,
    }

    // Score
    this.scoreText = new Text({
      text: '0',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: HUD_SCORE_SIZE, fontWeight: '900', fill: 0xffffff }),
    })
    this.scoreLabelText = new Text({ text: 'SCORE', style: new TextStyle(labelOpts) })
    this.scoreLabelText.alpha = 0.4
    this.scorePopText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 13, fontWeight: '700', fill: RAIL_COLOR }),
    })
    this.scorePopText.visible = false

    // Combo
    this.comboText = new Text({
      text: '0',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: HUD_COMBO_SIZE, fontWeight: '900', fill: 0x2ecc71 }),
    })
    this.comboLabelText = new Text({ text: 'COMBO', style: new TextStyle(labelOpts) })
    this.comboLabelText.alpha = 0.5
    this.comboLabelText.style.fill = 0x2ecc71

    // Accuracy
    this.accuracyText = new Text({
      text: '100%',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 18, fontWeight: '800', fill: 0x2ecc71 }),
    })
    this.accuracyText.anchor.set(0.5)
    this.accuracyLabelText = new Text({ text: 'ACCURACY', style: new TextStyle(labelOpts) })
    this.accuracyLabelText.alpha = 0.4
    this.accuracyLabelText.anchor.set(0.5, 0)

    // Time
    this.timeText = new Text({
      text: '0:00 / 0:00',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 11, fill: 0xffffff }),
    })
    this.timeText.alpha = 0.5
    this.timeText.anchor.set(0.5, 0)

    // Exercise info
    this.titleText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 11, fill: RAIL_COLOR, fontWeight: '700', letterSpacing: 1 }),
    })
    this.titleText.anchor.set(0.5, 0)
    this.bpmText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff, letterSpacing: 1 }),
    })
    this.bpmText.anchor.set(0.5, 0)
    this.bpmText.alpha = 0.35

    this.container.addChild(
      this.panelBg, this.separators,
      this.titleText, this.bpmText,
      this.scoreText, this.scoreLabelText, this.scorePopText,
      this.comboText, this.comboLabelText,
      this.comboBarBg, this.comboBar,
      this.accuracyRing, this.accuracyText, this.accuracyLabelText,
      this.progressBg, this.progressFill, this.timeText,
    )
  }

  setExerciseInfo(title: string, bpm: number) {
    this.titleText.text = title.toUpperCase()
    this.bpmText.text = `${bpm} BPM`
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.panelWidth = Math.min(180, width * 0.2)
    this.layout()
  }

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

    // Score pop
    if (this.scorePopLife > 0) {
      this.scorePopLife -= dt
      this.scorePopText.alpha = Math.max(0, this.scorePopLife / 0.6)
      if (this.scorePopLife <= 0) this.scorePopText.visible = false
    }

    // Combo
    this.comboText.text = String(combo)
    const comboColor = combo >= COMBO_FIRE_THRESHOLD ? 0x00e5ff : 0x00e676
    this.comboText.style.fill = comboColor
    this.comboLabelText.style.fill = comboColor

    // Combo bar
    this.comboBar.clear()
    const barX = this.width - this.panelWidth + 16
    const barWidth = this.panelWidth - 32
    const barFill = Math.min(combo / COMBO_FIRE_THRESHOLD, 1)
    if (barFill > 0) {
      this.comboBar.roundRect(barX, this.comboBarY, barWidth * barFill, 3, 1.5)
      this.comboBar.fill(combo >= COMBO_FIRE_THRESHOLD ? 0xffd93d : 0x2ecc71)
    }

    // Accuracy
    const accPct = Math.round(accuracy)
    this.accuracyText.text = `${accPct}%`
    this.drawAccuracyRing(accuracy / 100)

    // Progress
    this.drawProgress(progress)
    this.timeText.text = `${this.formatTime(elapsedSec)} / ${this.formatTime(totalSec)}`
  }

  // Used by combo bar positioning
  private comboBarY = 0

  private layout() {
    const px = this.width - this.panelWidth
    const cx = px + this.panelWidth / 2
    const pad = 16
    let y = pad

    // Clear separators for redraw
    this.separators.clear()

    // Panel background — subtle dark overlay on right side
    this.panelBg.clear()
    this.panelBg.roundRect(px, 0, this.panelWidth, this.height, 0)
    this.panelBg.fill({ color: 0x020208, alpha: 0.7 })
    // Left edge neon line
    this.panelBg.moveTo(px, 0)
    this.panelBg.lineTo(px, this.height)
    this.panelBg.stroke({ color: RAIL_COLOR, width: 1, alpha: 0.3 })
    // Glow on edge
    this.panelBg.moveTo(px, 0)
    this.panelBg.lineTo(px, this.height)
    this.panelBg.stroke({ color: RAIL_COLOR, width: 6, alpha: 0.05 })

    // ── Exercise title + BPM ──
    this.titleText.x = cx
    this.titleText.y = y
    y += 16
    this.bpmText.x = cx
    this.bpmText.y = y
    y += 24

    this.drawSeparator(y)
    y += 12

    // ── Score section ──
    this.scoreLabelText.x = px + pad
    this.scoreLabelText.y = y
    y += 14
    this.scoreText.x = px + pad
    this.scoreText.y = y
    this.scorePopText.x = px + pad + 90
    this.scorePopText.y = y + 8
    y += HUD_SCORE_SIZE + 8

    this.drawSeparator(y)
    y += 12

    // ── Combo section ──
    this.comboLabelText.x = px + pad
    this.comboLabelText.y = y
    y += 14
    this.comboText.x = px + pad
    this.comboText.y = y
    y += HUD_COMBO_SIZE + 4

    // Combo bar
    this.comboBarY = y
    this.comboBarBg.clear()
    this.comboBarBg.roundRect(px + pad, y, this.panelWidth - pad * 2, 3, 1.5)
    this.comboBarBg.fill({ color: 0xffffff, alpha: 0.08 })
    y += 16

    this.drawSeparator(y)
    y += 16

    // ── Accuracy section ──
    this.accuracyRing.x = cx
    this.accuracyRing.y = y + 26
    this.accuracyText.x = cx
    this.accuracyText.y = y + 26
    y += 56
    this.accuracyLabelText.x = cx
    this.accuracyLabelText.y = y
    y += 20

    this.drawSeparator(y)
    y += 12

    // ── Progress section (near bottom) ──
    const progressY = this.height - 50
    const progressBarY = progressY
    const progressWidth = this.panelWidth - pad * 2

    this.progressBg.x = 0
    this.progressFill.x = 0

    this.timeText.x = cx
    this.timeText.y = progressY + 12
  }

  private separatorCount = 0
  private drawSeparator(y: number) {
    const px = this.width - this.panelWidth
    const pad = 16
    // Only draw on first layout call (clear handles reset)
    this.separators.moveTo(px + pad, y)
    this.separators.lineTo(px + this.panelWidth - pad, y)
    this.separators.stroke({ color: 0xffffff, width: 1, alpha: 0.06 })
  }

  private drawAccuracyRing(fraction: number) {
    this.accuracyRing.clear()
    const r = 24
    this.accuracyRing.circle(0, 0, r)
    this.accuracyRing.stroke({ color: 0xffffff, width: 2, alpha: 0.08 })
    if (fraction > 0) {
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + Math.PI * 2 * fraction
      this.accuracyRing.arc(0, 0, r, startAngle, endAngle)
      this.accuracyRing.stroke({ color: 0x2ecc71, width: 2, alpha: 0.5 })
    }
  }

  private drawProgress(fraction: number) {
    const px = this.width - this.panelWidth
    const pad = 16
    const y = this.height - 50
    const w = this.panelWidth - pad * 2

    this.progressBg.clear()
    this.progressBg.roundRect(px + pad, y, w, 3, 1.5)
    this.progressBg.fill({ color: 0xffffff, alpha: 0.06 })

    this.progressFill.clear()
    if (fraction > 0) {
      this.progressFill.roundRect(px + pad, y, w * Math.min(fraction, 1), 3, 1.5)
      this.progressFill.fill(RAIL_COLOR)
    }
  }

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}
