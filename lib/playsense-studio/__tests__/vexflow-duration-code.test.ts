import { describe, expect, it } from 'vitest'
import { vexflowDurationCode } from '../score-to-vexflow'

describe('vexflowDurationCode', () => {
  it('keeps plain and dotted values', () => {
    expect(vexflowDurationCode(1)).toBe('q')
    expect(vexflowDurationCode(1.5, true)).toBe('q')
    expect(vexflowDurationCode(0.75, 1)).toBe('8')
  })
  it('undoes a double dot', () => {
    expect(vexflowDurationCode(1.75, 2)).toBe('q')
    expect(vexflowDurationCode(0.875, 2)).toBe('8')
  })
  it('undoes the tuplet scaling so a triplet eighth is drawn as an eighth', () => {
    expect(vexflowDurationCode(1 / 3, 0, 2 / 3)).toBe('8')      // was '16' before the fix
    expect(vexflowDurationCode(2 / 3, 0, 2 / 3)).toBe('q')      // quarter-note triplet
    expect(vexflowDurationCode(0.2, 0, 4 / 5)).toBe('16')       // quintuplet sixteenth
    expect(vexflowDurationCode(0.125 * 8 / 7, 0, 8 / 7)).toBe('32') // 7:8 thirty-second
  })
})
