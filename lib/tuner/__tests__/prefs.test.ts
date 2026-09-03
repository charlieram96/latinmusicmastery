import { describe, it, expect } from 'vitest'
import { parsePrefs, DEFAULT_PREFS, loadPrefs, savePrefs, PREFS_KEY } from '../prefs'

describe('prefs', () => {
  it('has the spec defaults', () => {
    expect(DEFAULT_PREFS).toEqual({
      instrument: 'guitar',
      tuning: 'standard',
      a4: 440,
      sensitivity: 'med',
      tolerance: 3,
      names: 'letters',
      transpose: 0,
      holdSec: 1,
      meter: 'needle',
    })
  })

  it('returns defaults for null, garbage and out-of-range values', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ a4: 9999 }))).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ tolerance: 4 }))).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(JSON.stringify({ instrument: 'banjo' }))).toEqual(DEFAULT_PREFS)
  })

  it('merges a partial object over defaults', () => {
    expect(parsePrefs(JSON.stringify({ a4: 442, names: 'solfege' }))).toEqual({ ...DEFAULT_PREFS, a4: 442, names: 'solfege' })
  })

  it('loads and saves through a storage-like object, swallowing errors', () => {
    const mem: Record<string, string> = {}
    savePrefs({ setItem: (k, v) => { mem[k] = v } }, { ...DEFAULT_PREFS, a4: 441 })
    expect(Object.keys(mem)).toEqual([PREFS_KEY])
    expect(loadPrefs({ getItem: (k) => mem[k] ?? null }).a4).toBe(441)
    expect(() => savePrefs({ setItem: () => { throw new Error('quota') } }, DEFAULT_PREFS)).not.toThrow()
    expect(loadPrefs({ getItem: () => { throw new Error('blocked') } })).toEqual(DEFAULT_PREFS)
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS)
  })
})
