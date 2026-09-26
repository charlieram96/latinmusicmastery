// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPracticeCalendar } from '@/lib/dashboard/practice-calendar'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      key === 'dashboard.pages.home.dayLetters' ? 'S,M,T,W,T,F,S' : params ? `${key}(${Object.values(params).join(',')})` : key,
  }),
}))
vi.mock('../streak-card.module.css', () => ({ default: { flicker: 'flicker-module-class' } }))

import { StreakCard, heatAxis } from '../streak-card'

// 2026-09-25 is a Friday.
const FRIDAY = '2026-09-25'
const { cells } = buildPracticeCalendar(['2026-09-24', '2026-09-24', '2026-09-23'], FRIDAY, 5)

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (props: Partial<React.ComponentProps<typeof StreakCard>> = {}) =>
  act(() => root.render(<StreakCard cells={cells} weekDone={3} weekGoal={6} streak={12} bestStreak={21} {...props} />))

describe('StreakCard', () => {
  it('shows the streak in days and the best streak', () => {
    render()
    expect(host.textContent).toContain('dashboard.pages.home.streak.days(12)')
    expect(host.textContent).toContain('dashboard.pages.home.streak.best(21)')
    render({ streak: 1, bestStreak: 1 })
    expect(host.textContent).toContain('dashboard.pages.home.streak.daysOne(1)')
    expect(host.textContent).toContain('dashboard.pages.home.streak.bestOne(1)')
  })

  it('caps the goal segments at the goal and says Reached once it is met', () => {
    const segs = () => [...host.querySelectorAll('[data-goal-seg]')].map((s) => s.getAttribute('data-goal-seg'))
    render()
    expect(segs()).toEqual(['done', 'done', 'done', 'todo', 'todo', 'todo'])
    expect(host.textContent).toContain('dashboard.pages.home.streak.goalProgress(3,6)')
    expect(host.textContent).toContain('dashboard.pages.home.streak.toGo(3)')
    render({ weekDone: 9 })
    expect(segs()).toEqual(Array(6).fill('done'))
    expect(host.textContent).toContain('dashboard.pages.home.streak.reached')
    render({ weekDone: 0 })
    expect(segs()).toEqual(Array(6).fill('todo'))
  })

  it('draws the 5-week heatmap with day letters and today outlined', () => {
    render()
    const heat = host.querySelector('[role="img"]')!
    expect(heat.getAttribute('aria-label')).toBe('dashboard.pages.home.streak.heatLabel')
    const cellsEl = heat.querySelectorAll('[data-cell]')
    expect(cellsEl).toHaveLength(35)
    expect(host.querySelectorAll('[data-day-letter]')).toHaveLength(7)
    const today = heat.querySelector('[data-today]')!
    expect(today.getAttribute('data-cell')).toBe(FRIDAY)
    expect(today.className).toContain('outline-primary')
    expect(heat.querySelector('[data-cell="2026-09-24"]')!.getAttribute('title')).toBe('dashboard.pages.home.streak.cell(2026-09-24,2)')
  })

  it('puts Today under today\'s column and shows "5 weeks ago" only when there is room', () => {
    render()
    const axisToday = host.querySelector('[data-axis-today]') as HTMLElement
    expect(axisToday.style.gridColumnStart).toBe('6')
    expect(host.querySelector('[data-axis-start]')).not.toBeNull()
    expect(heatAxis(cells)).toEqual({ todayColumn: 6, showStart: true })
    const monday = buildPracticeCalendar([], '2026-09-21', 5).cells
    expect(heatAxis(monday)).toEqual({ todayColumn: 2, showStart: false })
    const sunday = buildPracticeCalendar([], '2026-09-20', 5).cells
    expect(heatAxis(sunday)).toEqual({ todayColumn: 1, showStart: false })
    const tuesday = buildPracticeCalendar([], '2026-09-22', 5).cells
    expect(heatAxis(tuesday)).toEqual({ todayColumn: 3, showStart: true })
  })

  it('animates the flame only while the streak is live, through the motion-gated module class', () => {
    render()
    const flame = host.querySelector('[data-flame] svg')!
    expect(flame.getAttribute('class')).toContain('flicker-module-class')
    expect(flame.getAttribute('style') ?? '').not.toContain('animation')
    render({ streak: 0 })
    expect(host.querySelector('[data-flame] svg')!.getAttribute('class')).not.toContain('flicker-module-class')
  })

  it('D6: over the goal it caps the count and shows the extra lessons', () => {
    render({ weekDone: 9, weekGoal: 6 })
    expect(host.textContent).toContain('dashboard.pages.home.streak.goalExceeded(6,3)')
    expect(host.textContent).not.toContain('goalProgress(9,6)')
    expect(host.textContent).toContain('dashboard.pages.home.streak.reached')
    render({ weekDone: 6, weekGoal: 6 })
    expect(host.textContent).toContain('dashboard.pages.home.streak.goalProgress(6,6)')
  })
})
