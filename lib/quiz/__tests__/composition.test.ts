import { describe, expect, it } from 'vitest'
import { DEFAULT_BACKGROUND_COLOR, legacyLayer, readComposition, readPieces, readTolerance, shouldPersistAspect } from '../composition'

describe('readComposition', () => {
  it('returns the stored background when present', () => {
    const bg = readComposition(
      { background: { color: '#123456', aspect: 1.5, layers: [{ id: 'a', imageUrl: 'u', x: 1, y: 2, width: 30, height: 40 }] }, pieces: [] },
      'ignored.png',
    )
    expect(bg).toEqual({ color: '#123456', aspect: 1.5, layers: [{ id: 'a', imageUrl: 'u', x: 1, y: 2, width: 30, height: 40 }] })
  })
  it('turns a legacy image_url into one full-bleed layer', () => {
    expect(readComposition({ pieces: [] }, 'bg.png')).toEqual({ color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: [legacyLayer('bg.png')] })
    expect(legacyLayer('bg.png')).toEqual({ id: 'legacy', imageUrl: 'bg.png', x: 0, y: 0, width: 100, height: 100 })
  })
  it('gives an empty composition when there is neither', () => {
    expect(readComposition(null, null)).toEqual({ color: DEFAULT_BACKGROUND_COLOR, aspect: null, layers: [] })
  })
  it('drops malformed layers and non-positive aspects', () => {
    const bg = readComposition({ background: { color: '', aspect: 0, layers: [{ id: 'x' }, 'junk', { id: 'ok', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, ratio: 2 }] } })
    expect(bg.color).toBe(DEFAULT_BACKGROUND_COLOR)
    expect(bg.aspect).toBeNull()
    expect(bg.layers).toEqual([{ id: 'ok', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, ratio: 2 }])
  })
  it('keeps a layer natural size and frame when they are well formed', () => {
    const layer = { id: 'a', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, natural: { width: 1440, height: 2126 }, frame: { x: 10, y: 5, width: 80, height: 90 } }
    const bg = readComposition({ background: { color: '#111', aspect: 1.5, layers: [layer] } })
    expect(bg.layers[0].natural).toEqual({ width: 1440, height: 2126 })
    expect(bg.layers[0].frame).toEqual({ x: 10, y: 5, width: 80, height: 90 })
  })
  it('drops a malformed natural size or frame but keeps the layer', () => {
    const bg = readComposition({
      background: {
        color: '#111',
        aspect: 1.5,
        layers: [
          { id: 'a', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, natural: { width: 0, height: 100 }, frame: { x: 1, y: 2, width: 3 } },
          { id: 'b', imageUrl: 'u', x: 0, y: 0, width: 10, height: 10, natural: 'big', frame: 'all' },
        ],
      },
    })
    expect(bg.layers).toHaveLength(2)
    for (const l of bg.layers) {
      expect(l).not.toHaveProperty('natural')
      expect(l).not.toHaveProperty('frame')
    }
  })
})

describe('readPieces', () => {
  it('returns the pieces array or []', () => {
    expect(readPieces({ pieces: [{ id: 'p', imageUrl: '', width: 5, area: { x: 0, y: 0, width: 1, height: 1 } }] })).toHaveLength(1)
    expect(readPieces(null)).toEqual([])
    expect(readPieces({ pieces: 'nope' })).toEqual([])
  })
})

describe('shouldPersistAspect', () => {
  const base = { open: true, storedAspect: null, layerCount: 1, measured: true }
  it('is true only when open, unstored, has layers, and measured', () => {
    expect(shouldPersistAspect(base)).toBe(true)
  })
  it('is false when not measured (fallback aspect, not the real one)', () => {
    expect(shouldPersistAspect({ ...base, measured: false })).toBe(false)
  })
  it('is false when an aspect is already stored', () => {
    expect(shouldPersistAspect({ ...base, storedAspect: 1.5 })).toBe(false)
  })
  it('is false with zero layers', () => {
    expect(shouldPersistAspect({ ...base, layerCount: 0 })).toBe(false)
  })
  it('is false when the dialog is closed', () => {
    expect(shouldPersistAspect({ ...base, open: false })).toBe(false)
  })
})

describe('readPieces normalisation', () => {
  it('keeps ratio and tolerance only when they are sane', () => {
    const [p] = readPieces({ pieces: [{ id: 'p', imageUrl: 'u', width: 5, area: { x: 0, y: 0, width: 1, height: 1 }, ratio: 0, tolerance: 2 }] })
    expect(p).not.toHaveProperty('ratio')
    expect(p.tolerance).toBe(2)
    const [q] = readPieces({ pieces: [{ id: 'q', imageUrl: 'u', width: 5, area: { x: 0, y: 0, width: 1, height: 1 }, ratio: 1.5, tolerance: -1 }] })
    expect(q.ratio).toBe(1.5)
    expect(q).not.toHaveProperty('tolerance')
    expect(readPieces({ pieces: [null, 'x'] })).toEqual([])
  })
})

describe('readTolerance', () => {
  it('returns the stored question default or 3', () => {
    expect(readTolerance({ tolerance: 5 })).toBe(5)
    expect(readTolerance({ tolerance: -1 })).toBe(3)
    expect(readTolerance(null)).toBe(3)
  })
})
