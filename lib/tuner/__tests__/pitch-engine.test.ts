import { describe, it, expect } from 'vitest'
import { mpm, MPM_DEFAULTS as D } from '../pitch-engine'
import { synth, noise } from './synth'

const run = (b: Float32Array) => mpm(b, 48000, D.minHz, D.maxHz, D.kMax)

describe('mpm', () => {
  it('finds G3 with harmonics', () => {
    const r = run(synth(196))
    expect(r?.hz).toBeCloseTo(196, 0)
    expect(r!.clarity).toBeGreaterThan(0.9)
  })

  it('finds E1 even when harmonics dominate (no octave error)', () => {
    const r = run(synth(41.2, [0.5, 0.9, 0.7, 0.4]))
    expect(r?.hz).toBeCloseTo(41.2, 0)
  })

  it('finds E6', () => {
    expect(run(synth(1318.5, [1]))?.hz).toBeCloseTo(1318.5, 0)
  })

  it('finds A4 at 442 within 0.5 Hz', () => {
    expect(Math.abs(run(synth(442))!.hz - 442)).toBeLessThan(0.5)
  })

  it('returns null for silence and low clarity for noise', () => {
    expect(run(new Float32Array(4096))).toBeNull()
    const r = run(noise())
    expect(r === null || r.clarity < 0.6).toBe(true)
  })

  it('exposes the defaults the worklet and fallback share', () => {
    expect(D).toEqual({ minHz: 27, maxHz: 1400, kMax: 0.93, bufferSize: 4096 })
  })
})
