// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MobileCourseBar } from '../mobile-course-bar'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('MobileCourseBar', () => {
  it('carries the summary: ring, lesson line, current lesson and the action', () => {
    act(() => root.render(<MobileCourseBar progressPercentage={42} title="Lesson 7 of 14" subtitle="Accents and Dynamics" action={<button type="button">Go</button>} />))
    const bar = host.firstElementChild as HTMLElement
    expect(bar.className).toContain('lg:hidden')
    expect(bar.textContent).toContain('42%')
    expect(bar.textContent).toContain('Lesson 7 of 14')
    expect(bar.textContent).toContain('Accents and Dynamics')
    expect(bar.querySelector('button')?.textContent).toBe('Go')
  })

  it('omits the subtitle line when there is none', () => {
    act(() => root.render(<MobileCourseBar progressPercentage={0} title="Not started" action={null} />))
    expect(host.querySelectorAll('[data-bar-subtitle]')).toHaveLength(0)
  })
})
