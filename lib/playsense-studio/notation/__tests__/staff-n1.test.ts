import { describe, expect, it } from 'vitest'
import { barCounts, barsPerRow, glide, isAttack, noteLabel, noteStateAt, pageTurn, parseStaffLayout, rowStates, stackedFollowTarget } from '../staff-n1'

describe('barsPerRow', () => {
  it('fits one bar per 250 scaled px, clamped to 2..4', () => {
    expect(barsPerRow(1200, 1)).toBe(4)
    expect(barsPerRow(760, 1)).toBe(3)
    expect(barsPerRow(390, 1.17)).toBe(2)
    expect(barsPerRow(0, 1)).toBe(2)
  })
})
describe('rowStates', () => {
  it('marks rows before, at and after the current one', () => {
    expect(rowStates(4, 1)).toEqual(['past', 'now', 'next', 'next'])
  })
})
describe('stackedFollowTarget', () => {
  it('puts the row at the top, clamped to the scroll range', () => {
    expect(stackedFollowTarget(300, 400, 1000)).toBe(294)
    expect(stackedFollowTarget(0, 400, 1000)).toBe(0)
    expect(stackedFollowTarget(900, 400, 1000)).toBe(600)
    expect(stackedFollowTarget(300, 400, 200)).toBe(0)
  })
})
describe('glide', () => {
  it('eases about 7/s and snaps when close', () => {
    expect(glide(0, 100, 1 / 60)).toBeCloseTo(100 * 7 / 60)
    expect(glide(99.8, 100, 1 / 60)).toBe(100)
    expect(glide(0, 100, 1)).toBe(100)
  })
})
describe('barCounts', () => {
  it('counts eighths in 4/4 with the "and" label', () => {
    expect(barCounts(4, [4, 4], '&').map(c => c.label).join(' ')).toBe('1 & 2 & 3 & 4 &')
    expect(barCounts(4, [4, 4], '&')[1]).toEqual({ qn: 4.5, label: '&', beat: false })
  })
  it('counts only beats in eighth-note meters', () => {
    expect(barCounts(0, [6, 8], '&').map(c => `${c.qn}:${c.label}`)).toEqual(['0:1', '0.5:2', '1:3', '1.5:4', '2:5', '2.5:6'])
  })
})
describe('noteStateAt', () => {
  const notes = [{ ms: 0, endMs: 500 }, { ms: 500, endMs: 1000 }, { ms: 1500, endMs: 2000 }]
  it('finds the sounding note and the played prefix', () => {
    expect(noteStateAt(-10, notes)).toEqual({ active: -1, played: 0 })
    expect(noteStateAt(600, notes)).toEqual({ active: 1, played: 1 })
    expect(noteStateAt(1200, notes)).toEqual({ active: -1, played: 2 })
    expect(noteStateAt(5000, notes)).toEqual({ active: -1, played: 3 })
  })
})
describe('pageTurn', () => {
  it('is instant on first show and for the same page', () => {
    expect(pageTurn(-1, 0, false).kind).toBe('instant')
    expect(pageTurn(2, 2, false).kind).toBe('instant')
  })
  it('slides 12% over 420ms, backwards when going back', () => {
    expect(pageTurn(0, 1, false)).toEqual({ kind: 'slide', durationMs: 420, direction: 1, offsetPercent: 12 })
    expect(pageTurn(3, 1, false).direction).toBe(-1)
  })
  it('fades for 220ms under reduced motion', () => {
    expect(pageTurn(0, 1, true)).toEqual({ kind: 'fade', durationMs: 220, direction: 1, offsetPercent: 0 })
  })
})
describe('noteLabel', () => {
  it('names spelled VexFlow keys in letters or solfege', () => {
    expect(noteLabel('c#/5', 'letters')).toBe('C♯')
    expect(noteLabel('bb/4', 'letters')).toBe('B♭')
    expect(noteLabel('g/4', 'solfege')).toBe('Sol')
    expect(noteLabel('f##/4', 'solfege')).toBe('Fa𝄪')
    expect(noteLabel('nonsense', 'letters')).toBe('')
  })
})
describe('isAttack', () => {
  it('skips rests and tied continuations', () => {
    expect(isAttack(undefined, { isRest: false })).toBe(true)
    expect(isAttack({ tieToNext: true }, { isRest: false })).toBe(false)
    expect(isAttack({ tieToNext: false }, { isRest: true })).toBe(false)
  })
})
describe('parseStaffLayout', () => {
  it('defaults to stacked', () => {
    expect(parseStaffLayout(null)).toBe('stacked')
    expect(parseStaffLayout('junk')).toBe('stacked')
    expect(parseStaffLayout('horizontal')).toBe('horizontal')
  })
})
