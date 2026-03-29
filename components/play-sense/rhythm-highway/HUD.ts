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
 * In-canvas HUD: score, combo, accuracy ring, progress bar, BPM/title.
 * Call resize() on canvas resize, update() each frame with current values.
 */
export class HUD {
  readonly container = new Container()

  // Score (top-right)
  private scoreText: Text
  private scoreLabelText: Text
  private scorePopText: Text
  private scorePopLife = 0

  // Combo (top-left)
  private comboText: Text
  private comboLabelText: Text
  private comboBar = new Graphics()
  private comboBarBg = new Graphics()

  // Accuracy ring (top-center)
  private accuracyText: Text
  private accuracyRing = new Graphics()

  // Progress bar (bottom)
  private progressBg = new Graphics()
  private progressFill = new Graphics()
  private timeLeftText: Text
  private timeRightText: Text
  private titleText: Text
  private bpmText: Text

  private width = 0
  private height = 0
  private lastScore = 0

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
    this.scoreText.anchor.set(1, 0)
    this.scoreLabelText = new Text({ text: 'SCORE', style: new TextStyle(labelOpts) })
    this.scoreLabelText.anchor.set(1, 0)
    this.scoreLabelText.alpha = 0.4
    this.scorePopText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 14, fontWeight: '700', fill: RAIL_COLOR }),
    })
    this.scorePopText.anchor.set(1, 0)
    this.scorePopText.visible = false

    // Combo
    this.comboText = new Text({
      text: '0',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: HUD_COMBO_SIZE, fontWeight: '900', fill: 0x2ecc71 }),
    })
    this.comboLabelText = new Text({ text: 'COMBO', style: new TextStyle(labelOpts) })
    this.comboLabelText.alpha = 0.7
    this.comboLabelText.style.fill = 0x2ecc71

    // Accuracy
    this.accuracyText = new Text({
      text: '100%',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 14, fontWeight: '800', fill: 0x2ecc71 }),
    })
    this.accuracyText.anchor.set(0.5)

    // Progress
    this.timeLeftText = new Text({
      text: '0:00',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff }),
    })
    this.timeLeftText.alpha = 0.4
    this.timeRightText = new Text({
      text: '0:00',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff }),
    })
    this.timeRightText.anchor.set(1, 0)
    this.timeRightText.alpha = 0.4
    this.titleText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff, letterSpacing: 1 }),
    })
    this.titleText.anchor.set(0.5, 0)
    this.titleText.alpha = 0.3
    this.bpmText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: HUD_FONT_FAMILY, fontSize: 10, fill: 0xffffff, letterSpacing: 1 }),
    })
    this.bpmText.anchor.set(0.5, 0)
    this.bpmText.alpha = 0.3

    this.container.addChild(
      this.comboBarBg, this.comboBar,
      this.scoreText, this.scoreLabelText, this.scorePopText,
      this.comboText, this.comboLabelText,
      this.accuracyRing, this.accuracyText,
      this.progressBg, this.progressFill,
      this.timeLeftText, this.timeRightText, this.titleText, this.bpmText,
    )
  }

  /** Set exercise info (call once on init) */
  setExerciseInfo(title: string, bpm: number) {
    this.titleText.text = title.toUpperCase()
    this.bpmText.text = `♩ ${bpm} BPM`
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
  }

  /**
   * Update HUD values each frame.
   * progress: 0-1, elapsed/total in seconds
   */
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

    // Score pop animation
    if (this.scorePopLife > 0) {
      this.scorePopLife -= dt
      this.scorePopText.alpha = Math.max(0, this.scorePopLife / 0.6)
      if (this.scorePopLife <= 0) this.scorePopText.visible = false
    }

    // Combo
    this.comboText.text = String(combo)
    const comboColor = combo >= COMBO_FIRE_THRESHOLD ? 0xffd93d : 0x2ecc71
    this.comboText.style.fill = comboColor
    this.comboLabelText.style.fill = comboColor

    // Combo bar
    this.comboBar.clear()
    const barWidth = 120
    const barFill = Math.min(combo / COMBO_FIRE_THRESHOLD, 1)
    this.comboBar.roundRect(20, 60, barWidth * barFill, 4, 2)
    if (combo >= COMBO_FIRE_THRESHOLD) {
      this.comboBar.fill(0xffd93d)
    } else {
      this.comboBar.fill(0x2ecc71)
    }

    // Accuracy
    const accPct = Math.round(accuracy)
    this.accuracyText.text = `${accPct}%`
    this.drawAccuracyRing(accuracy / 100)

    // Progress
    this.drawProgress(progress)
    this.timeLeftText.text = this.formatTime(elapsedSec)
    this.timeRightText.text = this.formatTime(totalSec)
  }

  // ── Private ──

  private layout() {
    const pad = 20

    // Score — top right
    this.scoreText.x = this.width - pad
    this.scoreText.y = pad
    this.scoreLabelText.x = this.width - pad
    this.scoreLabelText.y = pad + HUD_SCORE_SIZE + 2
    this.scorePopText.x = this.width - pad
    this.scorePopText.y = pad + HUD_SCORE_SIZE + 16

    // Combo — top left
    this.comboText.x = pad
    this.comboText.y = pad
    this.comboLabelText.x = pad + 50
    this.comboLabelText.y = pad + HUD_COMBO_SIZE - HUD_LABEL_SIZE - 2

    // Combo bar bg
    this.comboBarBg.clear()
    this.comboBarBg.roundRect(pad, 60, 120, 4, 2)
    this.comboBarBg.fill({ color: 0xffffff, alpha: 0.1 })

    // Accuracy ring — top center
    this.accuracyRing.x = this.width / 2
    this.accuracyRing.y = pad + 24
    this.accuracyText.x = this.width / 2
    this.accuracyText.y = pad + 24

    // Progress — bottom
    const bottomY = this.height - 30
    this.timeLeftText.x = pad
    this.timeLeftText.y = bottomY
    this.timeRightText.x = this.width - pad
    this.timeRightText.y = bottomY
    this.titleText.x = this.width / 2
    this.titleText.y = bottomY - 16
    this.bpmText.x = this.width / 2
    this.bpmText.y = this.height * 0.12
  }

  private drawAccuracyRing(fraction: number) {
    this.accuracyRing.clear()
    const r = 22
    // Background ring
    this.accuracyRing.circle(0, 0, r)
    this.accuracyRing.stroke({ color: 0xffffff, width: 3, alpha: 0.1 })
    // Fill arc
    if (fraction > 0) {
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + Math.PI * 2 * fraction
      this.accuracyRing.arc(0, 0, r, startAngle, endAngle)
      this.accuracyRing.stroke({ color: 0x2ecc71, width: 3, alpha: 0.6 })
    }
  }

  private drawProgress(fraction: number) {
    const pad = 20
    const y = this.height - 18
    const w = this.width - pad * 2

    this.progressBg.clear()
    this.progressBg.roundRect(pad, y, w, 3, 1.5)
    this.progressBg.fill({ color: 0xffffff, alpha: 0.08 })

    this.progressFill.clear()
    if (fraction > 0) {
      this.progressFill.roundRect(pad, y, w * Math.min(fraction, 1), 3, 1.5)
      this.progressFill.fill(RAIL_COLOR)
    }
  }

  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}
