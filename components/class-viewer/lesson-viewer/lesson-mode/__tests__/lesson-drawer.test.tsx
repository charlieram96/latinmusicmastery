// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))

import { LessonDrawer } from '../lesson-drawer'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (open = true) => act(() => root.render(
  <LessonDrawer open={open} onOpenChange={() => {}} title="Montuno in C"
    description={'The montuno is the piano’s repeating figure.\n\nIt anticipates each chord.'}
    meta={{ duration: '11:00', level: 'Beginner', teacher: { name: 'Livan Mesa', imageUrl: null } }}
    comments={<div data-comments>comments</div>} commentCount={12} lessons={<div data-lessons>lessons</div>} />))

const tab = (name: string) => [...document.body.querySelectorAll('[role=tab]')].find(el => el.textContent?.includes(name)) as HTMLButtonElement

describe('LessonDrawer', () => {
  it('shows the lesson description and meta pills under About', () => {
    render()
    const panel = document.body.querySelector('[data-lesson-drawer]')!
    expect(panel.querySelectorAll('[data-about] p')).toHaveLength(2)
    expect(panel.textContent).toContain('Beginner')
    expect(panel.textContent).toContain('Livan Mesa')
    expect(panel.querySelector('[data-comments]')?.closest('[hidden]')).not.toBeNull()
  })

  it('switches to the comments, keeping them mounted', () => {
    render()
    act(() => tab('commentsCount(12)').click())
    expect(document.body.querySelector('[data-comments]')?.closest('[hidden]')).toBeNull()
    expect(document.body.querySelector('[data-about]')).toBeNull()
  })

  it('offers the lesson list on phones only', () => {
    render()
    expect(tab('lessons').className).toContain('md:hidden')
    act(() => tab('lessons').click())
    expect(document.body.querySelector('[data-lessons]')).not.toBeNull()
  })

  it('renders nothing while closed', () => {
    render(false)
    expect(document.body.querySelector('[data-lesson-drawer]')).toBeNull()
  })
})
