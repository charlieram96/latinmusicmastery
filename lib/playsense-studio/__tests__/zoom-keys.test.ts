import { describe, expect, it } from 'vitest';
import { zoomIntent, type ZoomIntent } from '../zoom-keys';

type K = { key: string; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
const ev = (k: K) => ({ shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...k });

const rows: Array<[K, ZoomIntent | null]> = [
  // Pitch keys.
  [{ key: 'c' }, { kind: 'letter', letter: 'c', chord: false }],
  [{ key: 'G' }, { kind: 'letter', letter: 'G', chord: false }],
  [{ key: 'F', shiftKey: true }, { kind: 'letter', letter: 'F', chord: true }],
  [{ key: 'c', metaKey: true }, null],
  [{ key: 'a', ctrlKey: true }, null],
  [{ key: 'e', altKey: true }, null],
  [{ key: 'h' }, null],
  [{ key: 'x' }, null],
  // Durations.
  [{ key: '1' }, { kind: 'value', value: '64' }],
  [{ key: '2' }, { kind: 'value', value: '32' }],
  [{ key: '3' }, { kind: 'value', value: '16' }],
  [{ key: '4' }, { kind: 'value', value: '8' }],
  [{ key: '5' }, { kind: 'value', value: 'q' }],
  [{ key: '6' }, { kind: 'value', value: 'h' }],
  [{ key: '7' }, { kind: 'value', value: 'w' }],
  [{ key: '8' }, null],
  [{ key: '5', metaKey: true }, null],
  [{ key: '5', ctrlKey: true }, null],
  [{ key: '5', altKey: true }, null],
  // Rests, dots, tuplet, tie, slur.
  [{ key: 'r' }, { kind: 'rest' }],
  [{ key: 'R', shiftKey: true }, { kind: 'rest' }],
  [{ key: '0' }, { kind: 'rest' }],
  [{ key: 'r', metaKey: true }, null],
  [{ key: '.' }, { kind: 'dots' }],
  [{ key: 't' }, { kind: 'triplet' }],
  [{ key: 'T', shiftKey: true }, { kind: 'triplet' }],
  [{ key: '+', shiftKey: true }, { kind: 'tie' }],
  [{ key: 's' }, { kind: 'slur' }],
  [{ key: 'S', shiftKey: true }, { kind: 'slur' }],
  [{ key: 's', metaKey: true }, null],
  // Navigation.
  [{ key: 'ArrowRight', ctrlKey: true }, { kind: 'bar', dir: 1 }],
  [{ key: 'ArrowLeft', metaKey: true }, { kind: 'bar', dir: -1 }],
  [{ key: 'ArrowRight' }, { kind: 'walk', dir: 1, extend: false }],
  [{ key: 'ArrowLeft' }, { kind: 'walk', dir: -1, extend: false }],
  [{ key: 'ArrowLeft', shiftKey: true }, { kind: 'walk', dir: -1, extend: true }],
  [{ key: 'ArrowUp' }, { kind: 'transpose', how: 'step', dir: 1 }],
  [{ key: 'ArrowDown' }, { kind: 'transpose', how: 'step', dir: -1 }],
  [{ key: 'ArrowUp', shiftKey: true }, { kind: 'transpose', how: 'semi', dir: 1 }],
  [{ key: 'ArrowDown', shiftKey: true }, { kind: 'transpose', how: 'semi', dir: -1 }],
  [{ key: 'ArrowUp', metaKey: true }, { kind: 'transpose', how: 'oct', dir: 1 }],
  [{ key: 'ArrowDown', ctrlKey: true }, { kind: 'transpose', how: 'oct', dir: -1 }],
  // Other.
  [{ key: 'n' }, { kind: 'pencil' }],
  [{ key: 'N', shiftKey: true }, { kind: 'pencil' }],
  [{ key: 'Backspace' }, { kind: 'delete', back: true }],
  [{ key: 'Delete' }, { kind: 'delete', back: false }],
  [{ key: 'Escape' }, { kind: 'close' }],
  [{ key: 'Enter' }, null],
  [{ key: 'Tab' }, null],
];

describe('zoomIntent', () => {
  it.each(rows)('%j', (k, want) => {
    expect(zoomIntent(ev(k))).toEqual(want);
  });
});
