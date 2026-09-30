// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMusicXmlBuffer } from '../parsers/musicxml';
import { getPercStrokes } from '../perc-strokes';
import { applyMeasureEdit } from '../measure-edits';
import { parseScoreDocument, serializeScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';

const expected = [
  'low', 'high', 'rim', 'high-mute', 'low-mute', 'cascara', 'cascara-low',
  'low-cross-stick', 'cymbal', 'timbal-bell', 'jam-block', 'bongo-bell-mouth',
  'bongo-bell-body', 'chacha-bell-mouth', 'chacha-bell-body', 'elbow-strike',
];
async function legend() {
  const bytes = readFileSync(resolve(process.cwd(), 'lib/playsense-studio/__tests__/fixtures/timbal-lmm-legend.mxl'));
  return parseMusicXmlBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'Leyenda de Timbal_LMM.mxl');
}

describe('supplied LMM timbal legend', () => {
  it('assigns all 16 named strokes by written symbol and position, including the Jam Block square', async () => {
    const score = parseScoreDocument(serializeScoreDocument(await legend()));
    expect(score.tracks[0].instrument).toBe('perc-timbal');
    const notes = score.tracks[0].measures.flatMap(m => m.voices.flatMap(v => v.events)).filter(e => e.kind === 'note');
    expect(notes).toHaveLength(16);
    expected.forEach((id, index) => {
      const stroke = getPercStrokes('perc-timbal')!.find(s => s.id === id)!;
      expect(notes[index]).toMatchObject({ midi: stroke.midi, percussion: {
        strokeId: id, staffLine: stroke.staffLine, notehead: stroke.notehead ?? 'normal',
      } });
    });
    // The user identified the unlabelled final C4 note as Elbow strike.
    expect(notes[15].percussion).toMatchObject({ staffLine: 'c/4', notehead: 'normal' });
    expect(notes[15].percussion?.strokeId).toBe('elbow-strike');
  });

  it('retains the complete notation and sounds when appending and saving a second score', async () => {
    const score = await legend();
    const result = applyMeasureEdit(score, { type: 'append-score', score });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = parseScoreDocument(serializeScoreDocument(result.score));
    const pitches = (bars: typeof score.tracks[0]['measures']) => bars.flatMap(m => m.voices.flatMap(v => v.events))
      .filter(e => e.kind === 'note').map(e => ({ midi: e.midi, percussion: e.percussion, durationQN: e.durationQN }));
    expect(pitches(saved.tracks[0].measures.slice(score.tracks[0].measures.length))).toEqual(pitches(score.tracks[0].measures));
  });
});
