// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecContext } from '@/lib/dashboard/recommendations'
import type { RecommendedCourse } from '@/types/dashboard'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}(${Object.values(params).join(',')})` : key),
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: (props: { src: string }) => <img data-cover src={props.src} alt="" /> }))

import { RecommendedSection } from '../recommended-section'

const rec = (id: string, over: Partial<RecommendedCourse> = {}): RecommendedCourse => ({
  id,
  slug: id,
  title: `Course ${id}`,
  thumbnailUrl: null,
  styleName: 'Timba',
  instrument: 'Timbal',
  teacherId: 't1',
  teacherName: 'Leo Garcia',
  createdAt: null,
  difficulty: 'beginner',
  lessonCount: 9,
  reason: { kind: 'instrument', instrument: 'Timbal' },
  isNew: false,
  href: `/dashboard/course/${id}`,
  ...over,
})
const COURSES = [rec('a'), rec('b', { instrument: 'Conga', lessonCount: 1, thumbnailUrl: 'https://x/y.jpg' }), rec('c'), rec('d'), rec('e')]
const CTX: RecContext = { instruments: ['Timbal'], teacherIds: [], enrolledTitlesByTeacherId: {}, now: '2026-09-25T00:00:00Z' }

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (courses = COURSES) => act(() => root.render(<RecommendedSection courses={courses} ctx={CTX} />))
const posters = () => [...host.querySelectorAll('[data-poster]')] as HTMLAnchorElement[]
const tokens = (el: Element) => el.className.split(/\s+/)

describe('RecommendedSection posters', () => {
  it('renders up to four 4:5 poster links', () => {
    render()
    expect(posters()).toHaveLength(4)
    expect(posters().map((p) => p.getAttribute('href'))).toEqual(['/dashboard/course/a', '/dashboard/course/b', '/dashboard/course/c', '/dashboard/course/d'])
    for (const p of posters()) expect(tokens(p)).toContain('aspect-[4/5]')
  })

  it('shows reason, title, teacher initials, instrument and lesson count', () => {
    render()
    const [a, b] = posters()
    expect(a.textContent).toContain('dashboard.pages.home.recommended.why.instrument(Timbal)')
    expect(a.textContent).toContain('Course a')
    expect(a.querySelector('[data-initials]')?.textContent).toBe('LG')
    expect(a.textContent).toContain('Timbal')
    expect(a.textContent).toContain('dashboard.pages.home.recommended.lessons(9)')
    expect(b.textContent).toContain('dashboard.pages.home.recommended.lessonsOne(1)')
    expect(b.querySelector('img[data-cover]')).not.toBeNull()
    expect(a.querySelector('[data-style-word]')?.textContent).toBe('Timba')
  })

  it('has a chunky Preview inside the link and no nested interactive element', () => {
    render()
    const p = posters()[0]
    const preview = p.querySelector('[data-preview]')!
    expect(preview.tagName).toBe('SPAN')
    expect(preview.className).toContain('shadow-[0_4px_0_hsl(var(--primary-deep))]')
    expect(preview.textContent).toBe('dashboard.pages.home.recommended.previewCta')
    expect(p.querySelectorAll('a, button')).toHaveLength(0)
  })

  it('is a snap carousel at 62% width below md and a minmax(190px) grid from md', () => {
    render()
    const list = host.querySelector('[data-posters]')!
    expect(tokens(list)).toEqual(expect.arrayContaining(['flex', 'snap-x', 'snap-mandatory', 'overflow-x-auto', 'md:grid', 'md:grid-cols-[repeat(auto-fill,minmax(max(190px,calc((100%-42px)/4)),1fr))]']))
    for (const p of posters()) expect(tokens(p)).toEqual(expect.arrayContaining(['w-[62%]', 'shrink-0', 'snap-start', 'md:w-auto']))
  })

  it('keeps Preview visible on phones and reveals it on hover from md', () => {
    render()
    const reveal = posters()[0].querySelector('[data-preview-reveal]')!
    expect(tokens(reveal)).toEqual(expect.arrayContaining(['grid-rows-[1fr]', 'md:grid-rows-[0fr]', 'md:opacity-0', 'md:group-hover:grid-rows-[1fr]', 'md:group-hover:opacity-100', 'md:group-focus-visible:grid-rows-[1fr]']))
  })

  it('gates the hover lift and art zoom behind motion-safe', () => {
    render()
    const p = posters()[0]
    expect(tokens(p)).toContain('motion-safe:hover:-translate-y-1')
    expect(tokens(p.querySelector('[data-art]')!)).toContain('motion-safe:group-hover:scale-[1.06]')
  })

  it('still filters', () => {
    render([rec('a'), rec('b', { instrument: 'Conga' })])
    const btns = [...host.querySelectorAll('button')]
    act(() => btns.find((b) => b.textContent?.includes('forInstrument'))!.click())
    expect(posters().map((p) => p.getAttribute('href'))).toEqual(['/dashboard/course/a'])
  })
})
