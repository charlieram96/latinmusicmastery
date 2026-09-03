/**
 * Turns raw engine readings into a stable display frame:
 * median filter → note hysteresis → cents smoothing → decay hold → lock.
 * Pure and time-injected so it is unit-testable without audio.
 */
import type { PitchReading } from './pitch-engine'
import { hzToMidiFloat } from './note-math'

export interface TunerFrame {
  /** Median-filtered detected frequency. */
  hz: number
  /** The note the cents are measured against. */
  midi: number
  /** Smoothed signed cents from `midi`. Beyond ±50 only in manual mode. */
  cents: number
  clarity: number
  /** True while the last reading is being shown after the signal stopped. */
  held: boolean
  /** True once the pitch has stayed inside the window for LOCK_MS. */
  locked: boolean
  /** True on the single frame where `locked` first became true for this note. */
  justLocked: boolean
}

export interface TrackOptions {
  holdMs: number
  tolCents: number
  /** Manual target: pin the reference note instead of the nearest semitone. */
  targetMidi: number | null
}

const MEDIAN = 5
const HYSTERESIS_FRAMES = 3
const JUMP_SEMITONES = 1.5
const EMA = 0.4
const LOCK_MS = 450

export class PitchTracker {
  private hist: number[] = []
  private stable: number | null = null
  private cand: number | null = null
  private candN = 0
  private ema: number | null = null
  private last: TunerFrame | null = null
  private lastT = 0
  private lockSince = 0
  private locked = false
  private lockedFor: number | null = null

  reset(): void {
    this.hist = []
    this.stable = null
    this.cand = null
    this.candN = 0
    this.ema = null
    this.last = null
    this.lastT = 0
    this.lockSince = 0
    this.locked = false
    this.lockedFor = null
  }

  push(reading: PitchReading | null, nowMs: number, a4: number, o: TrackOptions): TunerFrame | null {
    if (!reading) {
      if (this.last && nowMs - this.lastT < o.holdMs) {
        return { ...this.last, held: true, locked: false, justLocked: false }
      }
      this.reset()
      return null
    }

    this.hist.push(reading.hz)
    if (this.hist.length > MEDIAN) this.hist.shift()
    const med = [...this.hist].sort((x, y) => x - y)[this.hist.length >> 1]
    const mf = hzToMidiFloat(med, a4)
    const midi = Math.round(mf)

    if (o.targetMidi != null) {
      if (this.stable !== o.targetMidi) this.startNote(o.targetMidi)
    } else if (this.stable == null) {
      this.startNote(midi)
    } else if (midi !== this.stable) {
      if (this.cand === midi) this.candN++
      else {
        this.cand = midi
        this.candN = 1
      }
      if (this.candN >= HYSTERESIS_FRAMES || Math.abs(mf - this.stable) > JUMP_SEMITONES) this.startNote(midi)
    } else {
      this.cand = null
      this.candN = 0
    }

    const raw = (mf - (this.stable as number)) * 100
    this.ema = this.ema == null ? raw : this.ema + (raw - this.ema) * EMA
    const cents = this.ema

    let justLocked = false
    if (Math.abs(cents) <= o.tolCents) {
      if (!this.lockSince) this.lockSince = nowMs
      if (!this.locked && nowMs - this.lockSince >= LOCK_MS) {
        this.locked = true
        justLocked = this.lockedFor !== this.stable
        this.lockedFor = this.stable
      }
    } else {
      this.lockSince = 0
      this.locked = false
    }

    this.last = {
      hz: med,
      midi: this.stable as number,
      cents,
      clarity: reading.clarity,
      held: false,
      locked: this.locked,
      justLocked,
    }
    this.lastT = nowMs
    return this.last
  }

  private startNote(midi: number): void {
    this.stable = midi
    this.ema = null
    this.cand = null
    this.candN = 0
    this.lockSince = 0
    this.locked = false
    this.lockedFor = null
  }
}
