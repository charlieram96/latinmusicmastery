// Bar-by-bar results for the Part done screen, grouped from the per-note
// judgements the scorer already produces (EventResult.eventIndex runs across
// loops: pass × events.length + event). Pure.
//
// A take stopped early with Finish take: the engine fills every note it never
// reached as a miss. `reached` (0–1 over all passes, where the take stopped)
// leaves those notes out, and a bar with none reached is 'unplayed'.

import type { EventResult, ExerciseDefinition } from './types'

export type BarStatus = 'clean' | 'close' | 'miss' | 'rest' | 'unplayed'

export interface BarResult {
  bar: number
  status: BarStatus
  notes: number
  missed: number
  early: number
  late: number
}

type BarExercise = Pick<ExerciseDefinition, 'measures' | 'events'> & Partial<Pick<ExerciseDefinition, 'timeSignature' | 'loopCount'>>

/** Where an event (by engine index) sits in the whole take, 0–1. */
function eventPosition(exercise: BarExercise, index: number): number {
  const n = exercise.events.length
  const measures = Math.max(1, exercise.measures, ...exercise.events.map(e => e.measure))
  const beats = Math.max(1, exercise.timeSignature?.[0] ?? 4)
  const loops = Math.max(1, exercise.loopCount ?? 1)
  const event = exercise.events[index % n]
  const within = (event.measure - 1 + (Math.max(1, event.beat ?? 1) - 1) / beats) / measures
  return (Math.floor(index / n) + within) / loops
}

const isReached = (exercise: BarExercise, index: number, reached: number | null | undefined) =>
  reached == null || eventPosition(exercise, index) < reached

/** The judgements a take stopped at `reached` actually reached (all of them when null). */
export function reachedResults(exercise: BarExercise, results: EventResult[], reached: number | null | undefined): EventResult[] {
  if (reached == null || exercise.events.length === 0) return results
  return results.filter(r => isReached(exercise, r.eventIndex, reached))
}

export function buildBarResults(exercise: BarExercise, results: EventResult[], { reached }: { reached?: number | null } = {}): BarResult[] {
  const count = Math.max(0, exercise.measures, ...exercise.events.map(e => e.measure))
  const bars: (BarResult & { ok: number; total: number })[] = Array.from({ length: count }, (_, i) =>
    ({ bar: i + 1, status: 'rest', notes: 0, missed: 0, early: 0, late: 0, ok: 0, total: 0 }))
  const n = exercise.events.length
  if (n === 0) return bars.map(({ bar, notes, missed, early, late }) => ({ bar, status: 'rest', notes, missed, early, late }))
  const byIndex = new Map(results.map(r => [r.eventIndex, r]))
  const passes = Math.max(1, reached != null ? exercise.loopCount ?? 1 : 1, ...results.map(r => Math.floor(r.eventIndex / n) + 1))
  for (let index = 0; index < passes * n; index++) {
    const event = exercise.events[index % n]
    const bar = bars[event.measure - 1]
    if (!bar) continue
    bar.total++
    if (!isReached(exercise, index, reached)) continue
    const result = byIndex.get(index)
    bar.notes++
    if (!result || result.grade === 'miss') { bar.missed++; continue }
    if (result.grade === 'ok') bar.ok++
    if (result.grade !== 'perfect' && result.timing === 'early') bar.early++
    if (result.grade !== 'perfect' && result.timing === 'late') bar.late++
  }
  return bars.map(({ ok, total, ...bar }) => ({
    ...bar,
    status: total === 0 ? 'rest' : bar.notes === 0 ? 'unplayed'
      : bar.missed > 0 ? 'miss' : ok > 0 || bar.early > 0 || bar.late > 0 ? 'close' : 'clean',
  }))
}

export function summarizeTake(bars: BarResult[]): { clean: number; played: number; missedBars: number[]; unplayed: number } {
  const played = bars.filter(b => b.status !== 'rest' && b.status !== 'unplayed')
  return {
    clean: played.filter(b => b.status === 'clean').length,
    played: played.length,
    missedBars: played.filter(b => b.status === 'miss').map(b => b.bar),
    unplayed: bars.filter(b => b.status === 'unplayed').length,
  }
}

/**
 * Part done's baseline: the best of the saved takes (undefined while it loads) and the takes finished
 * earlier in this visit. Undefined until the saved best is known, so a late answer still lands.
 */
export function takeBaseline(saved: number | null | undefined, visit: number | null): number | null | undefined {
  if (saved === undefined) return undefined
  return saved == null ? visit : visit == null ? saved : Math.max(saved, visit)
}
