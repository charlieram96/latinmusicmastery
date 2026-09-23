import { describe, expect, it } from 'vitest'
import { scoreToExerciseDefinition, buildExerciseGrid } from '../score-to-exercise'
import { generateExpectedTimestamps, getExerciseDuration, getLoopDuration } from '../exercise-utils'
import type { ScoreDocument, MusicalEvent } from '@/components/playsense-studio/shared/score-model/types'
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures'

const q = (midi: number, durationQN = 1): MusicalEvent => ({ kind: 'note', midi, durationQN })

// Bars 1–2: 4/4 at ♩=120 (2 s each). Bar 3: 6/8 at ♩=90 (3 qn × 0.667 s = 2 s).
const changing: ScoreDocument = {
  schemaVersion: 1, title: 'x', sourceFormat: 'native', initialTempo: 120, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'guitar', displayName: 'g', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures: [
    { number: 1, voices: [{ number: 1, events: [q(60), q(62), q(64), q(65)] }] },
    { number: 2, voices: [{ number: 1, events: [q(67, 4)] }] },
    { number: 3, timeSignature: [6, 8], tempoChange: 90, voices: [{ number: 1, events: [q(60, 1.5), q(64, 1.5)] }] },
  ] }],
}

describe('exercise grid (tempo and meter changes)', () => {
  it('builds measure starts in seconds and quarter notes', () => {
    const g = buildExerciseGrid(changing, changing.tracks[0])
    expect(g.measureStartSec).toEqual([0, 2, 4, 6])
    expect(g.measureStartQN).toEqual([0, 4, 8, 11])
    expect(g.beatQN).toEqual([1, 1, 0.5])
    expect(g.secPerQN[2]).toBeCloseTo(60 / 90, 12)
  })

  it('times notes after the change on the new tempo and meter', () => {
    const ex = scoreToExerciseDefinition(changing)
    const t = generateExpectedTimestamps(ex).map(e => e.timestamp)
    expect(t.slice(0, 5)).toEqual([0, 0.5, 1, 1.5, 2])
    expect(t[5]).toBeCloseTo(4, 9)
    expect(t[6]).toBeCloseTo(4 + 1.5 * (60 / 90), 9) // dotted-quarter later, at ♩=90
    expect(getExerciseDuration(ex)).toBeCloseTo(6, 9)
    expect(getLoopDuration(ex)).toBeCloseTo(6, 9)
  })

  it('gives a uniform score the same timestamps as the old formula', () => {
    const ex = scoreToExerciseDefinition(GUITAR_LICK_FIXTURE)
    const withGrid = generateExpectedTimestamps(ex).map(e => e.timestamp)
    const legacy = generateExpectedTimestamps({ ...ex, grid: undefined }).map(e => e.timestamp)
    expect(withGrid).toHaveLength(legacy.length)
    withGrid.forEach((v, i) => expect(v).toBeCloseTo(legacy[i], 9))
    expect(getLoopDuration(ex)).toBeCloseTo(getLoopDuration({ ...ex, grid: undefined }), 9)
  })
})
