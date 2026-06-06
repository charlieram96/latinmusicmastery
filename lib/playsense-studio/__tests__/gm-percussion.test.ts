import { describe, expect, it } from 'vitest';
import { GM_PERCUSSION, gmToStrokeMidi, inferPercInstrument } from '../gm-percussion';
import { getPercStrokes, midiToPercStroke } from '../perc-strokes';

describe('GM_PERCUSSION map', () => {
  it('routes the Latin hand-drum keys to their families', () => {
    expect(GM_PERCUSSION[63].instrument).toBe('perc-conga'); // Open Hi Conga
    expect(GM_PERCUSSION[60].instrument).toBe('perc-bongo'); // Hi Bongo
    expect(GM_PERCUSSION[65].instrument).toBe('perc-timbal'); // High Timbale
    expect(GM_PERCUSSION[75].instrument).toBe('perc-clave'); // Claves
    expect(GM_PERCUSSION[36].instrument).toBe('perc-kit'); // Bass Drum
  });

  it('only ever points at stroke midis that exist for that instrument', () => {
    for (const [, entry] of Object.entries(GM_PERCUSSION)) {
      const strokes = getPercStrokes(entry.instrument);
      expect(strokes, `${entry.instrument} has strokes`).not.toBeNull();
      expect(strokes!.some((s) => s.midi === entry.strokeMidi)).toBe(true);
    }
  });
});

describe('inferPercInstrument', () => {
  it('picks the dominant family in the GM set', () => {
    expect(inferPercInstrument([62, 63, 64])).toBe('perc-conga');
    expect(inferPercInstrument([36, 38, 42, 46])).toBe('perc-kit');
    expect(inferPercInstrument([65, 66])).toBe('perc-timbal');
  });

  it('defaults to perc-kit for empty or unknown sets', () => {
    expect(inferPercInstrument([])).toBe('perc-kit');
    expect(inferPercInstrument([200, 201])).toBe('perc-kit');
  });
});

describe('gmToStrokeMidi', () => {
  it('maps a GM key to a stroke that midiToPercStroke can resolve', () => {
    const conga = gmToStrokeMidi(63, 'perc-conga'); // Open Hi Conga
    expect(midiToPercStroke('perc-conga', conga)?.id).toBe('open-high');

    const kick = gmToStrokeMidi(36, 'perc-kit');
    expect(midiToPercStroke('perc-kit', kick)?.id).toBe('kick');
  });

  it('falls back to the instrument first stroke when the GM key is foreign', () => {
    // A conga key requested against a clave instrument → clave's only stroke.
    const fallback = gmToStrokeMidi(63, 'perc-clave');
    expect(fallback).toBe(getPercStrokes('perc-clave')![0].midi);
    expect(midiToPercStroke('perc-clave', fallback)).toBeDefined();
  });

  it('falls back to the first stroke for unknown GM keys', () => {
    const fallback = gmToStrokeMidi(200, 'perc-conga');
    expect(fallback).toBe(getPercStrokes('perc-conga')![0].midi);
  });
});
