// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))

import { ReadyCheck, type ReadyCheckProps } from '../ready-check'

const base: ReadyCheckProps = {
  instrument: 'conga', audioMode: null, onMode: vi.fn(), inputLevel: 0, micOpen: false, micHeard: false, deviceLabel: null, onTestMic: vi.fn(),
  calibrating: false, calibrationBeat: 0, totalCalibrationBeats: 8, calibrationError: null, latencyMs: null, onCalibrate: vi.fn(),
  bleConnected: false, onConnectBle: vi.fn(), preview: <div data-preview />, meta: '8 bars · 100 BPM', onStart: vi.fn(),
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

const panels = () => [...host.querySelectorAll('[data-ready-panel]')]
const states = () => panels().map(p => p.getAttribute('data-check'))
const start = () => host.querySelector('[data-ready-start]') as HTMLButtonElement

describe('ReadyCheck', () => {
  it('shows three panels and the staff preview; start waits for a sound choice', () => {
    act(() => root.render(<ReadyCheck {...base} />))
    expect(panels().map(p => p.getAttribute('data-ready-panel'))).toEqual(['sound', 'input', 'timing'])
    expect(states()).toEqual(['todo', 'todo', 'todo'])
    expect(host.querySelector('[data-preview]')).not.toBeNull()
    expect(start().disabled).toBe(true)
  })

  it('picks a sound mode from the instrument’s options', () => {
    const onMode = vi.fn()
    act(() => root.render(<ReadyCheck {...base} onMode={onMode} />))
    const labels = [...host.querySelectorAll('[data-ready-panel=sound] button')].map(b => b.textContent)
    expect(labels).toEqual(['dashboard.classViewer.lessonMode.ready.modes.headphones', 'dashboard.classViewer.lessonMode.ready.modes.speaker-safe', 'dashboard.classViewer.lessonMode.ready.modes.playsense'])
    act(() => (host.querySelector('[data-ready-panel=sound] button') as HTMLButtonElement).click())
    expect(onMode).toHaveBeenCalledWith('headphones')
  })

  it('a returning student sees every check green and can start', () => {
    const onStart = vi.fn()
    act(() => root.render(<ReadyCheck {...base} audioMode="headphones" micOpen micHeard latencyMs={42} deviceLabel="MacBook Pro Microphone" onStart={onStart} />))
    expect(states()).toEqual(['done', 'done', 'done'])
    expect(host.textContent).toContain('MacBook Pro Microphone')
    expect(host.textContent).toContain('latency(42)')
    act(() => start().click())
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('measures timing on request and shows the progress', () => {
    const onCalibrate = vi.fn()
    act(() => root.render(<ReadyCheck {...base} audioMode="headphones" onCalibrate={onCalibrate} />))
    act(() => (host.querySelector('[data-ready-panel=timing] button') as HTMLButtonElement).click())
    expect(onCalibrate).toHaveBeenCalledOnce()
    act(() => root.render(<ReadyCheck {...base} audioMode="headphones" calibrating calibrationBeat={3} />))
    expect(states()[2]).toBe('running')
    expect(host.querySelector('[data-ready-panel=timing] [role=progressbar]')?.getAttribute('aria-valuenow')).toBe('3')
  })
})
