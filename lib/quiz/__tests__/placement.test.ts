import { describe, expect, it } from 'vitest'
import type { PlacementPiece } from '../grading'
import {
  DEFAULT_TOLERANCE, areaFor, centreOf, clampCentre, effectiveRatio, frameToStage, pieceHeightPct, pieceWarnings, placePiece, refitForAspect, resolveDrop, swappable, toleranceOf,
} from '../placement'

const piece = (over: Partial<PlacementPiece> & { id: string }): PlacementPiece => ({ label: 'x', imageUrl: 'u', width: 10, area: { x: 0, y: 0, width: 10, height: 10 }, ...over })

describe('pieceHeightPct', () => {
  it('scales width by the stage aspect over the sprite ratio', () => {
    expect(pieceHeightPct(10, 4 / 3, 2)).toBeCloseTo(6.6667, 3)
    expect(pieceHeightPct(10, 1, undefined)).toBe(10)
  })
})

describe('areaFor / centreOf / toleranceOf', () => {
  it('round-trips a centre, size and tolerance', () => {
    const area = areaFor({ x: 50, y: 40 }, 20, 10, 3)
    expect(area).toEqual({ x: 37, y: 32, width: 26, height: 16 })
    expect(centreOf(area)).toEqual({ x: 50, y: 40 })
    expect(toleranceOf(area, 20, 10)).toBe(3)
  })
  it('never returns a negative tolerance', () => {
    expect(toleranceOf({ x: 0, y: 0, width: 5, height: 5 }, 20, 10)).toBe(0)
    expect(areaFor({ x: 50, y: 50 }, 10, 10, -4).width).toBe(10)
  })
})

describe('effectiveRatio', () => {
  it('prefers the stored ratio, else derives it from the legacy area', () => {
    expect(effectiveRatio(piece({ id: 'a', ratio: 2 }), 1.6, 3)).toBe(2)
    // area 26 x 16 with tolerance 3 → piece 20 x 10 on a 1.6 stage → ratio = 20 * 1.6 / 10
    expect(effectiveRatio(piece({ id: 'b', width: 20, area: { x: 0, y: 0, width: 26, height: 16 } }), 1.6, 3)).toBeCloseTo(3.2, 5)
    expect(effectiveRatio(piece({ id: 'c', width: 20, area: { x: 0, y: 0, width: 20, height: 0 } }), 1.6, 3)).toBe(1)
  })
})

describe('clampCentre', () => {
  it('keeps the whole sprite inside the stage', () => {
    expect(clampCentre({ x: 2, y: 99 }, 20, 10)).toEqual({ x: 10, y: 95 })
    expect(clampCentre({ x: 50, y: 50 }, 120, 10)).toEqual({ x: 50, y: 50 })
  })
})

describe('resolveDrop', () => {
  const stage = { left: 100, top: 200, width: 400, height: 300 }
  it('maps the grab-corrected pointer to percent', () => {
    expect(resolveDrop({ x: 320, y: 380 }, { dx: 20, dy: 30 }, stage)).toEqual({ x: 50, y: 50 })
  })
  it('returns null outside the stage or for an empty stage', () => {
    expect(resolveDrop({ x: 99, y: 250 }, { dx: 0, dy: 0 }, stage)).toBeNull()
    expect(resolveDrop({ x: 300, y: 250 }, { dx: 0, dy: 0 }, { ...stage, width: 0 })).toBeNull()
  })
})

describe('frameToStage', () => {
  it('maps a file-percent box through the layer rect', () => {
    const r = frameToStage({ x: 25, y: 50, width: 50, height: 20 }, { x: 10, y: 20, width: 40, height: 60 })
    expect(r.centre).toEqual({ x: 30, y: 56 })
    expect(r.width).toBe(20)
  })
})

describe('placePiece', () => {
  it('writes width and an area around the centre', () => {
    const p = placePiece(piece({ id: 'a', ratio: 2 }), { x: 50, y: 50 }, 20, 1, 2)
    expect(p.width).toBe(20)
    expect(p.area).toEqual({ x: 38, y: 43, width: 24, height: 14 })
  })
  it('keeps a ratio-less piece proportional when its width changes', () => {
    const legacy = piece({ id: 'l', width: 10, area: { x: 43, y: 45.5, width: 14, height: 9 } }) // 10 x 5 on a 1:1 stage, tolerance 2
    const p = placePiece(legacy, { x: 50, y: 50 }, 20, 1, 2)
    expect(p.area.height).toBeCloseTo(10 + 4, 5)
    expect(p.area.width).toBeCloseTo(20 + 4, 5)
  })
})

describe('refitForAspect', () => {
  const bg = { color: '#000', aspect: 1, layers: [{ id: 'l', imageUrl: 'u', x: 30, y: 10, width: 40, height: 80, ratio: 0.5 }] }
  const p = placePiece(piece({ id: 'p', ratio: 1 }), { x: 50, y: 50 }, 10, 1, 3)
  it('keeps layer height and natural ratio, and scales pieces with the layer', () => {
    const out = refitForAspect(bg, [p], 2, 3)
    expect(out.background.aspect).toBe(2)
    expect(out.background.layers[0]).toMatchObject({ x: 40, y: 10, width: 20, height: 80 })
    expect(centreOf(out.pieces[0].area)).toEqual({ x: 50, y: 50 })
    expect(out.pieces[0].width).toBe(5)
    expect(out.pieces[0].area.height).toBeCloseTo(10 + 6, 5) // 5 wide * aspect 2 / ratio 1 = 10 tall + 2 * 3
  })
  it('leaves layers without a ratio alone', () => {
    const out = refitForAspect({ ...bg, layers: [{ ...bg.layers[0], ratio: undefined }] }, [p], 2, 3)
    expect(out.background.layers[0]).toMatchObject({ x: 30, width: 40 })
    expect(out.pieces[0].width).toBe(10)
  })
})

describe('swappable', () => {
  it('is true only when each centre sits in the other area', () => {
    const a = { centre: { x: 50, y: 50 }, area: { x: 40, y: 40, width: 20, height: 20 } }
    const b = { centre: { x: 55, y: 55 }, area: { x: 45, y: 45, width: 20, height: 20 } }
    const c = { centre: { x: 90, y: 90 }, area: { x: 0, y: 0, width: 100, height: 100 } }
    expect(swappable(a, b)).toBe(true)
    expect(swappable(a, c)).toBe(false)
  })
})

describe('pieceWarnings', () => {
  it('flags blank names, swappable pairs, off-canvas sprites and full-frame images', () => {
    const a = placePiece(piece({ id: 'a', label: ' ', ratio: 1 }), { x: 50, y: 50 }, 10, 1, 3)
    const b = placePiece(piece({ id: 'b', label: 'B', ratio: 1 }), { x: 52, y: 52 }, 10, 1, 3)
    const c = placePiece(piece({ id: 'c', label: 'C', ratio: 1 }), { x: 2, y: 50 }, 10, 1, DEFAULT_TOLERANCE)
    const w = pieceWarnings([a, b, c], 1, 3, new Set(['c']))
    expect(w.a).toEqual([{ code: 'noName' }, { code: 'swappable', with: [2] }])
    expect(w.b).toEqual([{ code: 'swappable', with: [1] }])
    expect(w.c).toEqual([{ code: 'offCanvas' }, { code: 'fullFrame' }])
  })
})
