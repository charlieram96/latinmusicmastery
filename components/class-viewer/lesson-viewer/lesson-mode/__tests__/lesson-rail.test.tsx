// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', locales: ['en', 'es'], setLocale: vi.fn(), t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))
vi.mock('next/image', () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <button data-theme-toggle /> }))
vi.mock('@/components/language-toggle', () => ({ LanguageToggle: () => <button data-language-toggle /> }))

import { LessonRail } from '../lesson-rail'
import type { RailLesson } from '@/lib/courses/lesson-rail'

const lessons: RailLesson[] = [
  { id: 'a', title: 'Clave', href: '/l/a', state: 'done', paywalled: false, kind: 'video', minutes: 8, number: 1 },
  { id: 'b', title: 'Montuno in C', href: '/l/b', state: 'current', paywalled: false, kind: 'play', minutes: null, number: 2 },
  { id: 'c', title: 'Montuno in F', href: '/l/c', state: 'upcoming', paywalled: true, kind: 'quiz', minutes: 12, number: 3 },
]

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = () => act(() => root.render(
  <LessonRail courseHref="/dashboard/course/c" courseTitle="Timba Piano" moduleTitle="Montuno foundations" moduleIndex={1} lessons={lessons} />))

describe('LessonRail', () => {
  it('links the logo back to the course and is hidden on phones', () => {
    render()
    const rail = host.querySelector('[data-lesson-rail]')!
    expect(rail.className).toContain('hidden')
    expect(rail.className).toContain('md:flex')
    expect(host.querySelector('[data-rail-home]')?.getAttribute('href')).toBe('/dashboard/course/c')
  })

  it('shows the module ring with lessons done in the module', () => {
    render()
    expect(host.querySelector('[data-module-ring]')?.textContent).toBe('1/3')
  })

  it('draws one node per lesson with its state; the current one is the page', () => {
    render()
    const nodes = [...host.querySelectorAll('[data-rail-lesson]')]
    expect(nodes.map(n => n.getAttribute('data-state'))).toEqual(['done', 'current', 'upcoming'])
    expect(nodes[1].getAttribute('aria-current')).toBe('page')
    expect(nodes[2].querySelector('[data-paywalled]')).not.toBeNull()
    expect(nodes[1].textContent).not.toContain('min')
    expect(nodes[0].textContent).toContain('dashboard.classViewer.lessonMode.rail.minutes(8)')
  })

  it('keeps the lesson settings at the bottom', () => {
    render()
    const settings = host.querySelector('[data-rail-settings]')!
    expect(settings.querySelector('[data-theme-toggle]')).not.toBeNull()
    expect(settings.querySelector('[data-language-toggle]')).not.toBeNull()
  })
})
