// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffLayoutSwitch, StaffRefollowButton, staffNeedsRefollow, staffPaneClass, useStaffLayoutPreference } from '../staff-layout-switch'

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

describe('re-follow for stacked and paged staves (watch player)', () => {
  it('is needed only for row layouts that stopped following', () => {
    expect(staffNeedsRefollow('paged', false)).toBe(true)
    // Stacked follows playback itself (autoFollow), so a pill there would do nothing.
    expect(staffNeedsRefollow('wrapped', false)).toBe(false)
    expect(staffNeedsRefollow('paged', true)).toBe(false)
    // The scroll line has its own Follow button on the scrub bar.
    expect(staffNeedsRefollow('scroll', false)).toBe(false)
  })
  it('snaps the view back to playback', () => {
    const onFollow = vi.fn()
    act(() => root.render(<StaffRefollowButton onFollow={onFollow} />))
    const button = host.querySelector('button')!
    expect(button.textContent).toContain('staff.follow')
    act(() => button.click())
    expect(onFollow).toHaveBeenCalledTimes(1)
  })
})

describe('watch player notation pane', () => {
  it('lets a paged row scroll in a short pane and keeps room for the zoom control', () => {
    expect(staffPaneClass('paged')).toMatch(/overflow-y-auto/)
    expect(staffPaneClass('paged')).toMatch(/pb-16/)
    expect(staffPaneClass('paged')).not.toMatch(/overflow-hidden/)
    expect(staffPaneClass('wrapped')).toMatch(/overflow-hidden/)
    expect(staffPaneClass('scroll')).toMatch(/overflow-auto/)
  })
})
