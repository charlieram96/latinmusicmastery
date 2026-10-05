import { expect, it } from 'vitest'
import { SYNC_EXERCISE, SYNC_OFFSETS, SYNC_FIRST_NOTE, SYNC_COUNT_IN_SECONDS, SYNC_BEAT_SECONDS } from '../sync-probe-plan'
import { generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils'
it('places each 3D note center on exactly the emitted downbeat after one count-in bar',()=>{
 const expected=generateExpectedTimestamps(SYNC_EXERCISE)
 expect(expected).toHaveLength(8)
 expect(SYNC_COUNT_IN_SECONDS).toBe(4*SYNC_BEAT_SECONDS)
 expected.forEach((note,i)=>{
  expect(note.timestamp).toBeCloseTo(SYNC_OFFSETS[i]-SYNC_FIRST_NOTE,10)
  expect(SYNC_EXERCISE.events[i].beat).toBe(1)
 })
})
