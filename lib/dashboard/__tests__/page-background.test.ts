import { describe, expect, it } from 'vitest'
import { buildBackgroundArt } from '../page-background'

describe('buildBackgroundArt', () => {
  it('is deterministic for a seed', () => {
    expect(buildBackgroundArt(3)).toEqual(buildBackgroundArt(3))
    expect(buildBackgroundArt(3)).not.toEqual(buildBackgroundArt(4))
  })

  it('draws three staves of five lines each', () => {
    const art = buildBackgroundArt(3)
    expect(art.staves).toHaveLength(15)
    for (const d of art.staves) expect(d.startsWith('M')).toBe(true)
  })

  it('scatters 16 notes inside the canvas', () => {
    const art = buildBackgroundArt(3, 1600, 1200)
    expect(art.notes).toHaveLength(16)
    for (const n of art.notes) {
      expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x).toBeLessThanOrEqual(1600)
      expect(n.y).toBeGreaterThanOrEqual(0); expect(n.y).toBeLessThanOrEqual(1200)
      expect(Math.abs(n.rotate)).toBeLessThanOrEqual(20)
    }
  })

  it('draws a 2-3 son clave: five strokes, grouped 2 then 3', () => {
    const { clave } = buildBackgroundArt(3)
    expect(clave).toHaveLength(5)
    const gaps = clave.slice(1).map((c, i) => c.cx - clave[i].cx)
    expect(gaps[1]).toBeGreaterThan(gaps[0]) // the break between the 2 side and the 3 side
  })
})
