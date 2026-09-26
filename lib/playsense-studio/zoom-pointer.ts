// PlaySense Studio — pointer math for the measure zoom (v6's pitchAtY and
// focusPointerMove): a stave line to a staff index, a vertical drag to
// diatonic steps, and a percussion drag snapped to the nearest stroke line
// (moved here unchanged from the measure strip's old pitch drag).

import type { PercStroke } from './perc-strokes';
import { stepPitch, type Pitch } from './pitch';
import type { NotationClef } from './score-to-vexflow';

/** The staff index (octave*7 + step, C4 = 28) of each clef's top line. */
export const CLEF_TOP_INDEX: Record<NotationClef, number> = {
  treble: 38, // F5
  bass: 26, // A3
  alto: 32, // G4
  tenor: 30, // E4
  percussion: 38, // F5
};

/** The staff index at stave `line` (0 = top line, down positive), rounded to half-lines. */
export function indexForLine(line: number, clef: keyof typeof CLEF_TOP_INDEX): number {
  return CLEF_TOP_INDEX[clef] - Math.round(line * 2);
}

/** Diatonic steps for a drag from y0 to y (up is positive). */
export function dragSteps(y0: number, y: number, pxPerStep: number): number {
  return Math.round((y0 - y) / pxPerStep) || 0; // never -0
}

/** Every note of a chord moved `steps` diatonic steps in the key. */
export function stepPitches(notes: SpelledPitch[], steps: number, keyFifths: number): SpelledPitch[] {
  const dir: 1 | -1 = steps < 0 ? -1 : 1;
  return notes.map((n) => {
    let p: SpelledPitch = { midi: n.midi, spelling: n.spelling };
    for (let k = 0; k < Math.abs(steps); k++) p = stepPitch(p.midi, p.spelling, keyFifths, dir);
    return p;
  });
}

export interface SpelledPitch { midi: number; spelling?: Pitch['spelling'] }

// Parse a VexFlow key string ('g/5', 'c#/4') to a continuous diatonic index
// (octave*7 + letterIndex).
const LETTER_TO_INDEX: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
function keyToDiatonic(key: string): number {
  const m = key.match(/^([a-gA-G])[#b]?\/(-?\d+)$/);
  if (!m) return 0;
  return Number(m[2]) * 7 + (LETTER_TO_INDEX[m[1].toLowerCase()] ?? 0);
}

/**
 * A percussion drag: the stroke whose line is nearest `deltaSteps` from the
 * original stroke's line, preferring the original's notehead on a tie.
 */
export function snapStroke(percStrokes: PercStroke[], originalMidi: number, deltaSteps: number): number {
  if (deltaSteps === 0 || percStrokes.length === 0) return originalMidi;
  const original = percStrokes.find((s) => s.midi === originalMidi);
  const targetDia = keyToDiatonic(original?.staffLine ?? 'c/5') + deltaSteps;
  let best = original ?? percStrokes[0];
  let bestDist = Infinity;
  for (const s of percStrokes) {
    const d = Math.abs(keyToDiatonic(s.staffLine) - targetDia);
    const sameHead = (s.notehead ?? s.noteType) === (original?.notehead ?? original?.noteType);
    const bestSameHead = (best.notehead ?? best.noteType) === (original?.notehead ?? original?.noteType);
    if (d < bestDist || (d === bestDist && sameHead && !bestSameHead)) {
      bestDist = d;
      best = s;
    }
  }
  return best.midi;
}
