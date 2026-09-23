// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useMetronome } from '../use-metronome'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: undefined as unknown as T }
  function Probe() { result.current = hook(); return null }
  const root = createRoot(document.createElement('div'))
  act(() => { root.render(<Probe />) })
  return { result }
}

function fakeAudioContext() {
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = []
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = { type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      oscillators.push(osc)
      return osc
    }),
    createGain: vi.fn(() => ({
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators }
}

afterEach(() => vi.useRealTimers())

describe('useMetronome count-in', () => {
  it('plays the count-in clicks even when the running click is off', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useMetronome({ bpm: 120, timeSignature: [4, 4], countInBeats: 4, silent: true })
    )
    const { ctx, oscillators } = fakeAudioContext()
    act(() => { result.current.startMetronome(ctx) })
    expect(oscillators).toHaveLength(4)
    act(() => { result.current.stopMetronome() })
  })

  it('keeps the running click silent after the count-in when silent', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useMetronome({ bpm: 120, timeSignature: [4, 4], countInBeats: 4, silent: true })
    )
    const { ctx, oscillators } = fakeAudioContext()
    act(() => { result.current.startMetronome(ctx) })
    ;(ctx as unknown as { currentTime: number }).currentTime = 5 // well past the count-in
    act(() => { vi.advanceTimersByTime(100) })
    expect(oscillators).toHaveLength(4)
    act(() => { result.current.stopMetronome() })
  })
})
