import { describe, expect, it } from 'vitest'
import { consumeOnsets, decodeMidiNote, inputTimestampToAudioTime } from '../input-events'

describe('input event consumption', () => {
  it('continues processing after the 500-event history rolls over', () => {
    const seen = new WeakSet<{ timestamp: number; energy: number }>()
    let history: Array<{ timestamp: number; energy: number }> = []
    let consumed = 0
    for (let i = 0; i < 1500; i++) {
      history = [...history.slice(-499), { timestamp: i / 10, energy: 1 }]
      consumed += consumeOnsets(history, seen, 0).length
    }
    expect(consumed).toBe(1500)
    expect(consumeOnsets(history, seen, 0)).toEqual([])
  })
  it('accepts simultaneous hits and the first downbeat but excludes count-in', () => {
    const notes = [{ timestamp: 9.99, energy: 1 }, { timestamp: 10, energy: 1 }, { timestamp: 10, energy: 1 }]
    expect(consumeOnsets(notes, new WeakSet(), 10)).toEqual(notes.slice(1))
  })
  it('removes UI delivery delay from hardware timestamps', () => {
    expect(inputTimestampToAudioTime(1000, 1040, 5)).toBeCloseTo(4.96)
  })
})

describe('MIDI message decoding', () => {
  it('handles every channel and velocity-zero note offs', () => {
    expect(decodeMidiNote([0x95, 60, 127])).toEqual({ note: 60, velocity: 1, on: true })
    expect(decodeMidiNote([0x90, 60, 0])?.on).toBe(false)
    expect(decodeMidiNote([0x80, 60, 64])?.on).toBe(false)
  })
  it('ignores controller, clock and incomplete messages', () => {
    expect(decodeMidiNote([0xb0, 64, 127])).toBeNull()
    expect(decodeMidiNote([0xf8])).toBeNull()
    expect(decodeMidiNote([0x90, 60])).toBeNull()
  })
})
