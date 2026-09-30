// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parseMusicXmlBuffer } from '../parsers/musicxml';
import { parseScoreDocument, serializeScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import { extractTrackEvents } from '../score-to-vexflow';
import { selectInstrument } from '../staff-groups';
import { structuralEditProblem } from '../measure-edits';

it('retains both piano staves, all 25 bars and the two bass voices in the supplied XML', async () => {
  const bytes = readFileSync(resolve(process.cwd(), 'lib/playsense-studio/__tests__/fixtures/multi-staff.mxl'));
  const parsed = await parseMusicXmlBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'Multi Pentagrama .mxl');
  const score = parseScoreDocument(serializeScoreDocument(selectInstrument(parsed, 1)));
  expect(score.tracks).toHaveLength(2);
  expect(score.tracks.map(t => t.measures.flatMap(m => m.voices.flatMap(v => v.events)).reduce((sum, e) => sum + (e.kind === 'chord' ? e.notes.length : e.kind === 'note' ? 1 : 0), 0))).toEqual([214, 117]);
  expect(score.tracks.map(t=>t.staffNumber)).toEqual([1,2]);
  for (const track of score.tracks) {
    expect(track.instrument).toBe('piano');
    expect(track.measures).toHaveLength(25);
  }
  expect(extractTrackEvents(score.tracks[0], score.initialTimeSignature, score.initialKeyFifths)[0].clef).toBe('treble');
  const bass = extractTrackEvents(score.tracks[1], score.initialTimeSignature, score.initialKeyFifths);
  expect(bass[0].clef).toBe('bass');
  expect(score.tracks[1].measures[1].voices).toHaveLength(2);
  expect(bass[1].events.length).toBeGreaterThan(0);
  expect(bass[1].voice2Events.length).toBeGreaterThan(0);
  expect(structuralEditProblem(score, {type:'append-score', score})).toMatch(/Replace score/);
});
