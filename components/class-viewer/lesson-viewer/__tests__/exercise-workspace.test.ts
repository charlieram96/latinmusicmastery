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

describe('narrow stage inside the workspace', () => {
  it('keeps compacting the highway HUD when its region is narrow', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(new URL('../exercise-workspace.css', import.meta.url), 'utf8')
    expect(css).toMatch(/:is\(\.ws-staff, \.ws-highway\) > \.ps-lesson-stage \{[^}]*container-type:inline-size;[^}]*container-name:exercise-stage/)
    expect(css).toMatch(/@container exercise-stage \(max-width:650px\)[\s\S]*\.ps-lesson-stage-title \{ display:none; \}[\s\S]*\.ps-scoreboard-compact/)
  })
})
