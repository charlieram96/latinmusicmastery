// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}(${Object.values(params).join(',')})` : key,
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
vi.mock('@/app/actions/billing', () => ({ addCourseToSubscription: vi.fn() }))
vi.mock('@/components/dashboard/header-title-override', () => ({ HeaderTitleOverride: () => null }))
vi.mock('@/components/dashboard/enter-course-mode-button', () => ({
  EnterCourseModeButton: ({ children, variant, href, ...rest }: { children: React.ReactNode; variant?: string; href?: string; 'aria-label'?: string }) => (
    <button type="button" data-enter data-variant={variant} data-href={href} aria-label={rest['aria-label']}>{children}</button>
  ),
}))

import { CourseDetailView } from '../course-detail-view'

type Cls = { id: string; title: string; is_free: boolean; items: { id: string; item_type: string; video_duration_seconds: number | null }[]; totalItems: number; completedItems: number }
const cls = (id: string, done: number, total = 2): Cls => ({
  id,
  title: `Lesson ${id}`,
  is_free: false,
  items: Array.from({ length: total }, (_, k) => ({ id: `${id}${k}`, item_type: k === 0 ? 'VIDEO' : 'QUIZ', video_duration_seconds: k === 0 ? 300 : null })),
  totalItems: total,
  completedItems: done,
})
const SECTIONS = [
  { id: 's1', title: 'Welcome', description: null, classes: [cls('a', 2)] },
  { id: 's2', title: 'Rhythm', description: 'The clave.', classes: [cls('b', 2), cls('c', 2), cls('d', 2), cls('e', 1), cls('f', 0), cls('g', 0)] },
  { id: 's3', title: 'Later', description: null, classes: [] },
]

