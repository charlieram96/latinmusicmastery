// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffLayoutSwitch, useStaffLayoutPreference } from '../staff-layout-switch'

let root: Root, host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  // Node's experimental localStorage shadows jsdom's here; stub it like the other storage tests.
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), clear: () => storage.clear() })
 host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

function Harness() {
  const [layout, setLayout] = useStaffLayoutPreference()
  return <><output>{layout}</output><StaffLayoutSwitch value={layout} onChange={setLayout} /></>
}

describe('staff layout preference', () => {
  it('defaults to stacked and persists a switch', () => {
    act(() => root.render(<Harness />))
    expect(host.querySelector('output')?.textContent).toBe('stacked')
    const [, horizontal] = host.querySelectorAll('button')
    act(() => horizontal.click())
    expect(host.querySelector('output')?.textContent).toBe('horizontal')
    expect(localStorage.getItem('lmm-staff-layout')).toBe('horizontal')
    expect(horizontal.getAttribute('aria-pressed')).toBe('true')
  })
  it('restores the saved choice', () => {
    localStorage.setItem('lmm-staff-layout', 'horizontal')
    act(() => root.render(<Harness />))
    expect(host.querySelector('output')?.textContent).toBe('horizontal')
  })
})
