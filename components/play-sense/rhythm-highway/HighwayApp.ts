// components/play-sense/rhythm-highway/HighwayApp.ts
import { Application } from 'pixi.js'
import type { ExerciseDefinition, HitGrade } from '@/lib/play-sense/types'
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { PLAYSENSE_MAPPINGS } from '@/lib/play-sense/playsense-mappings'
import { Highway } from './Highway'
import type { FadeStyle, CongaStyle } from './Highway'
import { NoteManager } from './NoteManager'
import type { NoteStyle } from './NoteManager'
import { HitEffects } from './HitEffects'
import { HUD } from './HUD'

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
  private lastMetronomeBeat = 0

  private constructor(app: Application) {
    this.app = app

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
      this.hud.container,
    )
  }

  /**
   * Factory: creates the PixiJS Application and attaches it to the given container.
   */
  static async create(container: HTMLDivElement): Promise<HighwayApp> {
    const app = new Application()
    await app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    })
    container.appendChild(app.canvas as HTMLCanvasElement)

    const instance = new HighwayApp(app)
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

    // Determine lane surfaces
    const laneSurfaces = this.getLaneSurfaces(exercise)

    this.highway.setLanes(laneSurfaces)
    this.noteManager.init(exercise, laneSurfaces)
    this.hitEffects.setLaneCount(laneSurfaces.length)
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
    this.hud.resize(w, h)
  }

  private update(dt: number) {
    const elapsed = this.playheadProgress * this.exerciseDuration

    // Beat fraction for grid scrolling
    const beat = this.metronomeBeat
    const beatFraction = beat % 1 || 0

    this.highway.update(elapsed, this.exerciseBpm)
    this.noteManager.update(elapsed)
    this.hitEffects.updateComboFire(this.currentCombo)
    this.hitEffects.update(dt)
    this.hud.update(
      this.currentScore,
      this.currentCombo,
      this.currentAccuracy,
      this.playheadProgress,
      elapsed,
      this.exerciseDuration,
      dt,
    )
  }

  private getLaneSurfaces(exercise: ExerciseDefinition): string[] {
    // Check for PlaySense mapping first
    const mapping = PLAYSENSE_MAPPINGS[exercise.instrument]
    if (mapping) {
      return Object.values(mapping.piezoMap)
    }

    // For percussion without PlaySense mapping, use unique techniques from events
    const category = getInstrumentCategory(exercise.instrument)
    if (category === 'percussion') {
      const techniques = [...new Set(exercise.events.map(e => e.surface || e.technique))]
      return techniques.length > 0 ? techniques : ['open', 'slap', 'mute']
    }

    // For melodic instruments, use pitch-based lanes
    const pitches = exercise.events
      .filter(e => e.expectedPitch != null)
      .map(e => e.expectedPitch!)
    if (pitches.length === 0) return ['low', 'mid', 'high']

    const minPitch = Math.min(...pitches)
    const maxPitch = Math.max(...pitches)
    const range = maxPitch - minPitch
    if (range <= 4) return ['low', 'mid', 'high']
    if (range <= 8) return ['low', 'mid-low', 'mid', 'mid-high', 'high']
    return ['low', 'mid-low', 'mid', 'mid-high', 'high', 'high+']
  }
}
