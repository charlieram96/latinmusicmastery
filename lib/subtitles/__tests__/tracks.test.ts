import { describe, it, expect } from 'vitest'
import { parseSubtitles, validateSubtitlesInput } from '../tracks'
import { MAX_SUBTITLE_TRACKS, SUBTITLE_LANGUAGES, subtitleLabel } from '../srt-to-vtt'

const url = (lang: string) => `https://cdn.example.com/item-${lang}.vtt`

describe('subtitle language table', () => {
  it('offers the nine agreed languages in picker order', () => {
    expect(SUBTITLE_LANGUAGES.map((l) => l.code)).toEqual([
      'en', 'es', 'pt', 'fr', 'it', 'de', 'nl', 'ja', 'zh',
    ])
  })

  it('caps a video at nine tracks', () => {
    expect(MAX_SUBTITLE_TRACKS).toBe(9)
  })

  it('labels known codes with their native name', () => {
    expect(subtitleLabel('es')).toBe('Español')
    expect(subtitleLabel('ja')).toBe('日本語')
  })

  it('falls back to the code for an unknown language', () => {
    expect(subtitleLabel('xx')).toBe('xx')
  })
})

describe('parseSubtitles', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(parseSubtitles(undefined)).toEqual([])
    expect(parseSubtitles(null)).toEqual([])
    expect(parseSubtitles('[]')).toEqual([])
    expect(parseSubtitles({ lang: 'en', src: url('en') })).toEqual([])
  })

  it('maps stored entries to track definitions with labels', () => {
    expect(parseSubtitles([{ lang: 'en', src: url('en') }, { lang: 'pt', src: url('pt') }])).toEqual([
      { lang: 'en', label: 'English', src: url('en') },
      { lang: 'pt', label: 'Português', src: url('pt') },
    ])
  })

  it('skips malformed elements instead of failing the whole list', () => {
    expect(
      parseSubtitles([
        null,
        'en',
        { lang: 'en' },
        { src: url('fr') },
        { lang: 42, src: url('de') },
        { lang: 'it', src: url('it') },
      ])
    ).toEqual([{ lang: 'it', label: 'Italiano', src: url('it') }])
  })

  it('normalizes language codes to trimmed lowercase', () => {
    expect(parseSubtitles([{ lang: ' ZH ', src: url('zh') }])).toEqual([
      { lang: 'zh', label: '中文', src: url('zh') },
    ])
  })

  it('keeps the first entry when a language repeats', () => {
    expect(parseSubtitles([{ lang: 'en', src: url('en') }, { lang: 'EN', src: url('en2') }])).toEqual([
      { lang: 'en', label: 'English', src: url('en') },
    ])
  })

  it('never returns more than the cap', () => {
    const ten = [...SUBTITLE_LANGUAGES.map((l) => ({ lang: l.code, src: url(l.code) })), { lang: 'xx', src: url('xx') }]
    expect(ten).toHaveLength(MAX_SUBTITLE_TRACKS + 1)
    expect(parseSubtitles(ten)).toHaveLength(MAX_SUBTITLE_TRACKS)
  })

  it('labels unknown codes with the code itself', () => {
    expect(parseSubtitles([{ lang: 'xx', src: url('xx') }])).toEqual([
      { lang: 'xx', label: 'xx', src: url('xx') },
    ])
  })
})

describe('validateSubtitlesInput', () => {
  it('accepts an empty list', () => {
    expect(validateSubtitlesInput([])).toEqual({ ok: true, value: [] })
  })

  it('returns the normalized entries on success', () => {
    expect(validateSubtitlesInput([{ lang: ' Fr ', src: url('fr') }])).toEqual({
      ok: true,
      value: [{ lang: 'fr', src: url('fr') }],
    })
  })

  it('rejects a value that is not an array', () => {
    const r = validateSubtitlesInput({ lang: 'en', src: url('en') })
    expect(r.ok).toBe(false)
  })

  it('rejects more than the cap', () => {
    const ten = [...SUBTITLE_LANGUAGES.map((l) => ({ lang: l.code, src: url(l.code) })), { lang: 'xx', src: url('xx') }]
    const r = validateSubtitlesInput(ten)
    expect(r).toEqual({ ok: false, error: `At most ${MAX_SUBTITLE_TRACKS} subtitle tracks per video` })
  })

  it('rejects an element that is not an object', () => {
    expect(validateSubtitlesInput(['en']).ok).toBe(false)
  })

  it('rejects an empty language code', () => {
    expect(validateSubtitlesInput([{ lang: '  ', src: url('en') }]).ok).toBe(false)
  })

  it('rejects the reserved "off" code', () => {
    expect(validateSubtitlesInput([{ lang: 'off', src: url('en') }]).ok).toBe(false)
  })

  it('rejects duplicate languages regardless of case', () => {
    const r = validateSubtitlesInput([{ lang: 'en', src: url('en') }, { lang: 'EN', src: url('en2') }])
    expect(r.ok).toBe(false)
  })

  it('rejects a source that is not an https url', () => {
    expect(validateSubtitlesInput([{ lang: 'en', src: 'http://x/en.vtt' }]).ok).toBe(false)
    expect(validateSubtitlesInput([{ lang: 'en', src: '' }]).ok).toBe(false)
    expect(validateSubtitlesInput([{ lang: 'en', src: 7 }]).ok).toBe(false)
  })
})
