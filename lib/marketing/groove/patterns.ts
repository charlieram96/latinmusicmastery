/**
 * The home page groove: five parts of a son montuno on a 16-step grid (one
 * two-bar clave cycle in eighth notes, four steps per chord). Pure data and
 * rules, ported from the prototype's `PAT`, `CLAVES`,
 * `CHORDS`, `chordAt`, `antic`, `vel` and the cell-toggle handler.
 */

export const INST_IDS = ['clave', 'campana', 'conga', 'bajo', 'piano'] as const
export type InstId = (typeof INST_IDS)[number]

export const CLAVES = { son32: [0, 3, 6, 10, 12], son23: [2, 4, 8, 11, 14], rumba32: [0, 3, 7, 10, 12] } as const
export type ClaveKey = keyof typeof CLAVES

export const CHORDS = ['C', 'F', 'G', 'F'] as const
export type Chord = 'C' | 'F' | 'G'
/** Bass root MIDI note per chord. */
export const ROOT: Record<Chord, number> = { C: 48, F: 41, G: 43 }
/** Piano montuno voicings: high (h) and low (l) grips. */
export const VOICE: Record<Chord, { h: number[]; l: number[] }> = {
  C: { h: [64, 67, 72], l: [60, 72] },
  F: { h: [65, 69, 72], l: [53, 65] },
  G: { h: [62, 67, 71], l: [55, 67] },
}

export type CongaHit = 'h' | 's' | 'o' | 'O' | 0
export type PianoHit = 'h' | 'l' | 0

export interface Pattern {
  clave: number[]
  campana: number[]
  conga: CongaHit[]
  /** MIDI note or 0. */
  bajo: number[]
  piano: PianoHit[]
}

export const STEPS = 16

export const chordAt = (s: number): Chord => CHORDS[Math.floor((((s % STEPS) + STEPS) % STEPS) / 4)]
/** The chord the piano plays at step `s`: the last sixteenth of a beat anticipates the next chord. */
export const antic = (s: number): Chord => (s % 4 === 3 ? chordAt(s + 1) : chordAt(s))

export function withClave(p: Pattern, key: ClaveKey): Pattern {
  const clave = Array<number>(STEPS).fill(0)
  for (const i of CLAVES[key]) clave[i] = 1
  return { ...p, clave }
}

export function initialPattern(clave: ClaveKey = 'son32'): Pattern {
  return withClave({
    clave: [],
    campana: [1, 0, 0.55, 0, 1, 0, 0.55, 0, 1, 0, 0.55, 0, 1, 0, 0.55, 0],
    conga: ['h', 'h', 's', 'h', 'h', 'h', 'o', 'O', 'h', 'h', 's', 'h', 'h', 'h', 'o', 'O'],
    bajo: [0, 0, 0, 41, 0, 0, 43, 0, 0, 0, 0, 41, 0, 0, 48, 0],
    piano: [0, 'l', 0, 'h', 'l', 0, 'h', 'l', 0, 'l', 0, 'h', 'l', 0, 'h', 'l'],
  }, clave)
}

/** Which preset the clave row matches, or null once it has been edited. */
export function detectClave(p: Pattern): ClaveKey | null {
  const on = p.clave.flatMap((v, i) => (v ? [i] : [])).join(',')
  for (const k of Object.keys(CLAVES) as ClaveKey[]) if (CLAVES[k].join(',') === on) return k
  return null
}

/** Loudness 0..1 of part `id` at step `s` (0 = silent). */
export function vel(p: Pattern, id: InstId, s: number): number {
  const v = p[id][s]
  if (!v) return 0
  if (id === 'conga') return v === 'h' ? 0.32 : v === 's' ? 0.78 : 1
  if (id === 'piano') return v === 'h' ? 0.9 : 0.7
  if (id === 'bajo') return 1
  return v as number
}

/** Tap a cell: returns a new pattern with that cell cycled per the part's rule. */
export function toggleCell(p: Pattern, id: InstId, s: number): Pattern {
  switch (id) {
    case 'conga': {
      const cur = p.conga[s]
      const next: CongaHit = cur === 'h' || !cur ? 'o' : cur === 'o' ? 's' : 0
      return { ...p, conga: replace(p.conga, s, next) }
    }
    case 'bajo': return { ...p, bajo: replace(p.bajo, s, p.bajo[s] ? 0 : ROOT[chordAt(s + 1)]) }
    case 'piano': return { ...p, piano: replace<PianoHit>(p.piano, s, p.piano[s] ? 0 : 'h') }
    case 'campana': return { ...p, campana: replace(p.campana, s, p.campana[s] ? 0 : s % 4 === 0 ? 1 : 0.55) }
    case 'clave': return { ...p, clave: replace(p.clave, s, p.clave[s] ? 0 : 1) }
  }
}

function replace<T>(row: T[], i: number, v: T): T[] {
  const out = row.slice()
  out[i] = v
  return out
}
