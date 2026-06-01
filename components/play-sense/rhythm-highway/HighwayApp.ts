// components/play-sense/rhythm-highway/HighwayApp.ts
import { Application } from 'pixi.js'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { PLAYSENSE_MAPPINGS } from '@/lib/play-sense/playsense-mappings'
import { Highway } from './Highway'
import type { FadeStyle, CongaStyle, ReceptorStyle } from './Highway'
import { NoteManager } from './NoteManager'
import type { NoteStyle } from './NoteManager'
import { HitEffects } from './HitEffects'
import { HUD } from './HUD'
import { VIOLIN_OPEN_STRINGS, GUITAR_OPEN_STRINGS } from './constants'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const name = NOTE_NAMES[midi % 12]
  return `${name}${octave}`
}

/**
 * Top-level PixiJS application for the rhythm highway.
 * Create with HighwayApp.create(), then call init() with an exercise.
 * The render loop reads from refs provided by the React wrapper.
 */
export class HighwayApp {
  private app: Application
  private highway: Highway
  private noteManager: NoteManager
  private hitEffects: HitEffects
  private hud: HUD

  private exerciseDuration = 0
  private exerciseBpm = 120
  private destroyed = false
  private resizeObserver: ResizeObserver | null = null

  // Refs set by React wrapper — read each frame
  playheadProgress = 0
  currentScore = 0
  currentCombo = 0
  currentAccuracy = 100
  metronomeBeat = 0
  /** When true: highway / receptors / grid still render, but notes don't scroll, score/combo are frozen at 0. */
  paused = false
  private lastMetronomeBeat = 0

  /** When false, the in-canvas stats HUD is not rendered (DOM chrome owns stats). */
  private showHud = true

  private constructor(app: Application, showHud: boolean) {
    this.app = app
    this.showHud = showHud

    this.highway = new Highway()
    this.noteManager = new NoteManager(this.highway)
    this.hitEffects = new HitEffects(this.highway)
    this.hud = new HUD()

    // Layer order: highway (bg) → notes → top fade overlay → effects → hud (top)
    app.stage.addChild(
      this.highway.container,
      this.noteManager.container,
      this.highway.overlayContainer,
      this.hitEffects.container,
    )
    if (this.showHud) app.stage.addChild(this.hud.container)
  }

  /**
   * Factory: creates the PixiJS Application and attaches it to the given container.
   * Pass `{ showHud: false }` to suppress the in-canvas HUD when DOM chrome renders stats.
   */
  static async create(container: HTMLDivElement, options?: { showHud?: boolean }): Promise<HighwayApp> {
    const app = new Application()
    await app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    container.appendChild(app.canvas as HTMLCanvasElement)

    const instance = new HighwayApp(app, options?.showHud ?? true)
    instance.resize()

    // Watch for resizes
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container)
    instance.resizeObserver = observer

    // Start render loop
    app.ticker.add((ticker) => {
      if (!instance.destroyed) {
        instance.update(ticker.deltaMS / 1000)
      }
    })

