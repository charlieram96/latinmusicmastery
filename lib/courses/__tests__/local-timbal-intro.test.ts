import { expect, it, vi } from 'vitest'
vi.mock('next/headers', () => ({ headers: vi.fn() }))
import { replaceTimbalIntroItems, TIMBAL_INTRO_ORIGINAL, TIMBAL_INTRO_SOURCE } from '../local-timbal-intro'
import { lessonPresentationFor, TIMBAL_INTRO_REVISED_FILE } from '@/lib/playsense-studio/lesson-presentation'

it('preserves the current admin upload instead of forcing the old local demo', () => {
  const original = { id: TIMBAL_INTRO_ORIGINAL, video_url: `https://example.org/${TIMBAL_INTRO_REVISED_FILE}`, subtitles: [], video_duration_seconds: 185 }
  const result = replaceTimbalIntroItems([original, { id: TIMBAL_INTRO_SOURCE, video_url: '/old-demo.m4v' }])
  expect(result).toEqual([original])
  expect(lessonPresentationFor(original.video_url, true)?.id).toBe('codex-intro-v1')
  expect(lessonPresentationFor(original.video_url, false)).toBeNull()
})
it('also preserves future replacements and an upload without the old demo record', () => {
  const original = { id: TIMBAL_INTRO_ORIGINAL, video_url: '/future-upload.mp4' }
  expect(replaceTimbalIntroItems([original])).toEqual([original])
  expect(replaceTimbalIntroItems([original, { id: TIMBAL_INTRO_SOURCE, video_url: '/old-demo.m4v' }])).toEqual([original])
})

it('does not restore a deleted video from the retired demo', () => {
  const original = { id: TIMBAL_INTRO_ORIGINAL, video_url: null }
  expect(replaceTimbalIntroItems([original, { id: TIMBAL_INTRO_SOURCE, video_url: '/old-demo.m4v' }])).toEqual([original])
  expect(replaceTimbalIntroItems([{ id: TIMBAL_INTRO_SOURCE, video_url: '/old-demo.m4v' }])).toEqual([])
})