const PROPS = {
  course: { id: 'cid', title: 'Son Cubano Timbal', description: 'Develop your timbal technique.', thumbnail_url: null, preview_video_url: null, instrument: 'Timbal', difficulty: null, is_fundamentals: false },
  courseId: 'son',
  style: { name: 'Son Cubano' },
  country: { name: 'Cuba' },
  teacher: { id: 't', name: 'Patricio Diaz', instrument: 'Timbal', image_url: null, bio: null },
  difficultyKey: 'beginner' as const,
  difficultyColor: 'text-success',
  totalItems: 14,
  completedItems: 11,
  totalDurationMinutes: 35,
  remainingDuration: 10,
  progressPercentage: 79,
  nextClassId: 'e' as string | null,
  sections: SECTIONS,
  hasStarted: true,
  isStudent: true,
  locked: false,
  canAddToPlan: false,
  addonPriceCents: 499,
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

const render = (over: Partial<typeof PROPS> = {}) => act(() => root.render(<CourseDetailView {...PROPS} {...over} />))
const moduleSection = (id: string) => host.querySelector(`section[aria-labelledby="module-${id}"]`) as HTMLElement
const P = 'dashboard.pages.course'

describe('CourseDetailView (C3)', () => {
  it('renders Your path with the done count and the full-course strip', () => {
    render()
    const path = host.querySelector('section[aria-labelledby="your-path"]') as HTMLElement
    expect(path.textContent).toContain(`${P}.path.heading`)
    expect(path.textContent).toContain(`${P}.path.doneOf(4,7)`)
    // 7 lessons + a checkpoint for each non-empty module
    expect(path.querySelectorAll('[data-path-node] a')).toHaveLength(9)
    expect(path.querySelectorAll('[data-path-flag]')).toHaveLength(2)
    // laid on the page: no card around it
    expect(path.className).not.toMatch(/\b(border|bg-card|shadow)/)
  })

  it('current module shows current ±2 lessons and a Show all toggle', () => {
    render()
    const s2 = moduleSection('s2')
    expect([...s2.querySelectorAll('li')].map((li) => li.textContent?.match(/Lesson (\w)/)?.[1])).toEqual(['c', 'd', 'e', 'f', 'g'])
    const toggle = [...s2.querySelectorAll('button')].find((b) => b.textContent?.includes(`${P}.syllabus.showAll(6)`)) as HTMLButtonElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    act(() => toggle.click())
    expect(s2.querySelectorAll('li')).toHaveLength(6)
    expect(toggle.textContent).toContain(`${P}.syllabus.showFewer`)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('other modules are collapsed with progress segments and a title link to the overview', () => {
    render()
    const s1 = moduleSection('s1')
    expect(s1.querySelectorAll('li')).toHaveLength(0)
    expect(s1.querySelectorAll('[data-segment]')).toHaveLength(1)
    expect(s1.querySelector('[data-segment]')?.getAttribute('data-segment')).toBe('done')
    expect(s1.querySelector('h2 a')?.getAttribute('href')).toBe('/dashboard/course/son/module/s1')
    // a collapsed one-lesson module still expands, with the singular label
    const toggle = s1.querySelector('button') as HTMLButtonElement
    expect(toggle.textContent).toContain(`${P}.syllabus.showAllOne(1)`)
    act(() => toggle.click())
    expect(s1.querySelectorAll('li')).toHaveLength(1)
  })

  it('an empty module shows no rows, segments or toggle', () => {
    render()
    const s3 = moduleSection('s3')
    expect(s3.querySelectorAll('li, [data-segment], button')).toHaveLength(0)
  })

  it('primary CTAs are chunky and the phone bar says Go', () => {
    render()
    const enters = [...host.querySelectorAll<HTMLElement>('[data-enter]')]
    expect(enters.length).toBeGreaterThanOrEqual(3) // header, summary card, phone bar
    for (const b of enters) expect(b.dataset.variant).toBe('chunky')
    // WCAG 2.5.3: the accessible name starts with the visible "Go" (no overriding aria-label)
    const go = enters.find((b) => b.textContent?.startsWith(`${P}.syllabus.go`)) as HTMLElement
    expect(go.getAttribute('aria-label')).toBeNull()
    expect(go.querySelector('.sr-only')?.textContent).toContain(`${P}.continueLesson`)
  })

  it('finished course: every module collapsed, heading still counts', () => {
    const done = SECTIONS.map((s) => ({ ...s, classes: s.classes.map((c) => ({ ...c, completedItems: c.totalItems })) }))
    render({ sections: done, nextClassId: null, progressPercentage: 100 })
    expect(host.querySelector('section[aria-labelledby="your-path"]')?.textContent).toContain(`${P}.path.doneOf(7,7)`)
    for (const id of ['s1', 's2', 's3']) expect(moduleSection(id).querySelectorAll('li')).toHaveLength(0)
  })

  it('locked shows the subscribe action in the phone bar instead of Go', () => {
    render({ locked: true, isStudent: false })
    expect(host.querySelector('[data-enter]')).toBeNull()
    expect(host.textContent).not.toContain(`${P}.syllabus.go`)
    const subscribe = [...host.querySelectorAll('a')].filter((a) => a.getAttribute('href')?.startsWith('/dashboard/subscribe?instrument=Timbal&course=cid'))
    expect(subscribe.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps every section that ships today', () => {
    render()
    for (const k of ['backToCourses', 'whatYoullMaster.heading', 'requirements.heading', 'yourInstructor', 'syllabus.inYourPlan', 'included.sheetMusic', 'stats.modules', 'syllabus.lessonOf(5,7)']) {
      expect(host.textContent).toContain(`${P}.${k}`)
    }
    expect(host.textContent).toContain('dashboard.pages.teachers.viewProfile')
    expect(host.textContent).toContain('Develop your timbal technique.')
  })

  describe('polish minors', () => {
    const allDone = (sections = SECTIONS) => sections.map((s) => ({ ...s, classes: s.classes.map((c) => ({ ...c, completedItems: c.totalItems })) }))

    it('C1: a finished course offers Review course into lesson 1 instead of a disabled Coming soon', () => {
      render({ sections: allDone(), nextClassId: null, completedItems: 14, progressPercentage: 100 })
      expect(host.textContent).not.toContain(`${P}.comingSoon`)
      const reviews = [...host.querySelectorAll<HTMLElement>('[data-enter]')].filter((b) => b.textContent?.includes(`${P}.reviewCourse`))
      expect(reviews.length).toBeGreaterThanOrEqual(3) // header, summary card, phone bar
      for (const b of reviews) expect(b.dataset.href).toBe('/dashboard/course/son/class/a')
      expect(host.textContent).toContain(`${P}.syllabus.completed`)
    })

    it('C1/C2: empty lessons do not stop a course from being finished (path, CTA and progress line agree)', () => {
      const withEmpty = allDone([
        { id: 's1', title: 'Welcome', description: null, classes: [cls('a', 2), cls('x', 0, 0)] },
        { id: 's2', title: 'Rhythm', description: null, classes: [cls('b', 2)] },
      ])
      render({ sections: withEmpty, nextClassId: null, totalItems: 4, completedItems: 4, progressPercentage: 100 })
      const path = host.querySelector('section[aria-labelledby="your-path"]') as HTMLElement
      expect(path.querySelector('[aria-current="step"]')).toBeNull()
      expect(host.textContent).toContain(`${P}.reviewCourse`)
      expect(host.textContent).not.toContain(`${P}.syllabus.notStarted(`)
      expect(host.querySelector('[data-bar-title]')?.textContent).toBe(`${P}.syllabus.completed`)
    })

    it('C2: the path current lesson is the syllabus current lesson, past an empty lesson', () => {
      const secs = [{ id: 's1', title: 'Welcome', description: null, classes: [cls('a', 2), cls('x', 0, 0), cls('b', 0)] }]
      render({ sections: secs, nextClassId: 'b', totalItems: 4, completedItems: 2 })
      const path = host.querySelector('section[aria-labelledby="your-path"]') as HTMLElement
      expect(path.querySelector('[aria-current="step"]')?.getAttribute('href')).toBe('/dashboard/course/son/class/b')
      const currentRow = [...moduleSection('s1').querySelectorAll('li a')].find((a) => a.className.includes('border-primary'))
      expect(currentRow?.getAttribute('href')).toBe('/dashboard/course/son/class/b')
    })

    it('C3: path nodes follow the syllabus href rule for non-students', () => {
      const secs = [{ id: 's1', title: 'Welcome', description: null, classes: [{ ...cls('a', 0), is_free: true }, cls('b', 0)] }]
      render({ sections: secs, nextClassId: 'a', isStudent: false, locked: false, totalItems: 4, completedItems: 0, hasStarted: false })
      const nodes = [...host.querySelectorAll('section[aria-labelledby="your-path"] [data-path-scroller] [data-path-node] a')].map((a) => a.getAttribute('href'))
      expect(nodes[0]).toBe('/dashboard/course/son/class/a')
      expect(nodes[1]).toBe('/dashboard/subscribe?instrument=Timbal&course=cid')
      const rows = [...moduleSection('s1').querySelectorAll('li a')].map((a) => a.getAttribute('href'))
      expect(rows).toEqual(nodes.slice(0, 2))
    })

    it('C4: the locked phone bar stacks its wide action on its own row', () => {
      render({ locked: true, isStudent: false })
      expect(host.querySelector('[data-mobile-bar]')?.getAttribute('data-stacked')).toBe('true')
      render()
      expect(host.querySelector('[data-mobile-bar]')?.getAttribute('data-stacked')).toBe('false')
    })

    it('C7: Show all controls the module lesson list, even while it is empty', () => {
      render()
      for (const id of ['s1', 's2']) {
        const toggle = moduleSection(id).querySelector('button') as HTMLButtonElement
        const listId = toggle.getAttribute('aria-controls')
        expect(listId).toBeTruthy()
        const list = document.getElementById(listId!)
        expect(list?.tagName).toBe('OL')
        expect(moduleSection(id).contains(list)).toBe(true)
      }
    })
  
    it('C2: a module whose only lessons with items are done reads Completed, like its path checkpoint', () => {
      const secs = [
        { id: 's1', title: 'Welcome', description: null, classes: [cls('a', 2), cls('x', 0, 0), cls('y', 0, 0)] },
        { id: 's2', title: 'Rhythm', description: null, classes: [cls('b', 0)] },
      ]
      render({ sections: secs, nextClassId: 'b', totalItems: 4, completedItems: 2 })
      expect(moduleSection('s1').textContent).toContain(`${P}.syllabus.completed`)
      const cp = host.querySelector('section[aria-labelledby="your-path"] a[href="/dashboard/course/son/module/s1"]')
      expect(cp).not.toBeNull()
    })
  
    it('C2: the path done count leaves out lessons with no items yet, so a finished course reads N of N', () => {
      const secs = [{ id: 's1', title: 'Welcome', description: null, classes: [cls('a', 2), cls('x', 0, 0), cls('b', 2)] }]
      render({ sections: secs, nextClassId: null, totalItems: 4, completedItems: 4, progressPercentage: 100 })
      expect(host.querySelector('section[aria-labelledby="your-path"]')?.textContent).toContain(`${P}.path.doneOf(2,2)`)
    })
  
    it('review: a course whose lessons are all still empty shows no "0 of 0 done" count', () => {
      const secs = [{ id: 's1', title: 'Welcome', description: null, classes: [cls('x', 0, 0), cls('y', 0, 0)] }]
      render({ sections: secs, nextClassId: null, totalItems: 0, completedItems: 0, progressPercentage: 0, hasStarted: false })
      const path = host.querySelector('section[aria-labelledby="your-path"]') as HTMLElement
      expect(path.textContent).not.toContain(`${P}.path.doneOf`)
    })
  })
})
