/**
 * Data and timing for the "Prefer the chart?" staff demo on /playsense: a
 * two-bar son bass tumbao (C F G F), walked by a playhead in eighth-note
 * steps, with simulated student timing. Ported from the prototype's
 * mountWS/tickWS.
 */

export const BPM = 120
/** Eighth-note steps in the two-bar loop. */
export const STEPS = 16
export const CHORDS = ['C', 'F', 'G', 'F']
/** Step of each engraved note/rest, in drawing order (bar 1 then bar 2). */
export const NOTE_STEPS = [0, 2, 3, 4, 6, 8, 10, 11, 12, 14]
/** Steps where the bass attacks (the anticipated tumbao). */
export const ONSETS = [3, 6, 11, 14]
/** Simulated student offsets in ms, cycled. */
const OFFSETS = [4, -7, 12, 3, -2, 26, 6, -5, 2, 9, -9, 5, 1, -3, 31, 8, -6, 0, 3, 14]
export const COUNTS = Array.from({ length: STEPS }, (_, s) => (s % 2 ? '&' : String((s % 8) / 2 + 1)))

/** [step, x px] pairs laid out by the engraver. */
export type Anchor = [number, number]

export function judge(i: number): { offset: number; ok: boolean; perfect: boolean } {
  const offset = OFFSETS[i % OFFSETS.length]
  const ok = Math.abs(offset) <= 20
  return { offset, ok, perfect: ok && Math.abs(offset) <= 5 }
}

/** x position of a (fractional) step, interpolated between engraved anchors. */
export function stepX(anchors: Anchor[], p: number): number {
  if (!anchors.length) return 0
  for (let i = 0; i < anchors.length - 1; i++) {
    const [s0, x0] = anchors[i], [s1, x1] = anchors[i + 1]
    if (p >= s0 && p <= s1) return x0 + (x1 - x0) * ((p - s0) / (s1 - s0 || 1))
  }
  return anchors[0][1]
}

const stepSeconds = (bpm: number) => 60 / bpm / 2

/** Fractional step within the loop after `seconds`. */
export function playheadStep(seconds: number, bpm: number): number {
  return (seconds / stepSeconds(bpm)) % STEPS
}

/** Completed loops after `seconds`. */
export function loopOf(seconds: number, bpm: number): number {
  return Math.floor(seconds / stepSeconds(bpm) / STEPS)
}
