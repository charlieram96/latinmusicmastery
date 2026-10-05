// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { amplitudeDbfs, MicrophoneLevelMeter } from '../microphone-level-meter'
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: 'en' }) }))
it('maps digital amplitude to dBFS and warns on a short peak rather than average loudness', () => {
  expect(amplitudeDbfs(1)).toBe(0)
  expect(amplitudeDbfs(.5)).toBeCloseTo(-6.0206)
  expect(amplitudeDbfs(0)).toBe(-Infinity)
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div'), root = createRoot(host)
  try {
    act(() => root.render(<MicrophoneLevelMeter rms={.01} peak={.95} active />))
    expect(host.querySelector('[data-mic-warning]')?.getAttribute('data-mic-warning')).toBe('true')
    expect(host.textContent).toContain('Level too high')
    expect(host.textContent).toContain('-0.4 dBFS')
    expect(host.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('-40')
    act(() => root.render(<MicrophoneLevelMeter rms={.01} peak={1} active />))
    expect(host.textContent).toContain('Digital limit reached')
    act(() => root.render(<MicrophoneLevelMeter rms={.01} peak={1} active={false} />))
    expect(host.querySelector('[data-mic-warning]')?.getAttribute('data-mic-warning')).toBe('false')
    expect(host.textContent).toContain('−∞ dBFS')
  } finally { act(() => root.unmount()) }
})
