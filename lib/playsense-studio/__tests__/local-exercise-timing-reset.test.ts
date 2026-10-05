import { expect, it } from 'vitest'
import { GUITAR_LICK_FIXTURE } from '../score-fixtures'
import { localExerciseTimingReset, TIMING_TEST_ITEM } from '../local-exercise-timing-reset'
import { buildExerciseGrid } from '@/lib/play-sense/score-to-exercise'

it('resets only the requested local score without changing musical values or its source', () => {
  const score = structuredClone(GUITAR_LICK_FIXTURE)
  score.initialTempo = 120
  score.tempoMarksConfirmed = true
  score.playbackTempoOverride = 90
  score.tracks[0].measures[1].tempoChange = 85
  score.tracks[0].measures[0].voices[0].events[0].symbolOffsets = { note: { x: 12, y: 0 } }
  const before = structuredClone(score)
  const reset = localExerciseTimingReset(score, TIMING_TEST_ITEM, true)
  expect(score).toEqual(before)
  expect(reset.playbackTempoOverride).toBeUndefined()
  expect(reset.tracks[0].measures[1].tempoChange).toBeUndefined()
  expect(reset.tracks[0].measures[0].voices[0].events[0].symbolOffsets).toBeUndefined()
  expect(reset.tracks[0].measures.map(m => m.voices[0].events.map(e => e.durationQN)))
    .toEqual(score.tracks[0].measures.map(m => m.voices[0].events.map(e => e.durationQN)))
  expect(buildExerciseGrid(reset, reset.tracks[0]).measureStartSec).toEqual([0, 2, 4])
  expect(localExerciseTimingReset(score, 'another-exercise', true)).toBe(score)
  expect(localExerciseTimingReset(score, TIMING_TEST_ITEM, false)).toBe(score)
})
