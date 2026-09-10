import { describe, expect, it } from 'vitest'
import { packLessonScoreRows, packScoreRows } from '../notation-layout'

describe('responsive measure rows', () => {
  it('fits one, two, or three measures and caps wide rows at three', () => {
    const widths = Array(6).fill(200)
    expect(packScoreRows(widths, 399).map(row => row.widths.length)).toEqual([1, 1, 1, 1, 1, 1])
    expect(packScoreRows(widths, 400).map(row => row.widths.length)).toEqual([2, 2, 2])
    expect(packScoreRows(widths, 600).map(row => row.widths.length)).toEqual([3, 3])
    expect(packScoreRows(widths, 2000).map(row => row.widths.length)).toEqual([3, 3])
  })

  it('reserves clef space only in the opening measure', () => {
    const widths = [280, 200, 200, 200, 200, 200]
    expect(packScoreRows(widths, 679).map(row => row.widths.length)).toEqual([2, 3, 1])
    expect(packScoreRows(widths, 680).map(row => row.widths.length)).toEqual([3, 3])
  })

  it('does not let one dense bar limit the measures in later rows', () => {
    const rows = packScoreRows([200, 600, 200, 200, 200], 650)
    expect(rows.map(row => [row.startIndex, row.widths.length])).toEqual([[0, 1], [1, 1], [2, 3]])
  })

  it('distributes spare space without shrinking the required note area', () => {
    const widths = [300, 200, 200]
    const [row] = packScoreRows(widths, 800)
    expect(row.widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(800)
    expect(row.widths[0] - row.widths[1]).toBeCloseTo(100)
    row.widths.forEach((width, index) => expect(width).toBeGreaterThanOrEqual(widths[index]))
  })

  it('reduces columns when note zoom leaves less room and preserves oversized bars', () => {
    const widths = [280, 200, 200, 200, 200, 200]
    expect(packScoreRows(widths, 840 / 1.2)[0].widths.length).toBe(3)
    expect(packScoreRows(widths, 840 / 1.6)[0].widths.length).toBe(2)
    expect(packScoreRows([700, 200, 200], 450)).toEqual([{ startIndex: 0, widths: [700] }, { startIndex: 1, widths: [225, 225] }])
  })

  it('retains order, the final gap, and empty-score handling', () => {
    const rows = packScoreRows([280, 200, 200, 200, 240], 700)
    expect(rows.map(row => [row.startIndex, row.widths.length])).toEqual([[0, 3], [3, 2]])
    expect(packScoreRows([], 700)).toEqual([])
  })

  it('gives intro and outro their own full-width rows without reducing musical columns', () => {
    const rows = packLessonScoreRows([280, 200, 200], 700, { leading: true, trailing: true })
    expect(rows[0]).toEqual({ startIndex: -1, widths: [700], interlude: 'leading' })
    expect(rows[1].startIndex).toBe(0)
    expect(rows[1].widths).toHaveLength(3)
    expect(rows[1].widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(700)
    expect(rows[2]).toEqual({ startIndex: -1, widths: [700], interlude: 'trailing' })
  })

  it('keeps full-width pauses around narrower reflowed music', () => {
    const rows = packLessonScoreRows([280, 200, 200], 350, { leading: true, trailing: true })
    expect(rows.map(row => row.interlude ?? row.startIndex)).toEqual(['leading', 0, 1, 2, 'trailing'])
    expect(rows.every(row => row.widths[0] === 350)).toBe(true)
  })

  it('adds only the video intervals that exist', () => {
    expect(packLessonScoreRows([280, 200], 700, { leading: false, trailing: false }))
      .toEqual(packScoreRows([280, 200], 700))
    const rows = packLessonScoreRows([280, 200], 700, { leading: false, trailing: true })
    expect(rows).toHaveLength(2)
    expect(rows[0].startIndex).toBe(0)
    expect(rows[1].interlude).toBe('trailing')
  })
})
