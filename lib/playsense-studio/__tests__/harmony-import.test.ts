// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parseMusicXmlBuffer } from '../parsers/musicxml';
import { parseScoreDocument, serializeScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import { extractTrackEvents } from '../score-to-vexflow';
import { buildMeasure, formatMeasure } from '../notation/build-measure';

it('preserves the supplied harmony chords and independent layers through import, save and engraving', async () => {
  const bytes = readFileSync(resolve(process.cwd(), 'lib/playsense-studio/__tests__/fixtures/lmm-harmony.mxl'));
  const imported = await parseMusicXmlBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'LMM-Test_Armonia.mxl', { title: 'LMM-Test_Armonia' });
  const score = parseScoreDocument(serializeScoreDocument(imported));
  expect(score.initialTimeSignature).toEqual([4, 4]);
  expect(score.tracks[0].measures).toHaveLength(2);
  const [first, second] = score.tracks[0].measures;
  expect(first.voices[0].events.map(e => e.durationQN)).toEqual([1,.5,.5,.5,.5,.25,.25,.25,.25]);
  expect(first.voices[0].events[0]).toMatchObject({kind:'chord',notes:[{midi:69},{midi:72},{midi:76}]});
  expect(second.voices).toHaveLength(2);
  expect(second.voices[0].events.map(e => e.durationQN)).toEqual([2,1,.25,.25,.5]);
  expect(second.voices[1].events.map(e => e.durationQN)).toEqual([1,1,1,1]);
  expect(second.voices[1].events[3]).toMatchObject({kind:'chord',notes:[{midi:60},{midi:64},{midi:65},{midi:71}]});
  const blocks = extractTrackEvents(score.tracks[0], score.initialTimeSignature, score.initialKeyFifths);
  expect(blocks[1].events.map(e=>e.qnStart)).toEqual([4,6,7,7.25,7.5]);
  expect(blocks[1].voice2Events.map(e=>e.qnStart)).toEqual([4,5,6,7]);
  const ctx={ measureText: (s:string)=>({width:s.length*7,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2,fontBoundingBoxAscent:8,fontBoundingBoxDescent:2}),font:'' };
  HTMLCanvasElement.prototype.getContext=(()=>ctx) as never;
  for(const block of blocks){
    const built=buildMeasure([block.events,block.voice2Events],block.timeSignature,block.clef);
    if (!built) throw new Error('Expected a built measure');
    expect(()=>formatMeasure(built,600)).not.toThrow();
    expect(built.notes[0]).toHaveLength(block.events.length);
    expect(built.notes[1]).toHaveLength(block.voice2Events.length);
    // Every stem must reach the same side of its beam, even when adjacent
    // chords would individually select opposite automatic stem directions.
    for (const beam of built.beams) {
      expect(new Set(beam.getNotes().map(n => n.getStemDirection())).size).toBe(1);
    }
    if (block.voice2Events.length) {
      expect(built.notes[0].every(n => n.getStemDirection() === 1)).toBe(true);
      expect(built.notes[1].every(n => n.getStemDirection() === -1)).toBe(true);
    }
  }
});
