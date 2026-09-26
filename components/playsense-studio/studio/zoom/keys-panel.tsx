'use client';

// PlaySense Studio — the measure zoom's Keys panel (K): an on-screen 2-octave
// keyboard, an octave shift, and the MIDI keyboard's status line (spec §6,
// Task 5). This component only turns a click into a midi number; whether that
// midi becomes a spelled pitch or a percussion stroke is use-zoom-editing's
// job (onPitch, the function a MIDI note-on drives through the chord grouper).
// A click always enters a new note; chords come from a MIDI keyboard, or ⇧ with
// a letter.
//
// Buttons take focus out of the loop with onMouseDown's preventDefault, so the
// zoom's own keydown listener (registered on window) keeps working.

import type { MouseEvent as ReactMouseEvent } from 'react';

export type MidiKeysStatus = 'idle' | 'ready' | 'unavailable';

export interface KeysPanelProps {
  onPitch: (midi: number) => void;
  /** Percussion: the keys are General MIDI drum notes, mapped to the track's strokes. */
  percussion: boolean;
  status: MidiKeysStatus;
  /** The on-screen keyboard's lower octave (C{octave}..B{octave+1}); clamped MIN_OCTAVE..MAX_OCTAVE. */
  octave: number;
  onOctave: (delta: number) => void;
}

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 7;
export const DEFAULT_OCTAVE = 4;

export const MSG_MIDI_READY = 'MIDI keyboard ready';
export const MSG_MIDI_FALLBACK = 'No MIDI keyboard — use the keys below';
export const MSG_MIDI_LOOKING = 'Looking for a MIDI keyboard…';
export const MSG_GM_DRUMS = 'Keys play General MIDI drums';

interface KeyDef { name: string; semitone: number }

const WHITE_KEYS: KeyDef[] = [
  { name: 'C', semitone: 0 }, { name: 'D', semitone: 2 }, { name: 'E', semitone: 4 },
  { name: 'F', semitone: 5 }, { name: 'G', semitone: 7 }, { name: 'A', semitone: 9 }, { name: 'B', semitone: 11 },
];
// Left offset in white-key widths from the start of the octave.
const BLACK_KEYS: (KeyDef & { offset: number })[] = [
  { name: 'C♯', semitone: 1, offset: 0.65 },
  { name: 'D♯', semitone: 3, offset: 1.65 },
  { name: 'F♯', semitone: 6, offset: 3.6 },
  { name: 'G♯', semitone: 8, offset: 4.55 },
  { name: 'A♯', semitone: 10, offset: 5.5 },
];
const WHITE_KEY_WIDTH = 26;
const BLACK_KEY_WIDTH = 16;
const OCTAVES = [0, 1];

/** C{octave} as a midi number (C4 = 60, matching spellMidi's octave numbering). */
function octaveMidi(octave: number): number {
  return (octave + 1) * 12;
}

const stopFocus = (e: ReactMouseEvent) => e.preventDefault();

export function KeysPanel({ onPitch, percussion, status, octave, onOctave }: KeysPanelProps) {
  const base = octaveMidi(octave);

  const press = (midi: number) => (e: ReactMouseEvent) => {
    e.preventDefault();
    onPitch(midi);
  };

  return (
    <div className="st-keys-panel" data-testid="keys-panel">
      <div className="st-keys-status" role="status">
        {status === 'ready' ? MSG_MIDI_READY : status === 'idle' ? MSG_MIDI_LOOKING : MSG_MIDI_FALLBACK}
        {percussion && <> · {MSG_GM_DRUMS}</>}
      </div>
      <div className="st-keys-octave">
        <button
          type="button"
          disabled={octave <= MIN_OCTAVE}
          onMouseDown={stopFocus}
          onClick={() => onOctave(-1)}
        >
          ◀ Octave
        </button>
        <span data-testid="keys-range">C{octave}–B{octave + 1}</span>
        <button
          type="button"
          disabled={octave >= MAX_OCTAVE}
          onMouseDown={stopFocus}
          onClick={() => onOctave(1)}
        >
          Octave ▶
        </button>
      </div>
      <div className="st-keys-board" style={{ width: OCTAVES.length * WHITE_KEYS.length * WHITE_KEY_WIDTH }}>
        {OCTAVES.flatMap((oct) => WHITE_KEYS.map((k) => {
          const midi = base + oct * 12 + k.semitone;
          return (
            <button
              key={midi}
              type="button"
              className="st-key-white"
              data-testid={`key-${midi}`}
              title={`${k.name}${octave + oct}`}
              onMouseDown={stopFocus}
              onClick={press(midi)}
            >
              {k.name}
            </button>
          );
        }))}
        {OCTAVES.flatMap((oct) => BLACK_KEYS.map((k) => {
          const midi = base + oct * 12 + k.semitone;
          return (
            <button
              key={midi}
              type="button"
              className="st-key-black"
              data-testid={`key-${midi}`}
              title={`${k.name}${octave + oct}`}
              style={{ left: (oct * WHITE_KEYS.length + k.offset) * WHITE_KEY_WIDTH, width: BLACK_KEY_WIDTH }}
              onMouseDown={stopFocus}
              onClick={press(midi)}
            >
              {k.name}
            </button>
          );
        }))}
      </div>
    </div>
  );
}
