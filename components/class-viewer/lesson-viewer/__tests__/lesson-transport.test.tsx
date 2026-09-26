// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))

import { LessonTransport, type LessonTransportProps } from '../lesson-transport'

const handlers = () => ({ onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onRestart: vi.fn(), onFinish: vi.fn(), onClickToggle: vi.fn(), onWatchDemo: vi.fn() })
let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (props: Partial<LessonTransportProps> & ReturnType<typeof handlers>) =>
  act(() => root.render(<LessonTransport state="playing" bpm={96} countdownBeat={0} click mix={<span data-mix />} {...props} />))
const byLabel = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLButtonElement

describe('LessonTransport', () => {
  it('while playing: pause, BPM and Finish take', () => {
    const h = handlers()
    render(h)
    act(() => byLabel('dashboard.classViewer.lessonMode.transport.pause').click())
    expect(h.onPause).toHaveBeenCalledOnce()
    expect(host.textContent).toContain('transport.bpm(96)')
    act(() => (host.querySelector('[data-finish-take]') as HTMLButtonElement).click())
    expect(h.onFinish).toHaveBeenCalledOnce()
    expect(host.querySelector('[data-transport-extra] [data-mix]')).not.toBeNull()
  })

  it('while paused: resume', () => {
    const h = handlers()
    render({ ...h, state: 'paused' })
    act(() => byLabel('dashboard.classViewer.lessonMode.transport.resume').click())
    expect(h.onResume).toHaveBeenCalledOnce()
  })

  it('before a take: Start playing is the main action and there is no Finish take', () => {
    const h = handlers()
    render({ ...h, state: 'selecting' })
    expect(host.querySelector('[data-finish-take]')).toBeNull()
    act(() => (host.querySelector('[data-transport-start]') as HTMLButtonElement).click())
    expect(h.onStart).toHaveBeenCalledOnce()
    act(() => byLabel('dashboard.classViewer.lessonMode.transport.watchDemo').click())
    expect(h.onWatchDemo).toHaveBeenCalledOnce()
  })

  it('restarts and toggles the click', () => {
    const h = handlers()
    render(h)
    act(() => byLabel('dashboard.classViewer.lessonMode.transport.restart').click())
    act(() => byLabel('dashboard.classViewer.lessonMode.transport.clickOn').click())
    expect(h.onRestart).toHaveBeenCalledOnce()
    expect(h.onClickToggle).toHaveBeenCalledOnce()
    expect(byLabel('dashboard.classViewer.lessonMode.transport.clickOn').getAttribute('aria-pressed')).toBe('true')
  })
})
