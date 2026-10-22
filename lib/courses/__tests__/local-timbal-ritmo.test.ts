import { describe, expect, it, vi } from 'vitest'
vi.mock('next/headers', () => ({ headers: vi.fn() }))
import { replaceTimbalIntroItems, TIMBAL_RITMO_ORIGINAL, TIMBAL_RITMO_SOURCE } from '../local-timbal-intro'
import { RITMO_SOURCE_PATH } from '@/lib/playsense-studio/ritmo-presentation'

describe('local aligned lesson replacement', () => {
  it('preserves primary identity, title, subtitles, trims and score while removing the duplicate slot', () => {
    const original = { id: TIMBAL_RITMO_ORIGINAL, title: 'Primary', title_es: 'Ritmo básico', video_url: '/reference.m4v', subtitles: ['es'], score_document_id: 'score', video_trim_in_seconds: 0, video_duration_seconds: 440.3399 }
    const source = { ...original, id: TIMBAL_RITMO_SOURCE, title: 'Codex-Ritmo_Basico', video_url: '/new.m4v', video_duration_seconds: 442.208433 }
    const quiz = { id: 'quiz', title: 'Quiz' }
    const result = replaceTimbalIntroItems([original, source, quiz])
    expect(result).toEqual([{ ...original, video_url: RITMO_SOURCE_PATH, video_duration_seconds: 442.208433, video_trim_in_seconds: 0, video_trim_out_seconds: null }, quiz])
    expect(original.video_url).toBe('/reference.m4v')
  })
  it('does not replace unrelated lessons or an absent upload', () => {
    const items = [{ id: TIMBAL_RITMO_ORIGINAL, video_url: '/reference.m4v' }]
    expect(replaceTimbalIntroItems(items)).toBe(items)
  })
})
