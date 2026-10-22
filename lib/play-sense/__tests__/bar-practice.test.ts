import { describe, expect, it } from 'vitest'
import { barPracticeClip } from '../bar-practice'
import type { ExerciseDefinition } from '../types'
const exercise = { bpm:120, timeSignature:[4,4], measures:3 } as ExerciseDefinition

describe('bar practice media mapping', () => {
  it('uses the authored video bar-one anchor, independent of practice speed', () => {
    expect(barPracticeClip(exercise, 2, 7)?.start).toBe(9)
    expect(barPracticeClip(exercise, 2, 7)?.end).toBe(11)
  })
  it('uses variable measure timing and meter from the evaluated grid', () => {
    const grid = { measureStartSec:[0,2,3.5,6.5], measureStartQN:[0,4,7,10], secPerQN:[.5,.5,1], beatQN:[1,1,1] }
    expect(barPracticeClip({...exercise,grid},3,10)).toEqual({start:13.5,end:16.5,bpm:60,beats:3,beatSeconds:1})
  })
  it('never invents a clip beyond the usable media or for an invalid measure', () => {
    expect(barPracticeClip(exercise, 3, 7, 7, 12)).toBeNull()
    expect(barPracticeClip(exercise, 0, 7)).toBeNull()
    expect(barPracticeClip(exercise, 4, 7)).toBeNull()
  })
})
