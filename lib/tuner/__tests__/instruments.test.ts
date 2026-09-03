import { describe, it, expect } from 'vitest'
import {
  TUNER_INSTRUMENTS,
  AUTO_HIGHLIGHT_CENTS,
  getInstrument,
  getTuning,
  courseMidis,
  targetMidis,
  nearestCourse,
  courseTargetMidi,
} from '../instruments'
import { SENSITIVITY_PRESETS } from '../sensitivity'
import { midiToHz } from '../note-math'

describe('instruments', () => {
  it('lists the seven instruments in order', () => {
    expect(TUNER_INSTRUMENTS.map((i) => i.id)).toEqual(['guitar', 'bass', 'tres', 'cuatro', 'ukulele', 'violin', 'chromatic'])
  })

  it('every course name parses and non-re-entrant tunings run low to high', () => {
    const reentrant = new Set(['ukulele.standard'])
    for (const i of TUNER_INSTRUMENTS) {
      for (const t of i.tunings) {
        const cs = courseMidis(t)
        if (reentrant.has(t.nameKey)) continue
        for (let k = 1; k < cs.length; k++) expect(Math.min(...cs[k])).toBeGreaterThan(Math.min(...cs[k - 1]))
      }
    }
  })

  it('guitar standard is E2 A2 D3 G3 B3 E4', () => {
    expect(courseMidis(getTuning(getInstrument('guitar'), 'standard')).flat()).toEqual([40, 45, 50, 55, 59, 64])
  })

  it('tres afinación en Do has an octave course', () => {
    const t = getTuning(getInstrument('tres'), 'do')
    expect(courseMidis(t)[0]).toEqual([55, 67])
    expect(targetMidis(t)).toEqual([55, 60, 64, 67])
  })

  it('cuatro has five courses with two octave pairs', () => {
    const cs = courseMidis(getTuning(getInstrument('cuatro'), 'pr'))
    expect(cs.length).toBe(5)
    expect(cs[0]).toEqual([47, 59])
    expect(cs[2]).toEqual([57, 57])
  })

  it('chromatic has no courses', () => {
    expect(courseMidis(getTuning(getInstrument('chromatic'), 'any'))).toEqual([])
    expect(nearestCourse([], 440, 440)).toBe(-1)
  })

  it('picks the nearest course and the nearer note in an octave course', () => {
    const c = courseMidis(getTuning(getInstrument('tres'), 'do'))
    expect(nearestCourse(c, midiToHz(66.8), 440)).toBe(0)
    expect(nearestCourse(c, midiToHz(60.3), 440)).toBe(1)
    expect(courseTargetMidi(c[0], midiToHz(66.8), 440)).toBe(67)
    expect(courseTargetMidi(c[0], midiToHz(55.4), 440)).toBe(55)
    expect(courseTargetMidi(c[0], null, 440)).toBe(55)
  })

  it('falls back to the first tuning for an unknown id', () => {
    expect(getTuning(getInstrument('guitar'), 'nope').id).toBe('standard')
  })

  it('exposes the auto-highlight cap and sensitivity presets', () => {
    expect(AUTO_HIGHLIGHT_CENTS).toBe(75)
    expect(SENSITIVITY_PRESETS.low).toEqual({ rms: 0.02, clarity: 0.93 })
    expect(SENSITIVITY_PRESETS.med).toEqual({ rms: 0.01, clarity: 0.88 })
    expect(SENSITIVITY_PRESETS.high).toEqual({ rms: 0.004, clarity: 0.8 })
  })
})
