import { describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_SETTINGS, readQuizSettings } from '../quiz-settings'

describe('readQuizSettings', () => {
  it('defaults to focus mode', () => {
    expect(readQuizSettings(null)).toEqual({ mode: 'focus' })
    expect(readQuizSettings({})).toEqual(DEFAULT_QUIZ_SETTINGS)
    expect(readQuizSettings('garbage')).toEqual(DEFAULT_QUIZ_SETTINGS)
  })
  it('accepts sheet and rejects unknown modes', () => {
    expect(readQuizSettings({ mode: 'sheet' })).toEqual({ mode: 'sheet' })
    expect(readQuizSettings({ mode: 'paged' })).toEqual({ mode: 'focus' })
  })
})
