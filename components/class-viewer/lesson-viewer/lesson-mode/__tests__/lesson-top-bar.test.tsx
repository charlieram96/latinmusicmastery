// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))
vi.mock('next/link', () => ({ useLinkStatus: () => ({ pending: false }), default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))

import { LessonTopBar } from '../lesson-top-bar'

const parts = [
  { id: 'a', title: 'Demo', item_type: 'VIDEO' },
  { id: 'b', title: 'Play it', item_type: 'EXERCISE' },
  { id: 'c', title: 'Check', item_type: 'QUIZ' },
]
const props = {
  courseTitle: 'Timba Piano', courseHref: '/dashboard/course/c', moduleTitle: 'Montuno foundations', moduleHref: '/dashboard/course/c/module/m',
  title: 'Montuno in C', parts, activeIndex: 1, completedItemIds: ['a'], courseId: 'c', classId: 'k', streak: 4,
}

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const tabs = () => [...host.querySelectorAll('nav.lx-parts a')] as HTMLAnchorElement[]

describe('LessonTopBar', () => {
  it('shows the crumb and the lesson title', () => {
    act(() => root.render(<LessonTopBar {...props} onOpenDrawer={() => {}} />))
    const links = [...host.querySelectorAll('nav[aria-label="dashboard.classViewer.lessonMode.crumbLabel"] a')].map(a => a.getAttribute('href'))
    expect(links).toEqual(['/dashboard/course/c', '/dashboard/course/c/module/m'])
    expect(host.querySelector('h1')?.textContent).toBe('Montuno in C')
  })

  it('shows each part with its state and progress underline', () => {
    act(() => root.render(<LessonTopBar {...props} activeStatus="in-progress" onOpenDrawer={() => {}} />))
    expect(tabs().map(t => t.getAttribute('data-part-state'))).toEqual(['done', 'active', 'todo'])
    // Parts are links in a nav, the current one marked as the current step (L4).
    expect(host.querySelector('[role=tablist], [role=tab]')).toBeNull()
    expect(tabs().map(t => t.getAttribute('aria-current'))).toEqual([null, 'step', null])
    expect(tabs()[0].getAttribute('href')).toBe('/dashboard/course/c/class/k?item=0')
    const widths = tabs().map(t => (t.querySelector('[data-part-progress] i') as HTMLElement).style.width)
    expect(widths).toEqual(['100%', '50%', '0%'])
  })

  it('one part renders', () => {
    act(() => root.render(<LessonTopBar {...props} parts={[parts[0]]} activeIndex={0} completedItemIds={[]} onOpenDrawer={() => {}} />))
    expect(tabs()).toHaveLength(1)
  })

  it('opens the drawer, shows the streak and closes to the course', () => {
    const open = vi.fn()
    act(() => root.render(<LessonTopBar {...props} onOpenDrawer={open} />))
    act(() => (host.querySelector('[data-open-drawer]') as HTMLButtonElement).click())
    expect(open).toHaveBeenCalledOnce()
    expect(host.querySelector('[data-streak]')?.textContent).toContain('4')
    expect(host.querySelector('[data-close-lesson]')?.getAttribute('href')).toBe('/dashboard/course/c')
  })
})
