import { describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_PREFS, QUIZ_PREFS_KEY, loadQuizPrefs, parseQuizPrefs, saveQuizPrefs } from '../prefs'

describe('quiz prefs', () => {
  it('defaults sound on and tolerates junk', () => {
    expect(DEFAULT_QUIZ_PREFS).toEqual({ sound: true })
    expect(parseQuizPrefs(null)).toEqual({ sound: true })
    expect(parseQuizPrefs('{not json')).toEqual({ sound: true })
    expect(parseQuizPrefs('{"sound":"loud"}')).toEqual({ sound: true })
    expect(parseQuizPrefs('{"sound":false}')).toEqual({ sound: false })
  })
  it('round-trips through a storage-like object', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    saveQuizPrefs(storage, { sound: false })
    expect(store.get(QUIZ_PREFS_KEY)).toBe('{"sound":false}')
    expect(loadQuizPrefs(storage)).toEqual({ sound: false })
    expect(loadQuizPrefs(null)).toEqual(DEFAULT_QUIZ_PREFS)
  })
})
