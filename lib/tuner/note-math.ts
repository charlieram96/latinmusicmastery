/**
 * Pure note math for the tuner: MIDI ↔ Hz ↔ cents, note naming in letters or
 * solfège, and the shared in-tune verdict. No DOM, no Web Audio.
 */

export type NoteNames = 'letters' | 'solfege'

export const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
export const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'] as const

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export type Verdict = 'ok' | 'warn' | 'bad'

/** Equal-temperament frequency of a MIDI note for a given A4 reference. */
export function midiToHz(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

/** Fractional MIDI number of a frequency (69 = A4). */
export function hzToMidiFloat(hz: number, a4 = 440): number {
  return 69 + 12 * Math.log2(hz / a4)
}

/** Signed cents of `hz` relative to `targetHz` (positive = sharp). */
export function centsBetween(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz)
}

/** Parse "E2", "F#4", "Bb3", "B0" into a MIDI number. Throws on bad input. */
export function nameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim())
  if (!m) throw new Error(`Bad note name: ${name}`)
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (parseInt(m[3], 10) + 1) * 12 + PITCH_CLASS[m[1].toUpperCase()] + accidental
}

/** Split a MIDI note into display parts for the chosen naming system. */
export function noteParts(midi: number, names: NoteNames): { base: string; acc: '' | '♯'; oct: number; pc: number } {
  const pc = ((midi % 12) + 12) % 12
  const raw: string = (names === 'solfege' ? SOLFEGE : LETTERS)[pc]
  const acc: '' | '♯' = raw.endsWith('♯') ? '♯' : ''
  return { base: acc ? raw.slice(0, -1) : raw, acc, oct: Math.floor(midi / 12) - 1, pc }
}

/** "F♯4" / "Fa♯4" */
export function noteLabel(midi: number, names: NoteNames): string {
  const p = noteParts(midi, names)
  return `${p.base}${p.acc}${p.oct}`
}

/** In-tune verdict shared by the glyph, pill, readouts, meter and pads. */
export function verdictFor(cents: number, tol: number): Verdict {
  const a = Math.abs(cents)
  return a <= tol ? 'ok' : a <= 15 ? 'warn' : 'bad'
}

/** "+12" / "−3" / "0" (typographic minus). */
export function formatCents(cents: number): string {
  const r = Math.round(cents)
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r)
}
