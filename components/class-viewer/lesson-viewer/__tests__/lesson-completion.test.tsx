// @vitest-environment jsdom
import React, { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '@/lib/i18n'
import { LessonActivityBoundary, LessonProgressProvider, useLessonActivity } from '../lesson-progress-context'
import { LessonFooter } from '../lesson-footer'
import { LessonMediaEmbed } from '../lesson-media-embed'
import type { LessonActivity } from '@/lib/courses/lesson-completion'

vi.mock('@/app/actions/progress', () => ({ markClassItemComplete: vi.fn() }))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params) }) }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))

function Controls() {
  const performance = useLessonActivity('performance')
  const questions = useLessonActivity('questions')
  return <><video data-media /><LessonMediaEmbed src="https://www.soundslice.com/slices/preview/embed/?foo=bar" /><button onClick={performance}>Finish practice</button><button onClick={questions}>Finish questions</button></>
}

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

const ids = ['video', 'exercise']
function Scene({ save, id = 'video', required = ['media'], initial = [], disabled = false }: {
  save: () => Promise<{ success: true } | { error: string }>
  id?: string
  required?: LessonActivity[]
  initial?: string[]
  disabled?: boolean
}) {
  return <StrictMode><LessonProgressProvider itemIds={ids} initialCompletedItemIds={initial} saveCompletion={save}>
    <LessonActivityBoundary key={id} classItemId={id} required={required} disabled={disabled}><Controls /></LessonActivityBoundary>
    <LessonFooter courseId="son" classId="rhythm" currentIndex={ids.indexOf(id)} totalItems={2} itemIds={ids} completedItemIds={initial}
      activeItemId={id} activeItemType={id === 'video' ? 'VIDEO' : 'EXERCISE'} nextClassId="next-lesson" isCompleted={initial.includes(id)} nextLabel="Next activity" />
  </LessonProgressProvider></StrictMode>
}
const next = () => host.querySelector('[data-lesson-next]')!
const status = () => host.querySelector('[role=status]')!.textContent
const mediaEnd = async () => act(async () => { host.querySelector('video')!.dispatchEvent(new Event('ended')) })
const click = async (text: string) => act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === text)!.click() })

describe('automatic lesson completion', () => {
  it('waits for media end and successful persistence, then lights Next exactly once', async () => {
    let resolve!: (value: { success: true }) => void
    const save = vi.fn(() => new Promise<{ success: true }>(r => { resolve = r }))
    await act(async () => root.render(<Scene save={save} />))
    expect(host.textContent).not.toContain('Mark as completed')
    expect(next().getAttribute('data-ready')).toBe('false')
    expect(host.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('0')
    await act(async () => { host.querySelector('video')!.dispatchEvent(new Event('pause')) })
    expect(save).not.toHaveBeenCalled()
    await mediaEnd()
    await mediaEnd()
    expect(save).toHaveBeenCalledTimes(1)
    expect(status()).toContain('Saving your progress')
    expect(next().getAttribute('data-ready')).toBe('false')
    await act(async () => resolve({ success: true }))
    expect(status()).toContain('Video complete')
    expect(next().getAttribute('data-ready')).toBe('true')
    expect(host.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('1')
    await mediaEnd()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('requires both performance and questions, and ignores the demo video', async () => {
    const save = vi.fn(async () => ({ success: true as const }))
    await act(async () => root.render(<Scene id="exercise" required={['performance', 'questions']} save={save} initial={['video']} />))
    await mediaEnd()
    expect(save).not.toHaveBeenCalled()
    await click('Finish practice')
    expect(status()).toContain('Practice complete')
    expect(status()).toContain('Finish the questions')
    expect(next().getAttribute('data-ready')).toBe('false')
    await click('Finish questions')
    expect(save).toHaveBeenCalledTimes(1)
    expect(status()).toContain('Lesson complete')
    expect(next().getAttribute('href')).toBe('/dashboard/course/son/class/next-lesson')
    expect(next().getAttribute('data-ready')).toBe('true')
  })

  it('allows retry after a failed save without claiming completion or repeating the activity', async () => {
    const save = vi.fn<() => Promise<{ success: true } | { error: string }>>()
      .mockResolvedValueOnce({ error: 'offline' }).mockResolvedValueOnce({ success: true })
    await act(async () => root.render(<Scene save={save} />))
    await mediaEnd()
    expect(status()).toContain('Progress could not be saved')
    expect(next().getAttribute('data-ready')).toBe('false')
    await mediaEnd()
    expect(save).toHaveBeenCalledTimes(1)
    await click('Retry saving')
    expect(next().getAttribute('data-ready')).toBe('true')
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('keeps prior completion while navigating and never carries it into an unfinished part', async () => {
    const save = vi.fn(async () => ({ success: true as const }))
    await act(async () => root.render(<Scene save={save} initial={['video']} />))
    expect(next().getAttribute('data-ready')).toBe('true')
    await mediaEnd()
    expect(save).not.toHaveBeenCalled()
    await act(async () => root.render(<Scene save={save} id="exercise" required={['performance']} initial={['video']} />))
    expect(next().getAttribute('data-ready')).toBe('false')
    expect(status()).toContain('1 of 2 parts completed')
  })

  it('a delayed save completes only the item that finished, even after navigation', async () => {
    let resolve!: (value: { success: true }) => void
    const save = vi.fn(() => new Promise<{ success: true }>(r => { resolve = r }))
    await act(async () => root.render(<Scene save={save} />))
    await mediaEnd()
    await act(async () => root.render(<Scene id="exercise" required={['performance']} save={save} />))
    await act(async () => resolve({ success: true }))
    expect(next().getAttribute('data-ready')).toBe('false')
    expect(status()).toContain('1 of 2 parts completed')
  })

  it('accepts only the legacy player’s audio-end event from its own window and origin', async () => {
    const save = vi.fn(async () => ({ success: true as const }))
    await act(async () => root.render(<Scene save={save} />))
    const frame = host.querySelector('iframe')!
    expect(new URL(frame.src).searchParams.get('api')).toBe('1')
    expect(new URL(frame.src).searchParams.get('foo')).toBe('bar')
    const send = async (method: string, origin: string, source: Window | null) => act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ method }), origin, source }))
    })
    await send('ssAudioEnd', 'https://example.com', frame.contentWindow)
    await send('ssAudioEnd', 'https://www.soundslice.com', window)
    await send('ssOneTimeLoopEnd', 'https://www.soundslice.com', frame.contentWindow)
    expect(save).not.toHaveBeenCalled()
    await send('ssAudioEnd', 'https://www.soundslice.com', frame.contentWindow)
    expect(save).toHaveBeenCalledTimes(1)
    expect(next().getAttribute('data-ready')).toBe('true')
  })

  it('never saves completion from a read-only lesson preview', async () => {
    const save = vi.fn(async () => ({ success: true as const }))
    await act(async () => root.render(<Scene save={save} disabled />))
    await mediaEnd()
    await click('Finish practice')
    expect(save).not.toHaveBeenCalled()
    expect(next().getAttribute('data-ready')).toBe('false')
  })
})
