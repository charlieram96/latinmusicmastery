// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PathItem } from '@/lib/courses/path-nodes'
import type { YourPath } from '@/lib/dashboard/your-path'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}(${Object.values(params).join(',')})` : key),
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('@/components/course/path-strip', () => ({
  PathStrip: ({ items, size, className, ariaLabel }: { items: PathItem[]; size: string; className?: string; ariaLabel: string }) => (
    <div data-strip={size} data-label={ariaLabel} className={className}>{items.map((i) => i.id).join(',')}</div>
  ),
}))

import { YourPathCard } from '../your-path-card'

const lesson = (id: string, state: 'done' | 'current' | 'upcoming'): PathItem =>
  ({ kind: 'lesson', id, number: 1, moduleIndex: 2, title: id, state, types: ['video'], minutes: 8, href: `/l/${id}` })
const PATH: YourPath = {
  courseHref: '/dashboard/course/son',
  moduleNumber: 3,
  moduleTitle: 'Groove',
  items: [lesson('a', 'done'), lesson('b', 'current'), lesson('c', 'upcoming')],
  phoneItems: [lesson('b', 'current'), lesson('c', 'upcoming')],
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

const render = (path: YourPath | null) => act(() => root.render(<YourPathCard path={path} />))

describe('YourPathCard', () => {
  it('renders nothing without a path', () => {
    render(null)
    expect(host.innerHTML).toBe('')
  })

  it('has the "Your path · Module N · title" header and a course map link', () => {
    render(PATH)
    const h2 = host.querySelector('h2')!
    expect(h2.textContent).toBe('dashboard.pages.home.path.title')
    expect(host.querySelector('section')?.getAttribute('aria-labelledby')).toBe(h2.id)
    expect(host.textContent).toContain('dashboard.pages.home.path.module(3,Groove)')
    const link = host.querySelector('a')!
    expect(link.getAttribute('href')).toBe('/dashboard/course/son')
    expect(link.textContent).toContain('dashboard.pages.home.path.courseMap')
  })

  it('shows the desktop slice from md and the 5-node phone slice below it, both compact', () => {
    render(PATH)
    const strips = [...host.querySelectorAll('[data-strip]')]
    expect(strips.map((s) => s.getAttribute('data-strip'))).toEqual(['compact', 'compact'])
    const desktop = strips.find((s) => s.className.includes('md:block'))!
    const phone = strips.find((s) => s.className.includes('md:hidden'))!
    expect(desktop.className.split(' ')).toContain('hidden')
    expect(desktop.textContent).toBe('a,b,c')
    expect(phone.textContent).toBe('b,c')
  })

  it('keeps the header above the strip so its link stays clickable', () => {
    render(PATH)
    const header = host.querySelector('h2')!.parentElement!
    expect(header.className).toContain('relative')
    expect(header.className).toContain('z-10')
  })

  it('D1: the module line also shows on phones, on its own line', () => {
    render(PATH)
    const line = host.querySelector('[data-path-module]') as HTMLElement
    const cls = line.className.split(/\s+/)
    expect(cls).not.toContain('hidden')
    expect(cls).toEqual(expect.arrayContaining(['basis-full', 'sm:basis-auto']))
  })

  it('D2: an untitled module shows "Module N" with no trailing separator', () => {
    render({ ...PATH, moduleTitle: '' })
    const line = host.querySelector('[data-path-module]') as HTMLElement
    expect(line.textContent).toContain('dashboard.pages.home.path.moduleOnly(3)')
    expect(line.textContent).not.toContain('path.module(')
  })
})
