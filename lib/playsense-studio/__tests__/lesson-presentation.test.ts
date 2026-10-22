import { describe, expect, it } from 'vitest'
import { TIMBAL_INTRO_REVISED_FILE, codexIntroPresentation, lessonPresentationFor, presentationCueAt, presentationProgress } from '../lesson-presentation'

describe('Codex Intro authored presentation', () => {
  it('only enables the exact new edit in local development', () => {
    expect(lessonPresentationFor(`https://example.org/videos/${TIMBAL_INTRO_REVISED_FILE}?token=x`, true)?.id).toBe('codex-intro-v1')
    expect(lessonPresentationFor(`/videos/${TIMBAL_INTRO_REVISED_FILE}`, false)).toBeNull()
    expect(lessonPresentationFor('/reference.m4v', true)).toBeNull()
    expect(lessonPresentationFor(`/prefix-${TIMBAL_INTRO_REVISED_FILE}`, true)).toBeNull()
  })
  it('selects cues from absolute media time in either seek direction', () => {
    for (const [seconds, id] of [[106, 'influence'], [86, 'decades'], [4, 'instructor'], [10, 'lesson'], [32, 'son-influence-map'], [38, 'son-influence-map'], [30, 'son-influence-map'], [45, 'son-oriente-map'], [50, 'son-oriente-map'], [42, 'son-oriente-map']] as const) {
      expect(presentationCueAt(codexIntroPresentation, seconds)?.id).toBe(id)
    }
    for (const seconds of [0, 7.7, 29.963266, 1166 * 1001 / 30000, 41.541499, 1547 * 1001 / 30000, 55, 78, 95, 120, 175, 177, 182.6]) expect(presentationCueAt(codexIntroPresentation, seconds)).toBeNull()
    expect(presentationProgress(101, 102)).toBe(0)
    expect(presentationProgress(102.325, 102)).toBeCloseTo(.5)
    expect(presentationProgress(106, 102)).toBe(1)
  })
  it('switches both translated slides on their exact source frames', () => {
    for (const [first, after, id] of [[898, 1166, 'son-influence-map'], [1245, 1547, 'son-oriente-map']] as const) {
      const at = (frame: number) => presentationCueAt(codexIntroPresentation, frame * 1001 / 30000)?.id
      expect(at(first - 1)).not.toBe(id)
      expect(at(first)).toBe(id)
      expect(at(after - 1)).toBe(id)
      expect(at(after)).not.toBe(id)
      expect(at(first)).toBe(id) // backward seek
      expect(presentationCueAt(codexIntroPresentation, Number((first * 1001 / 30000).toFixed(6)))?.id).toBe(id)
      expect(presentationCueAt(codexIntroPresentation, Number((after * 1001 / 30000).toFixed(6)))?.id).not.toBe(id)
    }
  })
  it('keeps bilingual, nonoverlapping cues inside the actual source duration', () => {
    let end = 0
    for (const cue of codexIntroPresentation.cues) {
      expect(cue.start).toBeGreaterThanOrEqual(end)
      expect(cue.end).toBeGreaterThan(cue.start)
      expect(cue.end).toBeLessThanOrEqual(182.59)
      expect(cue.title.en).toBeTruthy(); expect(cue.title.es).toBeTruthy()
      for (const item of cue.items ?? []) {
        expect(item.at).toBeGreaterThanOrEqual(cue.start)
        expect(item.at).toBeLessThan(cue.end)
      }
      end = cue.end
    }
  })
})

describe('aligned Ritmo lesson', () => {
  it('opens all three Patricio lessons on black, with the instructor over the source logo', async () => {
    const { RITMO_SOURCE_PATH } = await import('../ritmo-presentation')
    const { VARIACIONES_SOURCE_PATH } = await import('../variaciones-presentation')
    for (const src of [`/local-course-assets/${TIMBAL_INTRO_REVISED_FILE}`, RITMO_SOURCE_PATH, VARIACIONES_SOURCE_PATH]) {
      const presentation = lessonPresentationFor(src, true)!
      expect(presentation.poster).toBe('/local-course-assets/patricio-lesson-opening.svg')
      expect(presentationCueAt(presentation, 0)).toBeNull()
      expect(presentationCueAt(presentation, 1)?.kind).toBe('instructor')
      expect(presentationCueAt(presentation, 1)?.nameParts).toEqual(['PATRICIO', '"el chino"', 'DIAZ'])
      expect(lessonPresentationFor(src, false)).toBeNull()
    }
    expect(lessonPresentationFor('/exercise.mp4', true)).toBeNull()
  })
  it('only applies the reference clock to the aligned derivative', async () => {
    const { RITMO_SOURCE_PATH, RITMO_SOURCE_FILE } = await import('../ritmo-presentation')
    expect(lessonPresentationFor(RITMO_SOURCE_PATH, true)?.id).toBe('codex-ritmo-basico-v1')
    expect(lessonPresentationFor(RITMO_SOURCE_PATH, false)).toBeNull()
    expect(lessonPresentationFor(`/videos/${RITMO_SOURCE_FILE}`, true)).toBeNull()
  })
  it('restores simultaneous illustration and banner after seeking in either direction', async () => {
    const { ritmoPresentation } = await import('../ritmo-presentation')
    const { presentationCuesAt } = await import('../lesson-presentation')
    for (const time of [137.6898, 292.4024, 137.6898]) {
      const ids = presentationCuesAt(ritmoPresentation, time).map(cue => cue.id)
      expect(ids).toEqual(time === 137.6898 ? ['bamboo', 'cascara-pattern'] : ['accents'])
    }
    expect(presentationCuesAt(ritmoPresentation, 400)).toEqual([])
  })
})
