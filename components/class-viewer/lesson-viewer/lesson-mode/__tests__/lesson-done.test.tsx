// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock('framer-motion', () => ({ useReducedMotion: () => true, motion: { span: 'span' } }))

import { LessonDone } from '../lesson-done'
import type { CelebrationStats } from '@/lib/dashboard/lesson-celebration'

const stats: CelebrationStats = {
  streak: { before: 4, after: 5 },
  week: { before: 3, after: 4, goal: 6 },
  milestones: [
    { key: 'lessons_25', title: 'Rising Star', iconName: 'Star', unit: 'lessons', requirement: 25, before: 18, after: 19 },
    { key: 'streak_7', title: 'Week Warrior', iconName: 'Flame', unit: 'days', requirement: 7, before: 4, after: 5 },
  ],
}
const next = { title: 'Montuno in F', kind: 'play' as const, minutes: 12, href: '/dashboard/course/c/class/k2' }

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (nextLesson: typeof next | null = next) => act(() => root.render(
  <LessonDone stats={stats} lessonTitle="Montuno in C" partCount={3} nextLesson={nextLesson} courseHref="/dashboard/course/c" />))

describe('LessonDone', () => {
  it('shows the new streak and the weekly goal with today’s lesson added', () => {
    render()
    expect(host.querySelector('[data-streak-value]')?.textContent).toBe('5')
    const segments = [...host.querySelectorAll('[data-week-segment]')]
    expect(segments).toHaveLength(6)
    expect(segments.map(s => s.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'new', 'todo', 'todo'])
    expect(host.textContent).toContain('dashboard.classViewer.lessonMode.done.week(4,6)')
  })

  it('shows achievement progress from the previous value', () => {
    render()
    const cards = [...host.querySelectorAll('[data-milestone]')]
    expect(cards).toHaveLength(2)
    const bar = cards[0].querySelector('[data-milestone-bar]') as HTMLElement
    expect(bar.style.getPropertyValue('--from')).toBe('72%')
    expect(bar.style.getPropertyValue('--to')).toBe('76%')
  })

  it('offers the next lesson and the way back to the course', () => {
    render()
    expect(host.querySelector('[data-next-lesson-card]')?.getAttribute('href')).toBe(next.href)
    expect(host.querySelector('[data-done-next]')?.getAttribute('href')).toBe(next.href)
    expect(host.querySelector('[data-done-back]')?.getAttribute('href')).toBe('/dashboard/course/c')
  })

  it('offers only the course after the last lesson', () => {
    render(null)
    expect(host.querySelector('[data-done-next]')).toBeNull()
    expect(host.querySelector('[data-next-lesson-card]')).toBeNull()
    expect(host.textContent).toContain('dashboard.classViewer.lessonMode.done.courseDone')
  })
})
