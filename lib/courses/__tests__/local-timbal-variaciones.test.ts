import { describe, expect, it, vi } from 'vitest'
vi.mock('next/headers', () => ({ headers: vi.fn() }))
import { replaceTimbalIntroItems, TIMBAL_VARIACIONES_ORIGINAL, TIMBAL_VARIACIONES_SOURCE } from '../local-timbal-intro'
import { VARIACIONES_SOURCE_PATH, variacionesPresentation } from '@/lib/playsense-studio/variaciones-presentation'
import { lessonPresentationFor, presentationCuesAt } from '@/lib/playsense-studio/lesson-presentation'

describe('local Variaciones replacement', () => {
  it('changes media while retaining original bilingual lesson content and relationships', () => {
    const original = { id: TIMBAL_VARIACIONES_ORIGINAL, title: 'Cáscara and Its Variations', title_es: 'La Cáscara y sus Variaciones', description: 'Original description', description_es: 'Descripción original', rich_notes: 'Notes', score_document_id: 'score', video_url: '/old.m4v', subtitles: [] }
    const source = { id: TIMBAL_VARIACIONES_SOURCE, title: 'Codex-Variaciones', video_url: '/upload.m4v' }
    const exercise = { id: 'exercise' }
    const result = replaceTimbalIntroItems([original, source, exercise])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ ...original, video_url: VARIACIONES_SOURCE_PATH, subtitles: [{lang:'es'}, {lang:'en'}] })
    expect(result[1]).toBe(exercise)
    expect(original.video_url).toBe('/old.m4v')
  })
  it('activates only the matching local presentation and rewinds cues with the clock', () => {
    expect(lessonPresentationFor(VARIACIONES_SOURCE_PATH, false)).toBeNull()
    expect(lessonPresentationFor(VARIACIONES_SOURCE_PATH, true)).toBe(variacionesPresentation)
    expect(presentationCuesAt(variacionesPresentation, 4)[0]?.kind).toBe('instructor')
    expect(presentationCuesAt(variacionesPresentation, 13)[0]?.id).toBe('sobao-introduction')
    expect(presentationCuesAt(variacionesPresentation, 0)).toEqual([])
  })
})
