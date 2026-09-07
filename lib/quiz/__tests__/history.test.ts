import { describe, expect, it } from 'vitest'
import { historyReducer, type HistoryState } from '@/hooks/use-history'

const s0: HistoryState<number> = { past: [], present: 0, future: [] }

describe('historyReducer', () => {
  it('commits, undoes and redoes', () => {
    const s1 = historyReducer(s0, { type: 'commit', next: 1 })
    const s2 = historyReducer(s1, { type: 'commit', next: 2 })
    expect(s2).toEqual({ past: [0, 1], present: 2, future: [] })
    const u = historyReducer(s2, { type: 'undo' })
    expect(u).toEqual({ past: [0], present: 1, future: [2] })
    expect(historyReducer(u, { type: 'redo' })).toEqual(s2)
  })
  it('ignores a commit that changes nothing and clears the future on a new commit', () => {
    const s1 = historyReducer(s0, { type: 'commit', next: 0 })
    expect(s1).toBe(s0)
    const u = historyReducer(historyReducer(s0, { type: 'commit', next: 1 }), { type: 'undo' })
    expect(historyReducer(u, { type: 'commit', next: 5 })).toEqual({ past: [0], present: 5, future: [] })
  })
  it('does nothing at the ends and resets', () => {
    expect(historyReducer(s0, { type: 'undo' })).toBe(s0)
    expect(historyReducer(s0, { type: 'redo' })).toBe(s0)
    expect(historyReducer({ past: [1, 2], present: 3, future: [4] }, { type: 'reset', present: 9 })).toEqual({ past: [], present: 9, future: [] })
  })
  it('caps the past at 100 entries', () => {
    let s = s0
    for (let i = 1; i <= 120; i++) s = historyReducer(s, { type: 'commit', next: i })
    expect(s.past).toHaveLength(100)
    expect(s.past[0]).toBe(20)
  })
})
