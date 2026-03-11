import type { PitchedInstrument } from './types'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Convert MIDI note number to note name (e.g. 60 → "C4") */
export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor((midi - 12) / 12)
  return `${note}${octave}`
}

/** Convert note name to MIDI number (e.g. "C4" → 60) */
export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-Ga-g]#?)(\d+)$/)
  if (!match) return 60
  const noteName = match[1].toUpperCase()
  const octave = parseInt(match[2], 10)
  const noteIndex = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number])
  if (noteIndex === -1) return 60
  return (octave + 1) * 12 + noteIndex
}

/** Convert MIDI note number to VexFlow key (e.g. 60 → "c/4") */
export function midiToVexKey(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12].toLowerCase()
  const octave = Math.floor((midi - 12) / 12)
  return `${note}/${octave}`
}

/** Check if a MIDI note is a black key */
export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12
  return [1, 3, 6, 8, 10].includes(pc)
}

/** Note ranges (MIDI) per pitched instrument */
export const INSTRUMENT_NOTE_RANGES: Record<PitchedInstrument, { min: number; max: number }> = {
  guitar: { min: 48, max: 84 },    // C3 - C6
  bass: { min: 28, max: 55 },      // E1 - G3
  piano: { min: 48, max: 84 },     // C3 - C6
  tres: { min: 52, max: 79 },      // E3 - G5
  cuatro: { min: 52, max: 79 },    // E3 - G5
  trumpet: { min: 55, max: 82 },   // G3 - A#5
  saxophone: { min: 49, max: 80 }, // C#3 - G#5
  flute: { min: 60, max: 96 },     // C4 - C7
  violin: { min: 55, max: 93 },    // G3 - A6
}
