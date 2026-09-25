// Bar-by-bar results for the Part done screen, grouped from the per-note
// judgements the scorer already produces (EventResult.eventIndex runs across
// loops: pass × events.length + event). Pure.

import type { EventResult, ExerciseDefinition } from './types'

export type BarStatus = 'clean' | 'close' | 'miss' | 'rest'

export interface BarResult {
  bar: number
  status: BarStatus
  notes: number
  missed: number
  early: number
  late: number
}

export function buildBarResults(exercise: Pick<ExerciseDefinition, 'measures' | 'events'>, results: EventResult[]): BarResult[] {
  const count = Math.max(0, exercise.measures, ...exercise.events.map(e => e.measure))
  const bars: (BarResult & { ok: number })[] = Array.from({ length: count }, (_, i) => ({ bar: i + 1, status: 'rest', notes: 0, missed: 0, early: 0, late: 0, ok: 0 }))
  const n = exercise.events.length
  if (n === 0) return bars.map(({ bar, notes, missed, early, late }) => ({ bar, status: 'rest', notes, missed, early, late }))
  const byIndex = new Map(results.map(r => [r.eventIndex, r]))
  const passes = Math.max(1, ...results.map(r => Math.floor(r.eventIndex / n) + 1))
  for (let index = 0; index < passes * n; index++) {
    const event = exercise.events[index % n]
    const bar = bars[event.measure - 1]
    if (!bar) continue
    const result = byIndex.get(index)
    bar.notes++
    if (!result || result.grade === 'miss') { bar.missed++; continue }
    if (result.grade === 'ok') bar.ok++
    if (result.grade !== 'perfect' && result.timing === 'early') bar.early++
    if (result.grade !== 'perfect' && result.timing === 'late') bar.late++
  }
  return bars.map(({ ok, ...bar }) => ({
    ...bar,
    status: bar.notes === 0 ? 'rest' : bar.missed > 0 ? 'miss' : ok > 0 || bar.early > 0 || bar.late > 0 ? 'close' : 'clean',
  }))
}

export function summarizeTake(bars: BarResult[]): { clean: number; played: number; missedBars: number[] } {
  const played = bars.filter(b => b.status !== 'rest')
  return { clean: played.filter(b => b.status === 'clean').length, played: played.length, missedBars: played.filter(b => b.status === 'miss').map(b => b.bar) }
}

export function bestPreviousAccuracy(attempts: { accuracy: number | null }[]): number | null {
  let best: number | null = null
  for (const a of attempts) if (typeof a.accuracy === 'number' && Number.isFinite(a.accuracy)) best = best == null ? a.accuracy : Math.max(best, a.accuracy)
  return best
}
