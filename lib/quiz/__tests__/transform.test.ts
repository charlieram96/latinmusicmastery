import { describe, expect, it } from 'vitest'
import { clampPieceWidth, clampRect, moveRect, resizeRect, snap } from '../transform'

const start = { x: 40, y: 40, width: 20, height: 10 }

describe('snap', () => {
  it('rounds to the step, or to a tenth when unsnapped', () => {
    expect(snap(41.3, 2.5)).toBe(42.5)
    expect(snap(41.24, null)).toBe(41.2)
  })
})

describe('clampRect', () => {
  it('keeps the rect inside 0..100 and above the minimum size', () => {
    expect(clampRect({ x: 95, y: -5, width: 20, height: 1 })).toEqual({ x: 80, y: 0, width: 20, height: 2 })
  })
})

describe('moveRect', () => {
  it('translates and clamps', () => {
    expect(moveRect(start, 10, -50, null)).toEqual({ x: 50, y: 0, width: 20, height: 10 })
    expect(moveRect(start, 100, 0, null)).toEqual({ x: 80, y: 40, width: 20, height: 10 })
  })
})

describe('resizeRect', () => {
  it('grows from the east and south edges', () => {
    expect(resizeRect(start, 'e', 5, 0, null, false)).toEqual({ x: 40, y: 40, width: 25, height: 10 })
    expect(resizeRect(start, 's', 0, 4, null, false)).toEqual({ x: 40, y: 40, width: 20, height: 14 })
  })
  it('keeps the opposite edge fixed when pulling west or north', () => {
    expect(resizeRect(start, 'w', 5, 0, null, false)).toEqual({ x: 45, y: 40, width: 15, height: 10 })
    expect(resizeRect(start, 'n', 0, -5, null, false)).toEqual({ x: 40, y: 35, width: 20, height: 15 })
  })
  it('locks the ratio on corners when asked', () => {
    const r = resizeRect(start, 'se', 10, 0, null, true)
    expect(r.width).toBe(30)
    expect(r.height).toBe(15)
    const nw = resizeRect(start, 'nw', -10, 0, null, true)
    expect(nw).toEqual({ x: 30, y: 35, width: 30, height: 15 })
  })
  it('never collapses below the minimum size', () => {
    expect(resizeRect(start, 'e', -30, 0, null, false).width).toBe(2)
  })
  it('snaps to the grid', () => {
    expect(resizeRect(start, 'e', 1.1, 0, 2.5, false).width).toBe(20)
    expect(resizeRect(start, 'e', 1.3, 0, 2.5, false).width).toBe(22.5)
  })
  it('locks corners to an explicit box ratio when one is given', () => {
    expect(resizeRect(start, 'se', 10, 0, null, true, 3)).toEqual({ x: 40, y: 40, width: 30, height: 10 })
    expect(resizeRect(start, 'e', 10, 0, null, true, 3)).toEqual({ x: 40, y: 40, width: 30, height: 10 })
  })
})

describe('clampPieceWidth', () => {
  it('stays within 3..60 with one decimal', () => {
    expect(clampPieceWidth(1)).toBe(3)
    expect(clampPieceWidth(99)).toBe(60)
    expect(clampPieceWidth(12.34)).toBe(12.3)
  })
})
