// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectiveBackingGain, readStoredBackingMix, writeStoredBackingMix, type BackingMix } from '../backing-mix'

describe('effectiveBackingGain', () => {
  it('multiplies the authored level by the student level and clamps to 0..1', () => {
    expect(effectiveBackingGain(0.8, { level: 0.5, muted: false })).toBeCloseTo(0.4)
    expect(effectiveBackingGain(undefined, { level: 1, muted: false })).toBe(1)
    expect(effectiveBackingGain(1.7, { level: 1, muted: false })).toBe(1)
    expect(effectiveBackingGain(0.8, undefined)).toBeCloseTo(0.8)
  })
  it('is silent while muted, whatever the levels', () => {
    expect(effectiveBackingGain(0.8, { level: 0.9, muted: true })).toBe(0)
  })
})

describe('stored backing mix', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    })
  })
  it('round-trips per-track levels and mutes, dropping malformed entries', () => {
    const mix: BackingMix = { a: { level: 0.6, muted: false }, b: { level: 1, muted: true } }
    writeStoredBackingMix(mix)
    expect(readStoredBackingMix()).toEqual(mix)
    localStorage.setItem('playsense.backingMix', JSON.stringify({ a: { level: 'loud' }, c: { level: 2, muted: 0 } }))
    expect(readStoredBackingMix()).toEqual({ c: { level: 1, muted: false } })
  })
  it('returns an empty mix when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(readStoredBackingMix()).toEqual({})
    expect(() => writeStoredBackingMix({})).not.toThrow()
  })
})
