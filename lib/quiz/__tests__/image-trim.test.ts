import { describe, expect, it } from 'vitest'
import { alphaBounds, boxToPercent, scaleToFit } from '../image-trim'

/** 4×4 RGBA image with opaque pixels at (1,1),(2,1),(1,2),(2,2). */
function square4() {
  const d = new Uint8ClampedArray(4 * 4 * 4)
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) d[(y * 4 + x) * 4 + 3] = 255
  return d
}

describe('alphaBounds', () => {
  it('finds the opaque box and pads it within the image', () => {
    expect(alphaBounds(square4(), 4, 4, 8, 0)).toEqual({ x: 1, y: 1, width: 2, height: 2 })
    expect(alphaBounds(square4(), 4, 4, 8, 4)).toEqual({ x: 0, y: 0, width: 4, height: 4 })
  })
  it('ignores pixels at or below the threshold and returns null when nothing is opaque', () => {
    const d = square4()
    d[(1 * 4 + 1) * 4 + 3] = 8
    expect(alphaBounds(d, 4, 4, 8, 0)).toEqual({ x: 1, y: 1, width: 2, height: 2 })
    expect(alphaBounds(new Uint8ClampedArray(64), 4, 4)).toBeNull()
  })
})

describe('boxToPercent', () => {
  it('converts pixels to percent of the file', () => {
    expect(boxToPercent({ x: 10, y: 20, width: 30, height: 40 }, 100, 200)).toEqual({ x: 10, y: 10, width: 30, height: 20 })
  })
})

describe('scaleToFit', () => {
  it('shrinks the long side to the cap and never upscales', () => {
    expect(scaleToFit(2000, 1000, 1024)).toEqual({ width: 1024, height: 512, scale: 0.512 })
    expect(scaleToFit(300, 900, 1024)).toEqual({ width: 300, height: 900, scale: 1 })
  })
})
