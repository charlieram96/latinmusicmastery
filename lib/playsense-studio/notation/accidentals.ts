// Spell pitches and decide which accidentals to print (spec §4.2): the key
// signature plus accidentals remembered within the bar, per step and octave.
import type { Spelling } from '@/components/playsense-studio/shared/score-model/types'
import { parseSpellingHint } from '@/components/playsense-studio/shared/score-model/accessors'
import { midiToKeyString } from '../score-to-vexflow'

export type AccidentalCode = '#' | 'b' | 'n' | '##' | 'bb'
export interface SpelledPitch { step: Spelling['step']; alter: Spelling['alter']; octave: number; showAccidental?: 'auto' | 'always' }

const STEP_SEMITONE: Record<Spelling['step'], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ALTER_TEXT: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }
const ALTER_CODE: Record<number, AccidentalCode> = { [-2]: 'bb', [-1]: 'b', 0: 'n', 1: '#', 2: '##' }
const SHARP_ORDER = 'FCGDAEB'
const FLAT_ORDER = 'BEADGCF'
const KEY_NAMES: Record<number, string> = { [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' }

function octaveFor(midi: number, step: Spelling['step'], alter: number): number {
  return Math.floor((midi - alter - STEP_SEMITONE[step]) / 12) - 1
}

export function spellMidi(midi: number, opts: { spelling?: Spelling; spellingHint?: string; keyFifths: number }): SpelledPitch {
  const s = opts.spelling ?? parseSpellingHint(opts.spellingHint)
  if (s) {
    return { step: s.step, alter: s.alter, octave: octaveFor(midi, s.step, s.alter), ...(s.showAccidental ? { showAccidental: s.showAccidental } : {}) }
  }
  const key = midiToKeyString(midi, { keyFifths: opts.keyFifths }) // e.g. 'bb/4', 'c#/5'
  const m = /^([a-g])(#|b)?\/(-?\d+)$/.exec(key)!
  const step = m[1].toUpperCase() as Spelling['step']
  const alter = (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) as Spelling['alter']
  return { step, alter, octave: Number(m[3]) }
}

export function keyAlter(step: Spelling['step'], keyFifths: number): -1 | 0 | 1 {
  if (keyFifths > 0) return SHARP_ORDER.slice(0, keyFifths).includes(step) ? 1 : 0
  if (keyFifths < 0) return FLAT_ORDER.slice(0, -keyFifths).includes(step) ? -1 : 0
  return 0
}

export function vexKey(p: SpelledPitch): string {
  return `${p.step.toLowerCase()}${ALTER_TEXT[p.alter]}/${p.octave}`
}

export function keySignatureName(keyFifths: number): string {
  return KEY_NAMES[Math.max(-7, Math.min(7, Math.round(keyFifths)))]
}

export function createAccidentalMemory(keyFifths: number) {
  const seen = new Map<string, number>()
  return {
    code(p: SpelledPitch, opts: { tiedFromSame?: boolean } = {}): AccidentalCode | null {
      const slot = `${p.step}${p.octave}`
      const expected = seen.has(slot) ? seen.get(slot)! : keyAlter(p.step, keyFifths)
      seen.set(slot, p.alter)
      if (opts.tiedFromSame) return null
      if (p.alter !== expected || p.showAccidental === 'always') return ALTER_CODE[p.alter]
      return null
    },
  }
}
