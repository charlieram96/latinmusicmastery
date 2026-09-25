// PlaySense Studio — pitch rules shared by the Studio's note entry: letters
// land on the octave nearest the previous note in the key; ↑/↓ steps follow
// the key; semitones respell by direction (♯ up, ♭ down); octaves keep the
// spelling. Staff index = octave*7 + step (C4 = 28).

import { keyAlter, spellMidi, STEP_SEMITONE } from './notation/accidentals';

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
type Alter = -2 | -1 | 0 | 1 | 2;
export interface Pitch { midi: number; spelling: { step: Step; alter: Alter } }

export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const clampMidi = (m: number) => Math.max(0, Math.min(127, m));

export function staffIndex(step: Step, octave: number): number {
  return octave * 7 + STEPS.indexOf(step);
}

export function fromStaffIndex(i: number): { step: Step; octave: number } {
  return { step: STEPS[((i % 7) + 7) % 7], octave: Math.floor(i / 7) };
}

export function spelledMidi(step: Step, alter: number, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
}

function keyPitch(i: number, keyFifths: number): Pitch {
  const { step, octave } = fromStaffIndex(i);
  const alter = keyAlter(step, keyFifths) as Alter;
  const midi = spelledMidi(step, alter, octave);
  const clamped = clampMidi(midi);
  // A clamp at the keyboard's edges (midi 0/127) can leave the computed
  // spelling naming a different pitch than the clamped midi; respell from
  // the clamped value, as semitonePitch does.
  if (clamped !== midi) {
    const s = spellMidi(clamped, { keyFifths });
    return { midi: clamped, spelling: { step: s.step as Step, alter: s.alter as Alter } };
  }
  return { midi: clamped, spelling: { step, alter } };
}

export function pitchIndex(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number): number {
  const s = spellMidi(midi, { spelling, keyFifths });
  return staffIndex(s.step as Step, s.octave);
}

export function letterPitch(letter: string, nearIndex: number, keyFifths: number): Pitch {
  const si = STEPS.indexOf(letter.toUpperCase() as Step);
  let best = 4 * 7 + si;
  for (let o = -1; o <= 9; o++) {
    const i = o * 7 + si;
    if (Math.abs(i - nearIndex) < Math.abs(best - nearIndex)) best = i;
  }
  return keyPitch(best, keyFifths);
}

export function letterAbove(letter: string, belowIndex: number, keyFifths: number): Pitch {
  const step = letter.toUpperCase() as Step;
  let i = belowIndex + 1;
  while (fromStaffIndex(i).step !== step) i++;
  return keyPitch(i, keyFifths);
}

export function stepPitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch {
  return keyPitch(pitchIndex(midi, spelling, keyFifths) + dir, keyFifths);
}

export function semitonePitch(midi: number, dir: 1 | -1, keyFifths: number): Pitch {
  const m = clampMidi(midi + dir);
  const s = spellMidi(m, { keyFifths });
  const step = s.step as Step;
  if (s.alter === 0 || keyAlter(step, keyFifths) === s.alter) return { midi: m, spelling: { step, alter: s.alter as Alter } };
  // An accidental outside the key: sharp going up, flat going down.
  const want = dir > 0 ? 1 : -1;
  if (s.alter === want) return { midi: m, spelling: { step, alter: s.alter as Alter } };
  const other = fromStaffIndex(staffIndex(step, s.octave) - want);
  return { midi: m, spelling: { step: other.step, alter: want as Alter } };
}

export function octavePitch(midi: number, spelling: Pitch['spelling'] | undefined, keyFifths: number, dir: 1 | -1): Pitch {
  const s = spellMidi(midi, { spelling, keyFifths });
  const target = midi + 12 * dir;
  const clamped = clampMidi(target);
  // As in keyPitch: a clamp at the keyboard's edges must respell from the
  // clamped midi, or the returned spelling would name a different pitch.
  if (clamped !== target) {
    const cs = spellMidi(clamped, { keyFifths });
    return { midi: clamped, spelling: { step: cs.step as Step, alter: cs.alter as Alter } };
  }
  return { midi: clamped, spelling: { step: s.step as Step, alter: s.alter as Alter } };
}

const ALTER_GLYPH: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export function pitchName(midi: number, spelling?: Pitch['spelling'], keyFifths = 0): string {
  const s = spellMidi(midi, { spelling, keyFifths });
  return `${s.step}${ALTER_GLYPH[s.alter]}${s.octave}`;
}

const SHARP_PARTS: Array<[Step, number]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

export function midiToParts(midi: number): { letter: Step; accidental: number; octave: number } {
  const [letter, accidental] = SHARP_PARTS[((midi % 12) + 12) % 12];
  return { letter, accidental, octave: Math.floor(midi / 12) - 1 };
}

export const CLEF_REF_INDEX = {
  treble: staffIndex('B', 4),
  bass: staffIndex('D', 3),
  alto: staffIndex('C', 4),
  tenor: staffIndex('A', 3),
  percussion: staffIndex('B', 4),
} as const;
