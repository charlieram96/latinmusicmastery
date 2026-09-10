import { describe, expect, it } from 'vitest';
import { Beam, Stem } from 'vexflow';
import { createStaveNote } from '../percussion-stave-note';
import { PERCUSSION_GLYPHS } from '../percussion-noteheads';
import { getPercStrokes } from '../perc-strokes';

describe('legend engraving', () => {
  it('retains each percussion glyph after beaming changes the stems', () => {
    const heads = ['normal', 'plus', 'slash', 'ornate-x'] as const;
    const notes = heads.map(notehead => createStaveNote({keys: ['e/5'], duration: '8'}, [{staffLine: 'e/5', notehead}]));
    Beam.generateBeams(notes);
    expect(notes.map(n => n.noteHeads[0].getText())).toEqual(['\uE0A4', '\uE0AF', '\uE100', '\uE0AA']);
    notes.forEach(n => n.setStemDirection(Stem.DOWN));
    expect(notes.map(n => n.noteHeads[0].getText())).toEqual(['\uE0A4', '\uE0AF', '\uE100', '\uE0AA']);
  });

  it('preserves half and whole duration cues for custom and existing kit symbols', () => {
    for (const [head, expected] of [['x', '\uE0A8'], ['diamond', '\uE0D9'], ['slash', '\uE103']] as const) {
      const note = createStaveNote({keys: ['e/5'], duration: '2'}, [{staffLine: 'e/5', notehead: head}]);
      expect(note.noteHeads[0].getText()).toBe(expected);
    }
    const whole = createStaveNote({keys: ['e/5'], duration: '1'}, [{staffLine: 'e/5', notehead: 'circled'}]);
    expect(whole.noteHeads[0].getText()).toBe('\uE0EA');
    expect(whole.hasStem()).toBe(false);
  });

  it('keeps a mixed chord’s heads independent even when key order is reversed', () => {
    const note = createStaveNote({ keys: ['a/5', 'f/4'], duration: '8', stemDirection: Stem.DOWN }, [
      { staffLine: 'a/5', notehead: 'triangle-up' }, { staffLine: 'f/4', notehead: 'slashed' },
    ]);
    note.setStemDirection(Stem.UP);
    expect(note.noteHeads.map(h => h.getText())).toEqual(['\uE0BE', '\uE0CF']);
  });

  it('draws the pressed conga slap’s extra marcato without changing ordinary slaps', () => {
    const strokes = getPercStrokes('perc-conga')!;
    const make = (id: string) => {
      const s = strokes.find(s => s.id === id)!;
      return createStaveNote({keys: [s.staffLine], duration: '4'}, [{staffLine: s.staffLine, notehead: s.notehead ?? 'normal', marcato: s.marcato}]);
    };
    expect(make('pressed-slap').getModifiers()).toHaveLength(1);
    expect(make('slap').getModifiers()).toHaveLength(0);
    expect(make('pressed-slap').noteHeads[0].getText()).toBe(PERCUSSION_GLYPHS['ornate-x']);
  });
});
