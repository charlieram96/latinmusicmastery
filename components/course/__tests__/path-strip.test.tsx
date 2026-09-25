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

const pointer = (el: Element | Document['body'], type: string, pointerType: string) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'pointerType', { value: pointerType })
  act(() => { el.dispatchEvent(ev) })
}
const click = (el: Element) => {
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
  let prevented = false
  // Read the result after React's handler, then stop jsdom's unimplemented navigation.
  const after = (e: Event) => { prevented = e.defaultPrevented; e.preventDefault() }
  document.addEventListener('click', after)
  act(() => { el.dispatchEvent(ev) })
  document.removeEventListener('click', after)
  return prevented
}

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

  it('centres the bubble without relying on the bob animation (reduced motion)', () => {
    render()
    const bubble = host.querySelector('[data-path-bubble]') as HTMLElement
    expect(bubble.className.split(/\s+/)).toContain('-translate-x-1/2')
  })

  it('leaves room inside the scroller for the bubble above every node and the labels at the sides', () => {
    render([...ITEMS, lesson('d', 4, 'upcoming'), lesson('e', 5, 'upcoming'), lesson('f', 6, 'upcoming')])
    const nodes = host.querySelectorAll<HTMLElement>('[data-path-node]')
    expect(nodes).toHaveLength(7) // six lessons + the checkpoint
    for (const node of nodes) {
      // the bubble reaches 34px + ~52px tall + 6px of bob above the node centre
      expect(parseFloat(node.style.top)).toBeGreaterThanOrEqual(96)
      // half a 110px label must fit left of the first node
      expect(parseFloat(node.style.left)).toBeGreaterThanOrEqual(58)
    }
  })

  it('renders the lesson card outside the scroller, only while a node is hovered', () => {
    render()
    expect(host.querySelectorAll('[role="tooltip"]')).toHaveLength(0)
    const node = host.querySelectorAll<HTMLElement>('[data-path-node]')[1]
    act(() => { node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    const tip = host.querySelector('[role="tooltip"]') as HTMLElement
    expect(tip).not.toBeNull()
    expect(tip.closest('[data-path-scroller]')).toBeNull()
    expect(tip.textContent).toContain('Lesson b')
    act(() => { node.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
    expect(host.querySelectorAll('[role="tooltip"]')).toHaveLength(0)
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

  it('wave y positions are whole pixels and the svg matches the track height (compact)', () => {
    act(() => root.render(<PathStrip items={ITEMS} ariaLabel="p" size="compact" />))
    for (const n of host.querySelectorAll<HTMLElement>('[data-path-node]')) expect(Number.isInteger(parseFloat(n.style.top))).toBe(true)
    const track = host.querySelector('[data-path-scroller] > div') as HTMLElement
    expect(host.querySelector('svg')?.getAttribute('height')).toBe(String(parseFloat(track.style.height)))
  })

  it('re-scrolls when the items change identity with the same length and current index', () => {
    const sets: number[] = []
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', { configurable: true, get: () => 0, set: (v: number) => { sets.push(v) } })
    try {
      render()
      render(ITEMS.map((i) => ({ ...i, id: `x-${i.id}` })) as PathItem[])
      expect(sets).toHaveLength(2)
    } finally {
      delete (HTMLElement.prototype as { scrollLeft?: number }).scrollLeft
    }
  })

  it('first tap on a touch device shows the card with a Go link instead of navigating', () => {
    render()
    const link = host.querySelector('[data-path-scroller] a[href="/l/c"]')!
    pointer(link, 'pointerdown', 'touch')
    expect(click(link)).toBe(true)
    const tip = host.querySelector('[role="tooltip"]') as HTMLElement
    expect(tip.textContent).toContain('Lesson c')
    expect(tip.querySelector('a[href="/l/c"]')?.textContent).toContain('dashboard.pages.course.path.goToLesson')
    pointer(link, 'pointerdown', 'touch')
    expect(click(link)).toBe(false) // the second tap on the same node navigates
  })

  it('mouse click navigates at once', () => {
    render()
    const link = host.querySelector('a[href="/l/c"]')!
    pointer(link, 'pointerdown', 'mouse')
    expect(click(link)).toBe(false)
  })

  it('a tapped card closes on a tap outside the strip, and on Escape', () => {
    render()
    const link = host.querySelector('a[href="/l/c"]')!
    pointer(link, 'pointerdown', 'touch'); click(link)
    pointer(document.body, 'pointerdown', 'touch')
    expect(host.querySelector('[role="tooltip"]')).toBeNull()
    pointer(link, 'pointerdown', 'touch'); click(link)
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(host.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('touch compatibility mouse events do not open the hover card', () => {
    render()
    const node = host.querySelectorAll<HTMLElement>('[data-path-node]')[2]
    pointer(node.querySelector('a')!, 'pointerdown', 'touch')
    act(() => { node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(host.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('module flags mark where each module starts and link to its overview', () => {
    const two: PathItem[] = [
      lesson('a', 1, 'done'),
      { kind: 'checkpoint', id: 'cp0', moduleIndex: 0, moduleTitle: 'Welcome', state: 'done', href: '/m/0' },
      { ...lesson('b', 2, 'current'), moduleIndex: 1 } as PathItem,
      { kind: 'checkpoint', id: 'cp1', moduleIndex: 1, moduleTitle: 'Rhythm', state: 'upcoming', href: '/m/1' },
    ]
    act(() => root.render(<PathStrip items={two} ariaLabel="p" showModuleFlags />))
    const flags = [...host.querySelectorAll('[data-path-flag]')]
    expect(flags.map((f) => f.textContent)).toEqual(['dashboard.pages.course.path.module(1)Welcome', 'dashboard.pages.course.path.module(2)Rhythm'])
    expect(flags[1].getAttribute('href')).toBe('/m/1')
    // the flag row sits above the bubble's highest reach
    for (const n of host.querySelectorAll<HTMLElement>('[data-path-node]')) expect(parseFloat(n.style.top)).toBeGreaterThanOrEqual(122)
  })

  it('no flags unless asked', () => {
    render()
    expect(host.querySelector('[data-path-flag]')).toBeNull()
  })

  it('arrowsClassName places the arrow pair (e.g. up in a heading row)', () => {
    act(() => root.render(<PathStrip items={ITEMS} ariaLabel="p" showArrows arrowsClassName="bottom-full top-auto" />))
    const pair = host.querySelector('button[aria-label="dashboard.pages.course.path.next"]')!.parentElement!
    expect(pair.className.split(/\s+/)).toEqual(expect.arrayContaining(['bottom-full', 'top-auto', 'right-0']))
    expect(pair.className.split(/\s+/)).not.toContain('top-0')
  })
})
