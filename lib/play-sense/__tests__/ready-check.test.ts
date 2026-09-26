import { describe, expect, it } from 'vitest'
import { readyChecks, type ReadyInput } from '../ready-check'

const base: ReadyInput = { audioMode: null, micOpen: false, micHeard: false, calibrated: false, calibrating: false, bleConnected: false }

describe('readyChecks', () => {
  it('a first-timer starts with nothing checked and cannot start', () => {
    expect(readyChecks(base)).toEqual({ sound: 'todo', input: 'todo', timing: 'todo', canStart: false })
  })

  it('a returning student with a saved mode and calibration is green once the mic hears them', () => {
    expect(readyChecks({ ...base, audioMode: 'headphones', calibrated: true, micOpen: true, micHeard: true }))
      .toEqual({ sound: 'done', input: 'done', timing: 'done', canStart: true })
  })

  it('the mic check runs while the mic is open and silent', () => {
    expect(readyChecks({ ...base, audioMode: 'speaker-safe', micOpen: true }).input).toBe('running')
  })

  it('timing runs while calibrating, and Start waits for it (L1)', () => {
    const r = readyChecks({ ...base, audioMode: 'headphones', calibrating: true })
    expect(r.timing).toBe('running')
    expect(r.canStart).toBe(false)
  })

  it('skipping timing still allows a start', () => {
    expect(readyChecks({ ...base, audioMode: 'headphones' }).canStart).toBe(true)
  })

  it('MIDI needs neither the mic nor a timing check', () => {
    expect(readyChecks({ ...base, audioMode: 'midi' })).toEqual({ sound: 'done', input: 'done', timing: 'skipped', canStart: true })
  })

  it('PlaySense is ready once the device is connected', () => {
    expect(readyChecks({ ...base, audioMode: 'playsense' }).input).toBe('todo')
    expect(readyChecks({ ...base, audioMode: 'playsense', bleConnected: true }).input).toBe('done')
  })
})
