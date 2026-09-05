import { describe, expect, it } from 'vitest'
import { CUES, scheduleCue, type CueContext } from '../sounds'

function fakeContext() {
  const created = { osc: 0, gain: 0, started: [] as number[] }
  const param = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
  const ctx: CueContext = {
    currentTime: 1,
    state: 'running',
    destination: {} as AudioNode,
    resume: async () => {},
    createOscillator: () => {
      created.osc++
      return { type: 'sine', frequency: param, connect: () => ({}), start: (t: number) => created.started.push(t), stop: () => {} } as unknown as OscillatorNode
    },
    createGain: () => {
      created.gain++
      return { gain: param, connect: () => ({}) } as unknown as GainNode
    },
  }
  return { ctx, created }
}

describe('CUES', () => {
  it('defines every cue with ascending-or-equal start offsets', () => {
    for (const notes of Object.values(CUES)) {
      expect(notes.length).toBeGreaterThan(0)
      for (let i = 1; i < notes.length; i++) expect(notes[i].at).toBeGreaterThanOrEqual(notes[i - 1].at)
    }
    expect(CUES.ok[0].freq).toBe(1046.5)
  })
})

describe('scheduleCue', () => {
  it('creates one oscillator and gain per note, starting 10ms ahead', () => {
    const { ctx, created } = fakeContext()
    const n = scheduleCue('fanfare', ctx)
    expect(n).toBe(CUES.fanfare.length)
    expect(created.osc).toBe(n)
    expect(created.gain).toBe(n)
    expect(created.started[0]).toBeCloseTo(1.01, 5)
  })
})
