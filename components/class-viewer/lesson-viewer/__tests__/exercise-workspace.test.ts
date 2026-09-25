import { describe, expect, it } from 'vitest'
import { layoutForScorePosition, scorePositionFor } from '../exercise-workspace'
import { PLAY_WORKSPACE } from '@/lib/playsense-studio/workspace-layout'

describe('score position bridge for the exercise score', () => {
  it('reads the workspace as a score position', () => {
    expect(scorePositionFor(PLAY_WORKSPACE, 'pip')).toBe('right')
    expect(scorePositionFor(PLAY_WORKSPACE, 'music')).toBe('right')
    expect(scorePositionFor(PLAY_WORKSPACE, 'side')).toBe('right')
    expect(scorePositionFor({ ...PLAY_WORKSPACE, swap: true }, 'side')).toBe('left')
    expect(scorePositionFor(PLAY_WORKSPACE, 'stack')).toBe('top')
  })
  it('turns a score position into a workspace layout', () => {
    expect(layoutForScorePosition('left')).toEqual({ layout: 'side', swap: true })
    expect(layoutForScorePosition('right')).toEqual({ layout: 'side', swap: false })
    expect(layoutForScorePosition('top')).toEqual({ layout: 'stack', swap: false })
  })
})
