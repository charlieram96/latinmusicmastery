// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))

import { SectionChips } from '../section-chips'

const sections = [{ label: 'Intro', start: 0, end: 10 }, { label: null, start: 10, end: 24 }, { label: 'Coro', start: 24, end: 40 }]

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const chips = () => [...host.querySelectorAll('button')] as HTMLButtonElement[]

describe('SectionChips', () => {
  it('names unlabelled sections and marks the one playing', () => {
    act(() => root.render(<SectionChips sections={sections} currentSeconds={12} loop={{ a: null, b: null, enabled: false }} onLoop={vi.fn()} onClear={vi.fn()} />))
    expect(chips().map(c => c.textContent)).toEqual(['Intro', 'dashboard.classViewer.lessonMode.sections.section(2)', 'Coro'])
    expect(chips().map(c => c.getAttribute('data-active'))).toEqual(['false', 'true', 'false'])
  })

  it('loops a section when tapped', () => {
    const onLoop = vi.fn()
    act(() => root.render(<SectionChips sections={sections} currentSeconds={0} loop={{ a: null, b: null, enabled: false }} onLoop={onLoop} onClear={vi.fn()} />))
    act(() => chips()[2].click())
    expect(onLoop).toHaveBeenCalledWith(24, 40)
  })

  it('stops the loop when the looping section is tapped again', () => {
    const onLoop = vi.fn()
    const onClear = vi.fn()
    act(() => root.render(<SectionChips sections={sections} currentSeconds={25} loop={{ a: 24, b: 40, enabled: true }} onLoop={onLoop} onClear={onClear} />))
    expect(chips()[2].getAttribute('aria-pressed')).toBe('true')
    act(() => chips()[2].click())
    expect(onClear).toHaveBeenCalledOnce()
    expect(onLoop).not.toHaveBeenCalled()
  })

  it('renders nothing for fewer than two sections', () => {
    act(() => root.render(<SectionChips sections={[sections[0]]} currentSeconds={0} loop={{ a: null, b: null, enabled: false }} onLoop={vi.fn()} onClear={vi.fn()} />))
    expect(host.innerHTML).toBe('')
  })
})
