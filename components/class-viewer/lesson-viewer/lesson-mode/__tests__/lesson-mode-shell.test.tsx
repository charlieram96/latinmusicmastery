// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '@/lib/i18n'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard/course/c/class/k' }))
vi.mock('@/app/actions/progress', () => ({ markClassItemComplete: vi.fn(async () => ({ success: true })) }))
vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params) }),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock('next/image', () => ({ default: () => <span data-logo /> }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/language-toggle', () => ({ LanguageToggle: () => null }))
vi.mock('framer-motion', () => ({ useReducedMotion: () => true, motion: { span: 'span' } }))

import { LessonModeShell, type LessonModeShellProps } from '../lesson-mode-shell'
import { LessonActivityBoundary, useLessonActivity } from '../../lesson-progress-context'
import { LessonAction, useLessonFrame } from '../lesson-frame'

function Part({ id }: { id: string }) {
  return <LessonActivityBoundary classItemId={id} required={['questions']}><Finish /></LessonActivityBoundary>
}
function Finish() {
  const finish = useLessonActivity('questions')
  const frame = useLessonFrame()
  return <>
    <button data-finish onClick={finish}>finish</button>
    <LessonAction><button data-continue onClick={() => frame?.advance()}>Continue</button></LessonAction>
  </>
}

const props = (activeIndex: number, completed: string[] = []): LessonModeShellProps => ({
  course: { id: 'c', title: 'Timba Piano' },
  module: { id: 'm', title: 'Montuno foundations', index: 0 },
  lesson: { id: 'k', title: 'Montuno in C' },
  rail: [{ id: 'k', title: 'Montuno in C', href: '/dashboard/course/c/class/k', state: 'current', paywalled: false, kind: 'play', minutes: 11, number: 1 }],
  parts: [{ id: 'a', title: 'Demo', item_type: 'VIDEO' }, { id: 'b', title: 'Check', item_type: 'QUIZ' }],
  activeIndex,
  progress: { courseId: 'c', classId: 'k', currentIndex: activeIndex, totalItems: 2, itemIds: ['a', 'b'], completedItemIds: completed,
    nextClassId: 'k2', activeItemId: ['a', 'b'][activeIndex], activeItemType: ['VIDEO', 'QUIZ'][activeIndex], isCompleted: false, nextLabel: 'Next' },
  practice: { dateKeys: ['2026-09-24'], today: '2026-09-25' },
  about: { description: 'About the montuno.', meta: {} },
  comments: <div data-comments />,
  commentCount: 0,
  teacherName: 'Livan',
  nextLesson: { title: 'Montuno in F', kind: 'play', minutes: 12, href: '/dashboard/course/c/class/k2' },
  body: <Part id={['a', 'b'][activeIndex]} />,
})

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  push.mockReset()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('LessonModeShell', () => {
  it('lays out rail, top bar, a scrolling stage and the action bar', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    expect(host.querySelector('[data-lesson-rail]')).not.toBeNull()
    expect(host.querySelector('[data-lesson-top-bar] h1')?.textContent).toBe('Montuno in C')
    expect(host.querySelector('main[data-lesson-stage][data-dashboard-main] [data-finish]')).not.toBeNull()
    expect(host.querySelector('[data-lesson-action-bar] [data-continue]')).not.toBeNull()
    expect(host.querySelector('[data-streak]')?.textContent).toContain('1')
  })

  it('opens the drawer from the top bar', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    act(() => (host.querySelector('[data-open-drawer]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-lesson-drawer]')?.textContent).toContain('About the montuno.')
  })

  it('continues to the next part', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith('/dashboard/course/c/class/k?item=1')
  })

  it('celebrates when the last part completes the lesson in this visit', async () => {
    act(() => root.render(<LessonModeShell {...props(1, ['a'])} />))
    await act(async () => (host.querySelector('[data-finish]') as HTMLButtonElement).click())
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('[data-lesson-done]')).not.toBeNull()
    expect(host.querySelector('[data-streak-value]')?.textContent).toBe('2')
    expect(host.querySelector('[data-lesson-action-bar] [data-done-next]')).not.toBeNull()
  })

  it('goes straight on when the lesson was already complete', () => {
    act(() => root.render(<LessonModeShell {...props(1, ['a', 'b'])} />))
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith('/dashboard/course/c/class/k2')
    expect(host.querySelector('[data-lesson-done]')).toBeNull()
  })
})
