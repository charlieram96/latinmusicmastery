import { noteNameToMidi } from '@/lib/play-sense/pitch-utils'

export type TunerInstrument = 'Guitar' | 'Bass' | 'Piano' | 'Violin' | 'Tres'

export const TUNER_INSTRUMENTS: TunerInstrument[] = ['Guitar', 'Bass', 'Piano', 'Violin', 'Tres']

/**
 * Open-string layout per instrument, low → high.
 * Piano is chromatic (no fixed strings) and is intentionally omitted.
 */
export const INSTRUMENT_STRINGS: Partial<Record<TunerInstrument, string[]>> = {
  Guitar: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  Bass: ['E1', 'A1', 'D2', 'G2'],
  Violin: ['G3', 'D4', 'A4', 'E5'],
  Tres: ['G4', 'C4', 'E4'],
}

/** Equal-temperament frequency for a MIDI note relative to a tunable A4 reference. */
export function noteToFrequency(midi: number, refPitch = 440): number {
  return refPitch * 2 ** ((midi - 69) / 12)
}

/** Target frequency for a note name (e.g. "E2") at the given reference pitch. */
export function noteNameToFrequency(name: string, refPitch = 440): number {
  return noteToFrequency(noteNameToMidi(name), refPitch)
}

/** Signed cents deviation of `freq` from `targetFreq` (positive = sharp). */
export function centsBetween(freq: number, targetFreq: number): number {
  return 1200 * Math.log2(freq / targetFreq)
}

/**
 * Index of the open string nearest (in cents) to the detected frequency,
 * or -1 if there are no strings or no frequency. Used to highlight the
 * string the player is currently sounding.
 */
export function nearestStringIndex(
  freq: number | null,
  strings: string[] | undefined,
  refPitch: number
): number {
  if (freq === null || !strings || strings.length === 0) return -1
  let best = -1
  let bestAbs = Infinity
  strings.forEach((name, i) => {
    const abs = Math.abs(centsBetween(freq, noteNameToFrequency(name, refPitch)))
    if (abs < bestAbs) {
      bestAbs = abs
      best = i
    }
  })
  return best
}

/** Tuning verdict buckets shared by the meter, readout, and pads. */
export type TuneVerdict = 'in-tune' | 'slightly-flat' | 'slightly-sharp' | 'flat' | 'sharp'

export function verdictForCents(cents: number | null): TuneVerdict | null {
  if (cents === null) return null
  const abs = Math.abs(cents)
  if (abs < 5) return 'in-tune'
  if (cents > 0) return abs > 20 ? 'sharp' : 'slightly-sharp'
  return abs > 20 ? 'flat' : 'slightly-flat'
}
