import { describe, it, expect } from 'vitest'
import { PitchTracker, type TunerFrame } from '../pitch-tracker'
import { midiToHz } from '../note-math'

const O = { holdMs: 1000, tolCents: 3, targetMidi: null }

/** Feed `n` frames of a constant (fractional) MIDI pitch, 33 ms apart. */
function feed(t: PitchTracker, midiF: number, n: number, start = 0, step = 33): TunerFrame {
  let f: TunerFrame | null = null
  for (let i = 0; i < n; i++) f = t.push({ hz: midiToHz(midiF), clarity: 0.95 }, start + i * step, 440, O)
  return f!
}

describe('PitchTracker', () => {
  it('reports the nearest note and signed cents', () => {
    const f = feed(new PitchTracker(), 40 - 0.2, 6)
    expect(f.midi).toBe(40)
    expect(f.cents).toBeCloseTo(-20, 0)
    expect(f.held).toBe(false)
  })

  it('ignores two stray frames but switches after three', () => {
    const t = new PitchTracker()
    feed(t, 40, 6)
    t.push({ hz: midiToHz(41), clarity: 0.95 }, 300, 440, O)
    const two = t.push({ hz: midiToHz(41), clarity: 0.95 }, 333, 440, O)
    expect(two!.midi).toBe(40)
    feed(t, 41, 4, 366)
    expect(t.push({ hz: midiToHz(41), clarity: 0.95 }, 600, 440, O)!.midi).toBe(41)
  })

  it('switches immediately on a jump of more than 1.5 semitones', () => {
    const t = new PitchTracker()
    feed(t, 40, 6)
    // median of 5 needs 3 new samples before the jump shows through
    feed(t, 45, 3, 300)
    expect(t.push({ hz: midiToHz(45), clarity: 0.95 }, 500, 440, O)!.midi).toBe(45)
  })

  it('holds the last frame within holdMs then clears', () => {
    const t = new PitchTracker()
    feed(t, 45, 6)
    const held = t.push(null, 500, 440, O)
    expect(held?.held).toBe(true)
    expect(held?.midi).toBe(45)
    expect(t.push(null, 1300, 440, O)).toBeNull()
  })

  it('locks after 450 ms inside the window and fires justLocked once', () => {
    const t = new PitchTracker()
    const frames: TunerFrame[] = []
    for (let i = 0; i < 20; i++) frames.push(t.push({ hz: midiToHz(45.01), clarity: 0.95 }, i * 50, 440, O)!)
    expect(frames[5].locked).toBe(false)
    expect(frames.filter((f) => f.justLocked).length).toBe(1)
    expect(frames[19].locked).toBe(true)
  })

  it('unlocks when the pitch drifts out of the window', () => {
    const t = new PitchTracker()
    for (let i = 0; i < 20; i++) t.push({ hz: midiToHz(45), clarity: 0.95 }, i * 50, 440, O)
    const drifted = feed(t, 45.2, 6, 1000)
    expect(drifted.locked).toBe(false)
  })

  it('pins the note in manual mode and allows cents beyond ±50', () => {
    const t = new PitchTracker()
    const f = feed(t, 39, 6) // sounding D♯2
    expect(f.midi).toBe(39)
    const m = t.push({ hz: midiToHz(39), clarity: 0.95 }, 300, 440, { ...O, targetMidi: 40 })
    expect(m!.midi).toBe(40)
    expect(m!.cents).toBeLessThan(-50)
  })

  it('reset clears everything', () => {
    const t = new PitchTracker()
    feed(t, 45, 6)
    t.reset()
    expect(t.push(null, 10, 440, O)).toBeNull()
  })
})