    return instance
  }

  /** Initialize with an exercise. Call once before gameplay starts. */
  init(exercise: ExerciseDefinition) {
    this.exerciseDuration = getExerciseDuration(exercise)
    this.exerciseBpm = exercise.bpm

    // Determine lane surfaces + labels + receptor style based on instrument
    const { surfaces, labels, style } = this.getLaneConfig(exercise)

    this.highway.setReceptorStyle(style)
    this.highway.setLanes(surfaces, labels)
    this.noteManager.init(exercise, surfaces)
    this.hitEffects.setLaneCount(surfaces.length)
    this.hud.setExerciseInfo(exercise.title, exercise.bpm)
  }

  /** Get/set the note visual style — changes apply next frame */
  get noteStyle(): NoteStyle { return this.noteManager.noteStyle }
  set noteStyle(style: NoteStyle) { this.noteManager.noteStyle = style }

  get fadeStyle(): FadeStyle { return this.highway.fadeStyle }
  set fadeStyle(style: FadeStyle) { this.highway.fadeStyle = style }

  get congaStyle(): CongaStyle { return this.highway.congaStyle }
  set congaStyle(style: CongaStyle) { this.highway.congaStyle = style }

  /** Find the note closest to the hit zone */
  getClosestEventIndex(): number | null {
    const elapsed = this.playheadProgress * this.exerciseDuration
    return this.noteManager.getClosestEventIndex(elapsed)
  }

  /** Called by React when a note is hit — shatters the note and shows grade */
  triggerHitEffect(eventIndex: number, grade: HitGrade) {
    const laneIndex = this.noteManager.getLaneForEvent(eventIndex)
    const noteColor = this.noteManager.getColorForEvent(eventIndex)
    this.noteManager.markHit(eventIndex)
    this.hitEffects.triggerHit(laneIndex, grade, noteColor)
  }

  /** Called by React when a miss is detected — note continues with red glow */
  triggerMiss(eventIndex: number) {
    this.noteManager.markMissed(eventIndex)
    const laneIndex = this.noteManager.getLaneForEvent(eventIndex)
    this.hitEffects.triggerHit(laneIndex, 'miss', 0x666666)
  }

  /** Destroy the PixiJS application and free resources */
  destroy() {
    this.destroyed = true
    this.resizeObserver?.disconnect()
    this.app.destroy(true, { children: true, texture: true })
  }

  // ── Private ──

  private resize() {
    const w = this.app.screen.width
    const h = this.app.screen.height
    this.highway.resize(w, h)
    this.hitEffects.resize(w, h)
    if (this.showHud) this.hud.resize(w, h)
  }

  private update(dt: number) {
    // When paused, freeze elapsed at 0 (no scrolling) and force HUD to neutral.
    const elapsed = this.paused ? 0 : this.playheadProgress * this.exerciseDuration
    const score = this.paused ? 0 : this.currentScore
    const combo = this.paused ? 0 : this.currentCombo
    const accuracy = this.paused ? 100 : this.currentAccuracy
    const progress = this.paused ? 0 : this.playheadProgress

    // Receptor pulse from metronome beat fraction (only while we have a metronome running)
    if (!this.paused) {
      const beat = this.metronomeBeat
      const fraction = ((beat % 1) + 1) % 1
      // 1 at beat onset → fades to 0 over the beat
      this.highway.setReceptorPulse(Math.max(0, 1 - fraction))
    } else {
      this.highway.setReceptorPulse(0)
    }

    this.highway.update(elapsed, this.exerciseBpm)
    if (this.paused) {
      // Notes are not visible while paused
      this.noteManager.clearVisible()
    } else {
      this.noteManager.update(elapsed)
    }
    this.hitEffects.updateComboFire(combo)
    this.hitEffects.update(dt)
    if (this.showHud) {
      this.hud.update(
        score,
        combo,
        accuracy,
        progress,
        elapsed,
        this.exerciseDuration,
        dt,
      )
    }
  }

  private getLaneConfig(exercise: ExerciseDefinition): { surfaces: string[]; labels: string[]; style: ReceptorStyle } {
    // Percussion with PlaySense piezo mapping
    const mapping = PLAYSENSE_MAPPINGS[exercise.instrument]
    if (mapping) {
      const surfaces = Object.values(mapping.piezoMap)
      return { surfaces, labels: surfaces.map(s => capitalize(s)), style: 'drum' }
    }

    const category = getInstrumentCategory(exercise.instrument)

    // Percussion without PlaySense mapping — use unique techniques from events
    if (category === 'percussion') {
      const techniques = [...new Set(exercise.events.map(e => e.surface || e.technique))]
      const surfaces = techniques.length > 0 ? techniques : ['open', 'slap', 'mute']
      return { surfaces, labels: surfaces.map(s => capitalize(s)), style: 'drum' }
    }

    // Pitched / melodic instruments — one lane per unique note in the exercise.
    const uniqueByName = new Map<string, number>()
    for (const e of exercise.events) {
      const name = e.expectedNoteName ?? (e.expectedPitch != null ? midiToNoteName(e.expectedPitch) : null)
      if (!name) continue
      const pitch = e.expectedPitch ?? 0
      if (!uniqueByName.has(name)) uniqueByName.set(name, pitch)
    }
    let surfaces: string[]
    if (uniqueByName.size === 0) {
      surfaces = ['low', 'mid', 'high']
    } else {
      surfaces = [...uniqueByName.entries()]
        .sort(([, a], [, b]) => a - b)
        .map(([name]) => name)
      // Cap lane count so lanes stay readable
      if (surfaces.length > 8) {
        const step = Math.ceil(surfaces.length / 8)
        surfaces = surfaces.filter((_, i) => i % step === 0).slice(0, 8)
      }
    }

    let labels = surfaces
    let style: ReceptorStyle = 'piano'
    if (exercise.instrument === 'violin') {
      style = 'string'
      labels = surfaces.map((_, i) => VIOLIN_OPEN_STRINGS[i % VIOLIN_OPEN_STRINGS.length])
    } else if (exercise.instrument === 'guitar' || exercise.instrument === 'bass') {
      style = 'string'
      const palette = exercise.instrument === 'guitar' ? GUITAR_OPEN_STRINGS : ['E', 'A', 'D', 'G']
      labels = surfaces.map((_, i) => palette[i % palette.length])
    } else {
      // piano / other pitched: use the actual note names as labels
      labels = surfaces
    }

    return { surfaces, labels, style }
  }
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
