import type { ExpectedEvent } from './scoring'
import type { EventResult } from './types'

/**
 * The clock and auto-grader behind PlaySense demo stages (`/playsense-preview`
 * and the marketing `/playsense` page). Pure: the caller owns the rAF loop,
 * audio and React state, and feeds frame deltas in.
 */

/** Seconds of lead-in before the first note reaches the line. */
export const DEMO_LEAD_IN = -3.5
/** Seconds held after the last note before a take ends (or loops). */
export const DEMO_TAIL = 0.35
/** Live mode waits this long past a note before calling it a miss. */
const MISS_AFTER = 0.15
const MAX_FRAME_DT = 0.1

export interface DemoSession {
  elapsed: number
  matched: Set<number>
  /** Replaced (never mutated) whenever it changes, so it can go straight into React state. */
  results: EventResult[]
}

export interface DemoStepOptions {
  expected: ExpectedEvent[]
  duration: number
  /** Demo mode grades every note perfect and loops; live mode marks misses and ends. */
  demo: boolean
}

export interface DemoStep {
  /** Judgments added this frame (before any loop reset). */
  added: EventResult[]
  /** The demo reached its end and restarted from the lead-in. */
  looped: boolean
  /** A live take reached its end. */
  ended: boolean
}

/** Seconds since the previous rAF timestamp; 0 on the first frame, capped so a background tab doesn't jump. */
export function frameDelta(now: number, last: number): number {
  return last ? Math.min((now - last) / 1000, MAX_FRAME_DT) : 0
}

export function createDemoSession(): DemoSession {
  return { elapsed: DEMO_LEAD_IN, matched: new Set(), results: [] }
}

export function resetDemoSession(s: DemoSession): void {
  s.elapsed = DEMO_LEAD_IN
  s.matched = new Set()
  s.results = []
}

/** Advance the clock by `dt` seconds, grade every note that came due, and handle the end of the take. */
export function stepDemoSession(s: DemoSession, dt: number, { expected, duration, demo }: DemoStepOptions): DemoStep {
  s.elapsed += dt
  const time = s.elapsed
  const added: EventResult[] = []
  for (const event of expected) {
    if (s.matched.has(event.eventIndex)) continue
    if (event.timestamp > time) break
    if (!demo && time - event.timestamp < MISS_AFTER) continue
    s.matched.add(event.eventIndex)
    added.push(demo
      ? { eventIndex: event.eventIndex, grade: 'perfect', offsetMs: 0, timing: 'on_time', onsetEnergy: 1 }
      : { eventIndex: event.eventIndex, grade: 'miss', offsetMs: null, timing: null, onsetEnergy: null })
  }
  if (added.length) s.results = [...s.results, ...added]
  if (time < duration + DEMO_TAIL) return { added, looped: false, ended: false }
  if (!demo) return { added, looped: false, ended: true }
  resetDemoSession(s)
  return { added, looped: true, ended: false }
}

/** Consecutive non-miss judgments at the end of the list. */
export function comboOf(results: EventResult[]): number {
  let count = 0
  for (let i = results.length - 1; i >= 0 && results[i].grade !== 'miss'; i--) count++
  return count
}

/** 1-based measure of the four-bar demo phrase (4/4). */
export function demoMeasure(elapsed: number, bpm: number): number {
  return Math.floor(Math.max(0, elapsed) * bpm / 60 / 4) % 4 + 1
}

/** 0-based beat within the bar (4/4). */
export function demoBeat(elapsed: number, bpm: number): number {
  return Math.floor(Math.max(0, elapsed) * bpm / 60) % 4
}
