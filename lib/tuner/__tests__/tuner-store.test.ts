import { describe, it, expect, vi } from 'vitest'
import { createTunerStore, EMPTY_SNAPSHOT } from '../tuner-store'

describe('tuner-store', () => {
  it('starts empty', () => {
    const s = createTunerStore()
    expect(s.getSnapshot()).toBe(EMPTY_SNAPSHOT)
    expect(EMPTY_SNAPSHOT).toEqual({ frame: null, level: 0, clip: false })
  })

  it('notifies subscribers and returns the same snapshot object until the next set', () => {
    const s = createTunerStore()
    const cb = vi.fn()
    const off = s.subscribe(cb)
    const next = { ...EMPTY_SNAPSHOT, level: 0.5 }
    s.set(next)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.getSnapshot()).toBe(next)
    expect(s.getSnapshot()).toBe(s.getSnapshot())
    off()
    s.reset()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(s.getSnapshot()).toBe(EMPTY_SNAPSHOT)
  })

  it('reset notifies remaining subscribers', () => {
    const s = createTunerStore()
    const cb = vi.fn()
    s.subscribe(cb)
    s.set({ ...EMPTY_SNAPSHOT, clip: true })
    s.reset()
    expect(cb).toHaveBeenCalledTimes(2)
  })
})
