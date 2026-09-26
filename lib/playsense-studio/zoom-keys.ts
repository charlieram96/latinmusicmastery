// PlaySense Studio — the measure zoom's keys as intents (spec §6, v6's zoom
// key handler). Pure: the zoom's editing hook maps each intent to a handler.
//
//   A–G a note (⇧ adds it to the chord) · 1–7 a value · R / 0 a rest ·
//   . dots · T triplet · + tie · S slur · N pencil · K keys panel ·
//   ←/→ walk (⇧ extends) · ⌘←/→ bar · ↑/↓ step (⇧ semitone, ⌘ octave) ·
//   ⌫ / Delete · Esc.
//
// ⌘ and Ctrl leave the letter and digit keys to the browser (⌘C, ⌘R, ⌘S…);
// ⌥ with a letter or digit is never an intent.

import { KEY_VALUE, type NoteValue } from './rhythm';

export type ZoomIntent =
  | { kind: 'letter'; letter: string; chord: boolean }
  | { kind: 'value'; value: NoteValue }
  | { kind: 'rest' } | { kind: 'dots' } | { kind: 'triplet' } | { kind: 'tie' } | { kind: 'slur' } | { kind: 'pencil' } | { kind: 'keys' }
  | { kind: 'walk'; dir: 1 | -1; extend: boolean } | { kind: 'bar'; dir: 1 | -1 }
  | { kind: 'transpose'; how: 'step' | 'semi' | 'oct'; dir: 1 | -1 }
  | { kind: 'delete'; back: boolean } | { kind: 'close' };

export interface ZoomKeyEvent { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean }

export function zoomIntent(e: ZoomKeyEvent): ZoomIntent | null {
  const { key } = e;
  const mod = e.metaKey || e.ctrlKey;

  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const dir = key === 'ArrowRight' ? 1 : -1;
      return mod ? { kind: 'bar', dir } : { kind: 'walk', dir, extend: e.shiftKey };
    }
    case 'ArrowUp':
    case 'ArrowDown':
      return { kind: 'transpose', how: mod ? 'oct' : e.shiftKey ? 'semi' : 'step', dir: key === 'ArrowUp' ? 1 : -1 };
    case 'Backspace':
      return { kind: 'delete', back: true };
    case 'Delete':
      return { kind: 'delete', back: false };
    case 'Escape':
      return { kind: 'close' };
  }

  if (/^[a-zA-Z0-9]$/.test(key) && e.altKey) return null;
  if (mod) return null;

  if (/^[a-gA-G]$/.test(key)) return { kind: 'letter', letter: key, chord: e.shiftKey };
  if (KEY_VALUE[key]) return { kind: 'value', value: KEY_VALUE[key] };
  switch (key) {
    case 'r': case 'R': case '0': return { kind: 'rest' };
    case '.': return { kind: 'dots' };
    case 't': case 'T': return { kind: 'triplet' };
    case '+': return { kind: 'tie' };
    case 's': case 'S': return { kind: 'slur' };
    case 'n': case 'N': return { kind: 'pencil' };
    case 'k': case 'K': return { kind: 'keys' };
  }
  return null;
}
