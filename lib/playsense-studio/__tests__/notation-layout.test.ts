import { describe, expect, it } from 'vitest'
import { packScoreRows } from '../notation-layout'

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
})
