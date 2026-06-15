// components/play-sense/glass-highway/GlassApp.ts
//
// Top-level PixiJS application for the Obsidian Glass highway.
// Public API and paused semantics are identical to the legacy HighwayApp so
// GlassHighway is a drop-in replacement for RhythmHighway.

import { Application, Container, Renderer, Text, TexturePool } from 'pixi.js'

// Workaround for a pixi 8.17 teardown bug: destroying an Application (or a
// Text) can return text canvas textures to the global TexturePool after its
// buckets were cleared, crashing with "push of undefined". Make returnTexture
// drop unknown textures instead of crashing — they're reclaimed by GC.
const pool = TexturePool as unknown as {
  __lmmSafeReturn?: boolean
  _poolKeyHash?: Record<number, number>
  _texturePool?: Record<number, unknown[]>
  returnTexture: (texture: { uid: number }, resetStyle?: boolean) => void
}
if (!pool.__lmmSafeReturn) {
  pool.__lmmSafeReturn = true
  const originalReturn = pool.returnTexture.bind(TexturePool)
  pool.returnTexture = (texture, resetStyle) => {
    const key = pool._poolKeyHash?.[texture.uid]
    if (key == null || !pool._texturePool?.[key]) return
    originalReturn(texture, resetStyle)
  }
}
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { DEFAULT_GLASS_STYLE, type GlassStyle } from './style'
import { createLaneLayout, type LaneLayout } from './LaneLayout'
import { TextureBank } from './textures'
import { Scene } from './Scene'
import { createReceptors, type ReceptorRenderer } from './Receptors'
import { NoteField } from './NoteField'
import { Effects } from './Effects'
import { Hud } from './Hud'

export class GlassApp {
  private app: Application
  private textures: TextureBank
  private scene: Scene
  private noteField: NoteField
  private effects: Effects
  private hud: Hud
  private receptors: ReceptorRenderer | null = null
  private layout: LaneLayout | null = null

  private exerciseDuration = 0
  private destroyed = false
  private resizeObserver: ResizeObserver | null = null
  private showHud: boolean

  // Refs set by the React wrapper — read each frame
  playheadProgress = 0
  currentScore = 0
  currentCombo = 0
  currentAccuracy = 100
  metronomeBeat = 0
  /** When true: scene still renders, but notes don't scroll and HUD freezes at 0. */
  paused = false

  private _style: GlassStyle = { ...DEFAULT_GLASS_STYLE }

  private constructor(app: Application, showHud: boolean) {
    this.app = app
    this.showHud = showHud
    this.textures = new TextureBank(app.renderer as Renderer)
    this.scene = new Scene(this._style)
    this.noteField = new NoteField(this.textures, this._style)
    this.effects = new Effects(this.textures, this._style)
    this.hud = new Hud()

    // Layer order: bg+lanes → reflections / sunk misses / red seep (under
    // glass) → glass band + hit line → notes → receptors → effects → HUD
    app.stage.addChild(
      this.scene.container,
      this.noteField.reflectionContainer,
      this.noteField.belowGlassContainer,
      this.effects.underGlassContainer,
      this.scene.glassContainer,
      this.noteField.container,
    )

    // Receptors are added in init() (they depend on the instrument)
    app.stage.addChild(this.effects.container)
    if (this.showHud) app.stage.addChild(this.hud.container)

    // Wire miss-crossing → ripple/red seep/MISS text
    this.noteField.onMissCross = (x, lane) => {
      this.effects.triggerMissCross(x)
      this.receptors?.flash(lane, 'miss')
    }
  }

  /** Factory — mirrors HighwayApp.create. */
  static async create(container: HTMLDivElement, options?: { showHud?: boolean }): Promise<GlassApp> {
    const app = new Application()
    await app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    container.appendChild(app.canvas as HTMLCanvasElement)

    const instance = new GlassApp(app, options?.showHud ?? true)
    instance.resize()

    const observer = new ResizeObserver(() => {
      if (!instance.destroyed) instance.resize()
    })
    observer.observe(container)
    instance.resizeObserver = observer

    app.ticker.add((ticker) => {
      if (!instance.destroyed) {
        instance.update(ticker.deltaMS / 1000)
      }
    })

    return instance
  }

