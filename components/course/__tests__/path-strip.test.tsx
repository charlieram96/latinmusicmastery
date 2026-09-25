// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathItem } from '@/lib/courses/path-nodes'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${Object.values(params).join(',')})` : key,
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

import { PathStrip } from '../path-strip'

const lesson = (id: string, number: number, state: 'done' | 'current' | 'upcoming'): PathItem =>
  ({ kind: 'lesson', id, number, moduleIndex: 0, title: `Lesson ${id}`, state, types: ['video'], minutes: 12, href: `/l/${id}` })
const ITEMS: PathItem[] = [
  lesson('a', 1, 'done'), lesson('b', 2, 'current'), lesson('c', 3, 'upcoming'),
  { kind: 'gap', id: 'g', count: 4 },
  { kind: 'checkpoint', id: 'cp', moduleIndex: 0, moduleTitle: 'Welcome', state: 'upcoming', href: '/m/1' },
]

let root: Root
let host: HTMLDivElement
const scrollBy = vi.fn()

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Element.prototype.scrollBy = scrollBy as unknown as Element['scrollBy']
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); scrollBy.mockReset() })

const render = (items = ITEMS) => act(() => root.render(<PathStrip items={items} ariaLabel="Your path" showArrows />))

describe('PathStrip', () => {
  it('renders one link per lesson and checkpoint, marking the current step', () => {
    render()
    const links = [...host.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/l/a', '/l/b', '/l/c', '/m/1'])
    expect(host.querySelector('[aria-current="step"]')?.getAttribute('href')).toBe('/l/b')
  })

  it('shows the continue bubble with minutes on the current node only', () => {
    render()
    const bubbles = host.querySelectorAll('[data-path-bubble]')
    expect(bubbles).toHaveLength(1)
    expect(bubbles[0].textContent).toContain('dashboard.pages.course.path.continue')
    expect(bubbles[0].textContent).toContain('dashboard.pages.course.path.minutes(12)')
  })

  it('renders the gap count', () => {
    render()
    expect(host.textContent).toContain('dashboard.pages.course.path.more(4)')
  })

  it('arrow buttons scroll the track', () => {
    render()
    const next = host.querySelector('button[aria-label="dashboard.pages.course.path.next"]') as HTMLButtonElement
    act(() => next.click())
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
  })

  it('looping animations are motion-safe', () => {
    render()
    const animated = [...host.querySelectorAll('[class*="animate-"]')]
    expect(animated.length).toBeGreaterThan(0)
    for (const el of animated) {
      for (const c of el.className.split(/\s+/).filter((x) => x.includes('animate-'))) expect(c.startsWith('motion-safe:')).toBe(true)
    }
  })

  it('scrolls to the end when nothing is current', () => {
    const done = ITEMS.map((i) => (i.kind === 'lesson' ? { ...i, state: 'done' as const } : i))
    render(done)
    const scroller = host.querySelector('[data-path-scroller]') as HTMLDivElement
    expect(scroller.dataset.anchor).toBe('end')
  })
})
