import { describe, expect, it } from 'vitest'
import { sleeveLook, SLEEVE_PALETTES } from '../sleeve'

describe('sleeveLook', () => {
  it('is deterministic for a seed', () => {
    expect(sleeveLook('Son Cubanotimbal')).toEqual(sleeveLook('Son Cubanotimbal'))
  })
  it('always returns a palette from the set and a non-empty motif (no negative indexes)', () => {
    for (const seed of ['a', 'Son Cubano', 'Reggaeton Drums', 'x'.repeat(80), 'ñandú', 'clave-feature']) {
      const look = sleeveLook(seed)
      expect(SLEEVE_PALETTES).toContainEqual({ bg: look.bg, ink: look.ink })
      expect(look.motif.length).toBeGreaterThan(10)
    }
  })
  it('spreads seeds across palettes', () => {
    const bgs = new Set(Array.from({ length: 40 }, (_, i) => sleeveLook('seed' + i).bg))
    expect(bgs.size).toBeGreaterThan(4)
  })
})
