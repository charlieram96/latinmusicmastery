import { describe, expect, it } from 'vitest';
import { getPercStrokes } from '../perc-strokes';
import { keyPitchAt } from '../pitch';
import { CLEF_TOP_INDEX, dragSteps, indexForLine, snapStroke } from '../zoom-pointer';

describe('zoom-pointer', () => {
  it('maps a stave line to a staff index from the clef’s top line', () => {
    expect(CLEF_TOP_INDEX).toEqual({ treble: 38, bass: 26, alto: 32, tenor: 30, percussion: 38 });
    expect(indexForLine(0, 'treble')).toBe(38); // F5
    expect(indexForLine(2, 'treble')).toBe(34); // B4
    expect(indexForLine(4.5, 'treble')).toBe(29); // D4
    expect(indexForLine(0, 'bass')).toBe(26); // A3
    // Rounds to the nearest half-line.
    expect(indexForLine(1.8, 'treble')).toBe(34);
  });

  it('counts diatonic steps from a vertical drag, up positive', () => {
    expect(dragSteps(100, 90, 5)).toBe(2);
    expect(dragSteps(100, 107, 5)).toBe(-1);
    expect(dragSteps(100, 101, 5)).toBe(0);
  });

  it('keyPitchAt spells a staff index in the key', () => {
    expect(keyPitchAt(31, 2)).toEqual({ midi: 66, spelling: { step: 'F', alter: 1 } });
    expect(keyPitchAt(28, 0)).toEqual({ midi: 60, spelling: { step: 'C', alter: 0 } });
  });

  it('snaps a percussion drag to the nearest stroke line, keeping the notehead on ties', () => {
    const bongo = getPercStrokes('perc-bongo')!;
    const conga = getPercStrokes('perc-conga')!;
    // No movement keeps the stroke.
    expect(snapStroke(conga, 64, 0)).toBe(64);
    // Open · high (e/5) one step down lands on Open · low (d/5).
    expect(snapStroke(conga, 64, -1)).toBe(63);
    // Open · high three steps up lands on Open · middle (g/5).
    expect(snapStroke(conga, 64, 3)).toBe(67);
    // Every stroke lies on some line, so a result is always one of them.
    expect(bongo.map((s) => s.midi)).toContain(snapStroke(bongo, bongo[0].midi, -4));
  });
});
