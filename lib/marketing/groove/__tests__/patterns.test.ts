import { describe, expect, it } from 'vitest'
import { CLAVES, ROOT, antic, chordAt, detectClave, initialPattern, toggleCell, vel, withClave } from '../patterns'

const hits = (row: readonly unknown[]) => row.flatMap((v, i) => (v ? [i] : []))

describe('clave presets', () => {
  it('places the five strokes of each clave', () => {
    expect(hits(withClave(initialPattern(), 'son32').clave)).toEqual([0, 3, 6, 10, 12])
    expect(hits(withClave(initialPattern(), 'son23').clave)).toEqual([2, 4, 8, 11, 14])
    expect(hits(withClave(initialPattern(), 'rumba32').clave)).toEqual([0, 3, 7, 10, 12])
  })
  it('starts on son 3-2', () => {
    expect(hits(initialPattern().clave)).toEqual(CLAVES.son32)
    expect(detectClave(initialPattern())).toBe('son32')
  })
  it('recognises no preset once a clave cell is edited', () => {
    const p = toggleCell(initialPattern(), 'clave', 1)
    expect(detectClave(p)).toBeNull()
  })
})

describe('chords', () => {
  it('walks C F G F one chord per beat (four steps)', () => {
    expect([0, 3, 4, 7, 8, 11, 12, 15].map(chordAt)).toEqual(['C', 'C', 'F', 'F', 'G', 'G', 'F', 'F'])
  })
  it('wraps any step, including negative ones', () => {
    expect(chordAt(16)).toBe('C')
    expect(chordAt(-1)).toBe('F')
  })
  it('anticipates the next chord on the last sixteenth of each beat', () => {
    expect(antic(3)).toBe('F')
    expect(antic(7)).toBe('G')
    expect(antic(11)).toBe('F')
    expect(antic(15)).toBe('C')
    expect(antic(2)).toBe('C')
  })
})

describe('velocity', () => {
  const p = initialPattern()
  it('scales conga heel, slap and open tones', () => {
    expect(vel(p, 'conga', 0)).toBe(0.32) // h
    expect(vel(p, 'conga', 2)).toBe(0.78) // s
    expect(vel(p, 'conga', 6)).toBe(1) // o
    expect(vel(p, 'conga', 7)).toBe(1) // O
  })
  it('accents piano high voicings', () => {
    expect(vel(p, 'piano', 3)).toBe(0.9)
    expect(vel(p, 'piano', 1)).toBe(0.7)
    expect(vel(p, 'piano', 0)).toBe(0)
  })
  it('plays bass at full and campana at its stored level', () => {
    expect(vel(p, 'bajo', 3)).toBe(1)
    expect(vel(p, 'bajo', 0)).toBe(0)
    expect(vel(p, 'campana', 0)).toBe(1)
    expect(vel(p, 'campana', 2)).toBe(0.55)
    expect(vel(p, 'clave', 0)).toBe(1)
  })
})

describe('toggleCell', () => {
  it('cycles a conga cell h → o → s → off → o', () => {
    let p = initialPattern()
    expect(p.conga[0]).toBe('h')
    p = toggleCell(p, 'conga', 0); expect(p.conga[0]).toBe('o')
    p = toggleCell(p, 'conga', 0); expect(p.conga[0]).toBe('s')
    p = toggleCell(p, 'conga', 0); expect(p.conga[0]).toBe(0)
    p = toggleCell(p, 'conga', 0); expect(p.conga[0]).toBe('o')
  })
  it('turns a low open tone (O) off, as the prototype does', () => {
    expect(toggleCell(initialPattern(), 'conga', 7).conga[7]).toBe(0)
  })
  it("sets a bass note to the next chord's root", () => {
    const p = initialPattern()
    expect(toggleCell(p, 'bajo', 0).bajo[0]).toBe(ROOT.C)
    expect(toggleCell(p, 'bajo', 2).bajo[2]).toBe(ROOT.C)
    expect(toggleCell(p, 'bajo', 7).bajo[7]).toBe(ROOT.G)
    expect(toggleCell(p, 'bajo', 15).bajo[15]).toBe(ROOT.C)
    expect(toggleCell(p, 'bajo', 3).bajo[3]).toBe(0)
  })
  it('toggles piano to a high voicing and off', () => {
    const p = toggleCell(initialPattern(), 'piano', 0)
    expect(p.piano[0]).toBe('h')
    expect(toggleCell(p, 'piano', 0).piano[0]).toBe(0)
  })
  it('gives new campana hits a downbeat accent', () => {
    let p = toggleCell(initialPattern(), 'campana', 0)
    expect(p.campana[0]).toBe(0)
    p = toggleCell(p, 'campana', 0); expect(p.campana[0]).toBe(1)
    expect(toggleCell(initialPattern(), 'campana', 1).campana[1]).toBe(0.55)
  })
  it('never mutates the input pattern', () => {
    const p = initialPattern()
    const before = JSON.stringify(p)
    toggleCell(p, 'clave', 0); toggleCell(p, 'conga', 0); withClave(p, 'rumba32')
    expect(JSON.stringify(p)).toBe(before)
  })
})
