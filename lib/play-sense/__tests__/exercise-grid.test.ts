import { describe, expect, it } from 'vitest'
import { scoreToExerciseDefinition, buildExerciseGrid } from '../score-to-exercise'
import { generateExpectedTimestamps, getExerciseDuration, getLoopDuration } from '../exercise-utils'
import type { ScoreDocument, MusicalEvent } from '@/components/playsense-studio/shared/score-model/types'
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

const q = (midi: number, durationQN = 1): MusicalEvent => ({ kind: 'note', midi, durationQN })

// Bars 1–2: 4/4 at ♩=120 (2 s each). Bar 3: meter changes to 6/8 (3 qn), but its
// `tempoChange: 90` is IGNORED — every bar runs at the score's `initialTempo`
// (120), so bar 3 is 3 qn × 0.5 s = 1.5 s.
const changing: ScoreDocument = {
  schemaVersion: 1, title: 'x', sourceFormat: 'native', initialTempo: 120, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'guitar', displayName: 'g', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, voices: [{ number: 1, events: [q(60), q(62), q(64), q(65)] }] },
    { number: 2, voices: [{ number: 1, events: [q(67, 4)] }] },
    { number: 3, timeSignature: [6, 8], tempoChange: 90, voices: [{ number: 1, events: [q(60, 1.5), q(64, 1.5)] }] },
  ] }],
}

// Shaped like the live data: stale per-measure `tempoChange` values (100) left
// over from MusicXML import, including on bar 1, that disagree with the
// admin-set `initialTempo` (151). The engine must ignore them entirely.
const staleTempoChanges: ScoreDocument = {
  schemaVersion: 1, title: 'x', sourceFormat: 'native', initialTempo: 151, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'guitar', displayName: 'g', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, timeSignature: [4, 4], tempoChange: 100, voices: [{ number: 1, events: [q(60)] }] },
    { number: 2, voices: [{ number: 1, events: [q(62)] }] },
    { number: 3, tempoChange: 100, voices: [{ number: 1, events: [q(64)] }] },
  ] }],
}

describe('exercise grid (meter changes honoured, tempo changes ignored)', () => {
  it('builds measure starts from the meter change, at the score initial tempo throughout', () => {
    const g = buildExerciseGrid(changing, changing.tracks[0])
    expect(g.measureStartSec).toEqual([0, 2, 4, 5.5])
    expect(g.measureStartQN).toEqual([0, 4, 8, 11])
    expect(g.beatQN).toEqual([1, 1, 0.5])
    expect(g.secPerQN[2]).toBeCloseTo(0.5, 12)
  })

  it('times notes after the change on the new meter, but ignores the tempo change', () => {
    const ex = scoreToExerciseDefinition(changing)
    const t = generateExpectedTimestamps(ex).map(e => e.timestamp)
    expect(t.slice(0, 5)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(t[5]).toBeCloseTo(4, 9)
    expect(t[6]).toBeCloseTo(4 + 1.5 * 0.5, 9) // dotted-quarter later, still at ♩=120
    expect(getExerciseDuration(ex)).toBeCloseTo(5.5, 9)
    expect(getLoopDuration(ex)).toBeCloseTo(5.5, 9)
  })

  it('gives a uniform score the same timestamps as the old formula', () => {
    const ex = scoreToExerciseDefinition(GUITAR_LICK_FIXTURE)
    const withGrid = generateExpectedTimestamps(ex).map(e => e.timestamp)
    const legacy = generateExpectedTimestamps({ ...ex, grid: undefined }).map(e => e.timestamp)
    expect(withGrid).toHaveLength(legacy.length)
    withGrid.forEach((v, i) => expect(v).toBeCloseTo(legacy[i], 9))
    expect(getLoopDuration(ex)).toBeCloseTo(getLoopDuration({ ...ex, grid: undefined }), 9)
  })

  it('ignores stale imported tempoChange values, including on bar 1 (live-data regression)', () => {
    const ex = scoreToExerciseDefinition(staleTempoChanges)
    expect(ex.bpm).toBe(151)
    const withGrid = generateExpectedTimestamps(ex).map(e => e.timestamp)
    const uniform151 = generateExpectedTimestamps({ ...ex, grid: undefined }).map(e => e.timestamp)
    expect(withGrid).toHaveLength(uniform151.length)
    withGrid.forEach((v, i) => expect(v).toBeCloseTo(uniform151[i], 9))
  })

  it("uses bar 1's own time signature for bpm/timeSignature when it differs from the score default", () => {
    const score: ScoreDocument = {
      schemaVersion: 1, title: 'x', sourceFormat: 'native', initialTempo: 120, initialTimeSignature: [4, 4], initialKeyFifths: 0,
      tracks: [{ index: 0, instrument: 'guitar', displayName: 'g', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
        { number: 1, timeSignature: [6, 8], voices: [{ number: 1, events: [q(60, 1.5), q(62, 1.5)] }] },
      ] }],
    }
    const ex = scoreToExerciseDefinition(score)
    expect(ex.timeSignature).toEqual([6, 8])
    expect(ex.bpm).toBe(120 * 2)
  })
})