  /** Initialize with an exercise. Re-callable (lab page switches instruments). */
  init(exercise: ExerciseDefinition) {
    this.exerciseDuration = getExerciseDuration(exercise)
    this.layout = createLaneLayout(exercise)

    // Swap receptors for the new instrument
    if (this.receptors) {
      this.app.stage.removeChild(this.receptors.container)
      GlassApp.detachTexts(this.receptors.container) // see destroy() rationale
      this.receptors.destroy()
    }
    this.receptors = createReceptors(this.layout, this._style)
    // Keep receptors under effects + HUD
    const idx = this.app.stage.getChildIndex(this.effects.container)
    this.app.stage.addChildAt(this.receptors.container, idx)

    this.scene.setLayout(this.layout)
    this.noteField.init(exercise, this.layout)
    this.resize()
  }

  /** Live-editable style — lab sliders write here. */
  get style(): GlassStyle {
    return this._style
  }

  set style(style: GlassStyle) {
    this._style = { ...style }
    this.scene.setStyle(this._style)
    this.noteField.setStyle(this._style)
    this.effects.setStyle(this._style)
    this.receptors?.setStyle(this._style)
    this.resize() // hitLineFraction / approach changes move geometry
  }

  /** Find the unjudged note closest to the hit line. */
  getClosestEventIndex(): number | null {
    const elapsed = this.playheadProgress * this.exerciseDuration
    return this.noteField.getClosestEventIndex(elapsed)
  }

  /** Called by React when a note is hit. */
  triggerHitEffect(eventIndex: number, grade: HitGrade) {
    if (!this.layout) return
    const lane = this.noteField.getLaneForEvent(eventIndex)
    const color = this.noteField.getColorForEvent(eventIndex)
    this.noteField.markHit(eventIndex)
    this.effects.triggerHit(this.layout.laneCenterX(lane), grade, color)
    this.receptors?.flash(lane, grade)
  }

  /** Called by React when a miss is detected — the note falls through the glass. */
  triggerMiss(eventIndex: number) {
    this.noteField.markMissed(eventIndex)
  }

  destroy() {
    this.destroyed = true
    this.resizeObserver?.disconnect()
    this.app.ticker.stop()
    // Pixi 8.17's text system double-returns canvas textures when Text objects
    // are destroyed (TexturePool.returnTexture: push of undefined). Detach all
    // Texts and let GC reclaim them instead of destroying.
    GlassApp.detachTexts(this.app.stage)
    this.app.destroy(true, { children: true })
    this.textures.dispose()
  }

  private static detachTexts(node: Container) {
    for (const child of [...node.children]) {
      if (child instanceof Text) {
        node.removeChild(child)
      } else if (child instanceof Container) {
        GlassApp.detachTexts(child)
      }
    }
  }

  // ── Private ──

  private resize() {
    if (this.destroyed) return
    // resizeTo only auto-fires on window resize — re-read the container size
    // here so ResizeObserver-driven container changes (drawers, presets) work.
    this.app.resize()
    const w = this.app.screen.width
    const h = this.app.screen.height
    if (w === 0 || h === 0) return
    this.layout?.resize(w)
    this.scene.resize(w, h)
    const hitY = this.scene.hitLineY
    this.noteField.resize(w, h, hitY)
    this.effects.resize(hitY)
    if (this.layout && this.receptors) {
      this.receptors.resize(this.layout, hitY, w, h)
    }
    if (this.showHud) this.hud.resize(w, h)
  }

  private update(dt: number) {
    const elapsed = this.paused ? 0 : this.playheadProgress * this.exerciseDuration
    const score = this.paused ? 0 : this.currentScore
    const combo = this.paused ? 0 : this.currentCombo

    this.scene.update(dt)
    if (this.paused) {
      this.noteField.clearVisible()
    } else {
      this.noteField.update(elapsed, performance.now())
    }
    this.receptors?.update(dt)
    this.effects.update(dt)
    if (this.showHud) this.hud.update(score, combo, dt)
  }
}
