// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '@/lib/i18n'

let learningMode: 'kids' | 'classic' = 'classic'
vi.mock('@/components/learning-mode/store', () => ({ useLearningMode: () => learningMode }))
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/dashboard/course/c/class/k' }))
vi.mock('@/app/actions/progress', () => ({ markClassItemComplete: vi.fn(async () => ({ success: true })) }))
vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params) }),
}))
vi.mock('next/link', () => ({ useLinkStatus: () => ({ pending: false }), default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock('next/image', () => ({ default: () => <span data-logo /> }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null, RAIL_REVEAL: '' }))
vi.mock('@/components/language-toggle', () => ({ LanguageToggle: () => null }))
vi.mock('framer-motion', () => ({ useReducedMotion: () => true, motion: { span: 'span' } }))

import { TransportBar } from '@/components/playsense-studio/player/transport/transport-bar'
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
  learningMode = 'classic'
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('LessonModeShell', () => {
  it.each(['kids', 'classic'] as const)('collapses both footer rows in %s mode without remounting activity actions', (mode) => {
    learningMode = mode
    act(() => root.render(<LessonModeShell {...props(1)} />))
    const toggle = host.querySelector<HTMLButtonElement>('.lx-bottom-toggle')!
    const action = host.querySelector('[data-continue]')
    const content = document.getElementById(toggle.getAttribute('aria-controls')!)!
    act(() => toggle.click())
    expect(content.hidden).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector('[data-continue]')).toBe(action)
    act(() => toggle.click())
    expect(content.hidden).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('[data-continue]')).toBe(action)
  })

  it.each(['kids', 'classic'] as const)('moves video navigation into transport and removes narration in %s', (mode) => {
    learningMode = mode
    const noop = () => {}
    act(() => root.render(<LessonModeShell {...props(0)} body={<TransportBar
      currentSeconds={0} durationSeconds={60} isPlaying={false} playbackRate={1}
      onToggle={noop} onRestart={noop} onSeek={noop} onRateChange={noop}
      loopA={null} loopB={null} loopEnabled={false} onToggleLoop={noop} onClearLoop={noop}
      bpm={120} beatsPerMeasure={4} />} />))
    expect(host.querySelector('[data-transport-actions] [data-lesson-next]')).not.toBeNull()
    expect(host.querySelector('.lx-bottom [data-lesson-action-bar]')).toBeNull()
    expect(host.querySelector('[aria-label="Listen to lesson"]')).toBeNull()
    act(() => root.render(<LessonModeShell {...props(1)} />))
    expect(host.querySelector('.lx-bottom [data-action-host] [data-continue]')).not.toBeNull()
  })

  it('keeps course destinations visible while an activity owns the answer controls', () => {
    act(() => root.render(<LessonModeShell {...props(1)} />))
    const nav = host.querySelector('[data-course-sequence]')!
    expect(nav.textContent).toContain('Current')
    expect(nav.textContent).toContain('Quiz')
    expect(nav.querySelector('a')?.getAttribute('href')).toBe('/dashboard/course/c/class/k?itemId=a')
    expect(nav.textContent).toContain('Montuno in F')
    expect(host.querySelector('[data-continue]')).not.toBeNull()
  })

  it('offers narration only for accessible lessons, never practice, quiz or jam', () => {
    for (const item_type of ['VIDEO', 'EXERCISE', 'QUIZ', 'JAM_SESSION']) {
      act(() => root.render(<LessonModeShell {...props(0)} hasAccess parts={[{id:'a',title:'Part',item_type}]} />))
      expect(!!host.querySelector('[aria-label="Listen to lesson"]')).toBe(item_type==='VIDEO')
    }
    act(() => root.render(<LessonModeShell {...props(0)} hasAccess={false} parts={[]} progress={null} />))
    expect(host.querySelector('[aria-label="Listen to lesson"]')).toBeNull()
  })

  it('lays out rail, top bar, a scrolling stage and the action bar', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    expect(host.querySelector('[data-lesson-rail]')).not.toBeNull()
    expect(host.querySelector('[data-lesson-top-bar] h1')?.textContent).toBe('Montuno in C')
    expect(host.querySelector('main[data-lesson-stage][data-dashboard-main] [data-finish]')).not.toBeNull()
    expect(host.querySelector('[data-lesson-action-bar] [data-continue]')).not.toBeNull()
    expect(host.querySelector('[data-streak]')?.textContent).toContain('1')
  })

  it('shows one community thread below every lesson part, including exercises', () => {
    for (const item_type of ['VIDEO', 'EXERCISE', 'JAM_SESSION', 'QUIZ']) {
      const input = props(0)
      act(() => root.render(<LessonModeShell {...input} parts={[{ id: 'a', title: 'Part', item_type }]} />))
      const community = host.querySelector('[data-lesson-community]')!
      expect(community.querySelector('[data-comments]')).not.toBeNull()
      expect(host.querySelectorAll('[data-comments]')).toHaveLength(1)
      expect(community.closest('[hidden]')).toBeNull()
      expect(community.previousElementSibling).not.toBeNull()
    }
  })

  it('omits community for locked lessons', () => {
    act(() => root.render(<LessonModeShell {...props(0)} comments={null} progress={null} />))
    expect(host.querySelector('[data-lesson-community]')).toBeNull()
  })

  it('opens the drawer from the top bar', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    act(() => (host.querySelector('[data-open-drawer]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[data-lesson-drawer]')?.textContent).toContain('About the montuno.')
  })

  it('continues to the next part', () => {
    act(() => root.render(<LessonModeShell {...props(0)} />))
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith('/dashboard/course/c/class/k?itemId=b')
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

  it('leaves the celebration when the student opens another part', async () => {
    act(() => root.render(<LessonModeShell {...props(1, ['a'])} />))
    await act(async () => (host.querySelector('[data-finish]') as HTMLButtonElement).click())
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(host.querySelector('[data-lesson-done]')).not.toBeNull()
    act(() => root.render(<LessonModeShell {...props(0, ['a'])} />))
    expect(host.querySelector('[data-lesson-done]')).toBeNull()
    expect(host.querySelector('.lx-fill')?.hasAttribute('hidden')).toBe(false)
  })

  it('celebrates while the last part is still saving', async () => {
    const never = () => new Promise<{ success: true }>(() => {})
    act(() => root.render(<LessonModeShell {...props(1, ['a'])} saveCompletion={never} />))
    await act(async () => (host.querySelector('[data-finish]') as HTMLButtonElement).click())
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('[data-lesson-done]')).not.toBeNull()
  })

  it('goes straight on when the lesson was already complete', () => {
    act(() => root.render(<LessonModeShell {...props(1, ['a', 'b'])} />))
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith('/dashboard/course/c/class/k2')
    expect(host.querySelector('[data-lesson-done]')).toBeNull()
  })

  it('shows the streak growing when this lesson’s earlier part started today’s practice (L8)', async () => {
    const p = { ...props(1, ['a']), practice: { dateKeys: ['2026-09-24', '2026-09-25'], today: '2026-09-25', lessonToday: 1 } }
    act(() => root.render(<LessonModeShell {...p} />))
    await act(async () => (host.querySelector('[data-finish]') as HTMLButtonElement).click())
    act(() => (host.querySelector('[data-continue]') as HTMLButtonElement).click())
    expect(host.querySelector('.lx-flip-old')?.textContent).toBe('1')
    expect(host.querySelector('[data-streak-value]')?.textContent).toBe('2')
  })

  it('lets a modified click on Finish lesson open the link normally (L6)', async () => {
    const quiet = { ...props(1, ['a']), body: <LessonActivityBoundary classItemId="b" required={['questions']}><FinishOnly /></LessonActivityBoundary> }
    act(() => root.render(<LessonModeShell {...quiet} />))
    await act(async () => (host.querySelector('[data-finish]') as HTMLButtonElement).click())
    const next = host.querySelector('[data-lesson-next]') as HTMLAnchorElement
    const ctrl = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
    act(() => { next.dispatchEvent(ctrl) })
    expect(ctrl.defaultPrevented).toBe(false)
    expect(host.querySelector('[data-lesson-done]')).toBeNull()
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true })
    act(() => { next.dispatchEvent(plain) })
    expect(plain.defaultPrevented).toBe(true)
    expect(host.querySelector('[data-lesson-done]')).not.toBeNull()
  })

  it('keeps the frame value stable across shell re-renders (L9)', () => {
    let renders = 0
    function Probe() { useLessonFrame(); renders++; return null }
    act(() => root.render(<LessonModeShell {...props(0)} body={<Probe />} />))
    const before = renders
    act(() => (host.querySelector('[data-open-drawer]') as HTMLButtonElement).click())
    expect(renders).toBe(before)
  })
})

function FinishOnly() {
  const finish = useLessonActivity('questions')
  return <button data-finish onClick={finish}>finish</button>
}
