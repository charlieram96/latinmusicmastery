// components/play-sense/glass-highway/LaneLayout.ts
//
// Pure-geometry lane abstraction. Two implementations:
//  - PadLaneLayout: evenly-spaced lanes for percussion / capped melodic lanes
//  - PianoLaneLayout: 88 lanes mapped onto real keyboard geometry
// Nothing here touches Pixi — renderers ask the layout where things go.

import type { ExerciseDefinition, ExerciseEvent } from '@/lib/play-sense/types'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { PLAYSENSE_MAPPINGS } from '@/lib/play-sense/playsense-mappings'
import {
  LANE_COLORS,
  DEFAULT_LANE_COLOR,
  MELODIC_LANE_COLORS,
  PIANO_WHITE_NOTE_COLOR,
  PIANO_BLACK_NOTE_COLOR,
  VIOLIN_OPEN_STRINGS,
  GUITAR_OPEN_STRINGS,
} from './constants'

export interface LaneLayout {
  readonly kind: 'pads' | 'piano'
  readonly laneCount: number
  /** Recompute X positions for a new stage width. */
  resize(width: number): void
  /** Map an exercise event to its lane index. */
  laneForEvent(event: ExerciseEvent | undefined): number
  laneCenterX(lane: number): number
  noteWidth(lane: number): number
  laneColor(lane: number): number
  laneLabel(lane: number): string
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[midi % 12]}${octave}`
}

const NOTE_NAMES_MIDI: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}

export function noteNameToMidi(name: string): number | null {
  const match = name.match(/^([A-Ga-g][b#]?)(-?\d+)$/)
  if (!match) return null
  const semi = NOTE_NAMES_MIDI[match[1].charAt(0).toUpperCase() + match[1].slice(1)]
  if (semi == null) return null
  return (parseInt(match[2], 10) + 1) * 12 + semi
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// ── Pads ──────────────────────────────────────────────────────────────────

/** Fraction of stage width the pad lanes span (centered). */
const PAD_SPAN = 0.82
/** Note pill width as a fraction of the lane width. */
const PAD_NOTE_WIDTH = 0.58
const MAX_MELODIC_LANES = 8

export class PadLaneLayout implements LaneLayout {
  readonly kind = 'pads' as const
  readonly laneCount: number

  private surfaces: string[]
  private labels: string[]
  private colors: number[]
  private width = 0

  constructor(surfaces: string[], labels: string[], colors: number[]) {
    this.surfaces = surfaces
    this.labels = labels
    this.colors = colors
    this.laneCount = surfaces.length
  }

  resize(width: number) {
    this.width = width
  }

  laneForEvent(event: ExerciseEvent | undefined): number {
    if (!event) return 0
    if (event.surface) {
      const idx = this.surfaces.indexOf(event.surface)
      if (idx >= 0) return idx
    }
    if (event.expectedNoteName) {
      const idx = this.surfaces.indexOf(event.expectedNoteName)
      if (idx >= 0) return idx
      if (event.expectedPitch != null) return this.closestPitchedLane(event.expectedPitch)
    }
    const techIdx = this.surfaces.indexOf(event.technique)
    return techIdx >= 0 ? techIdx : 0
  }

  laneCenterX(lane: number): number {
    const span = this.width * PAD_SPAN
    const left = (this.width - span) / 2
    const laneWidth = span / this.laneCount
    return left + laneWidth * (lane + 0.5)
  }

  noteWidth(lane: number): number {
    void lane
    const laneWidth = (this.width * PAD_SPAN) / this.laneCount
    return Math.min(laneWidth * PAD_NOTE_WIDTH, 96)
  }

  laneColor(lane: number): number {
    return this.colors[lane] ?? DEFAULT_LANE_COLOR
  }

  laneLabel(lane: number): string {
    return this.labels[lane] ?? ''
  }

  private closestPitchedLane(midiPitch: number): number {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < this.surfaces.length; i++) {
      const lanePitch = noteNameToMidi(this.surfaces[i])
      if (lanePitch == null) continue
      const d = Math.abs(lanePitch - midiPitch)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    return bestIdx
  }
}

// ── Piano ─────────────────────────────────────────────────────────────────

export const PIANO_LOW_MIDI = 21 // A0
export const PIANO_HIGH_MIDI = 108 // C8
export const PIANO_WHITE_COUNT = 52
const BLACK_PCS = new Set([1, 3, 6, 8, 10])
/** Black key width as a fraction of a white key. */
export const BLACK_KEY_RATIO = 0.62
/** Classic visual offsets so black keys cluster in 2s and 3s (fraction of white width). */
const BLACK_OFFSET: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.12, 8: 0, 10: 0.12 }

export function isBlackKey(midi: number): boolean {
  return BLACK_PCS.has(((midi % 12) + 12) % 12)
}

/** Count of white keys strictly below this midi note, starting from A0. */
function whiteIndexOf(midi: number): number {
  let count = 0
  for (let m = PIANO_LOW_MIDI; m < midi; m++) {
    if (!isBlackKey(m)) count++
  }
  return count
}

// Precomputed white index per midi (88 entries) — cheap, done once at module load.
const WHITE_INDEX: number[] = []
for (let m = PIANO_LOW_MIDI; m <= PIANO_HIGH_MIDI; m++) WHITE_INDEX[m - PIANO_LOW_MIDI] = whiteIndexOf(m)

export class PianoLaneLayout implements LaneLayout {
  readonly kind = 'piano' as const
  readonly laneCount = PIANO_HIGH_MIDI - PIANO_LOW_MIDI + 1 // 88

  private width = 0
  private whiteW = 0

  resize(width: number) {
    this.width = width
    this.whiteW = width / PIANO_WHITE_COUNT
  }

  laneForEvent(event: ExerciseEvent | undefined): number {
    if (!event) return 0
    let midi = event.expectedPitch
    if (midi == null && event.expectedNoteName) {
      midi = noteNameToMidi(event.expectedNoteName) ?? undefined
    }
    if (midi == null) return 0
    return Math.min(Math.max(midi, PIANO_LOW_MIDI), PIANO_HIGH_MIDI) - PIANO_LOW_MIDI
  }

  midiForLane(lane: number): number {
    return lane + PIANO_LOW_MIDI
  }

  laneCenterX(lane: number): number {
    const midi = lane + PIANO_LOW_MIDI
    if (isBlackKey(midi)) {
      // Black key sits on the boundary after its preceding white key, nudged
      // by the classic per-pitch-class offset so groups read as real 2s/3s.
      const boundary = WHITE_INDEX[lane] // count of whites below == boundary index
      const offset = BLACK_OFFSET[((midi % 12) + 12) % 12] ?? 0
      return (boundary + offset * 0.5) * this.whiteW
    }
    return (WHITE_INDEX[lane] + 0.5) * this.whiteW
  }

  noteWidth(lane: number): number {
    const midi = lane + PIANO_LOW_MIDI
    return isBlackKey(midi)
      ? Math.max(this.whiteW * BLACK_KEY_RATIO * 0.9, 2)
      : Math.max(this.whiteW * 0.86, 3)
  }

  laneColor(lane: number): number {
    return isBlackKey(lane + PIANO_LOW_MIDI) ? PIANO_BLACK_NOTE_COLOR : PIANO_WHITE_NOTE_COLOR
  }

  laneLabel(lane: number): string {
    // Keys are their own labels — only mark the Cs for orientation.
    const midi = lane + PIANO_LOW_MIDI
    const name = midiToNoteName(midi)
    return name.startsWith('C') && !name.startsWith('C#') ? name : ''
  }

  whiteKeyWidth(): number {
    return this.whiteW
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

/** Build the right layout for an exercise (ported from HighwayApp.getLaneConfig). */
export function createLaneLayout(exercise: ExerciseDefinition): LaneLayout {
  if (exercise.instrument === 'piano') {
    return new PianoLaneLayout()
  }

  // Percussion with PlaySense piezo mapping
  const mapping = PLAYSENSE_MAPPINGS[exercise.instrument]
  if (mapping) {
    const surfaces = Object.values(mapping.piezoMap)
    return new PadLaneLayout(
      surfaces,
      surfaces.map((s) => s.toUpperCase()),
      surfaces.map((s) => LANE_COLORS[s] ?? DEFAULT_LANE_COLOR),
    )
  }

  const category = getInstrumentCategory(exercise.instrument)

  // Percussion without PlaySense mapping — unique surfaces/techniques
  if (category === 'percussion') {
    const techniques = [...new Set(exercise.events.map((e) => e.surface || e.technique))]
    const surfaces = techniques.length > 0 ? techniques : ['open', 'slap', 'mute']
    return new PadLaneLayout(
      surfaces,
      surfaces.map((s) => s.toUpperCase()),
      surfaces.map((s) => LANE_COLORS[s] ?? DEFAULT_LANE_COLOR),
    )
  }

  // Pitched / melodic (non-piano) — one lane per unique note, capped at 8
  const uniqueByName = new Map<string, number>()
  for (const e of exercise.events) {
    const name = e.expectedNoteName ?? (e.expectedPitch != null ? midiToNoteName(e.expectedPitch) : null)
    if (!name) continue
    if (!uniqueByName.has(name)) uniqueByName.set(name, e.expectedPitch ?? 0)
  }
  let surfaces: string[]
  if (uniqueByName.size === 0) {
    surfaces = ['low', 'mid', 'high']
  } else {
    surfaces = [...uniqueByName.entries()].sort(([, a], [, b]) => a - b).map(([name]) => name)
    if (surfaces.length > MAX_MELODIC_LANES) {
      const step = Math.ceil(surfaces.length / MAX_MELODIC_LANES)
      surfaces = surfaces.filter((_, i) => i % step === 0).slice(0, MAX_MELODIC_LANES)
    }
  }

  let labels = surfaces.map((s) => capitalize(s))
  if (exercise.instrument === 'violin') {
    labels = surfaces.map((_, i) => VIOLIN_OPEN_STRINGS[i % VIOLIN_OPEN_STRINGS.length])
  } else if (exercise.instrument === 'guitar' || exercise.instrument === 'bass') {
    const palette = exercise.instrument === 'guitar' ? GUITAR_OPEN_STRINGS : ['E', 'A', 'D', 'G']
    labels = surfaces.map((_, i) => palette[i % palette.length])
  }

  const colors = surfaces.map((_, i) => MELODIC_LANE_COLORS[i % MELODIC_LANE_COLORS.length])
  return new PadLaneLayout(surfaces, labels, colors)
}
