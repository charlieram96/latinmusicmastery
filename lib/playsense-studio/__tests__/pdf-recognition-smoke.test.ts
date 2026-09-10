// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parseMusicXmlBuffer } from '../parsers/musicxml';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';

// Opt-in: exercise the actual engine output without committing third-party PDFs.
const resultPath = process.env.PLAYSENSE_PDF_SMOKE_RESULT;
it.skipIf(!resultPath)('imports real PDF recognition output as a valid editable score', async () => {
  const result = JSON.parse(await readFile(resultPath!, 'utf8')) as { scores: Array<{ filename: string; data: string }> };
  expect(result.scores.length).toBeGreaterThan(0);
  for (const output of result.scores) {
    const bytes = Uint8Array.from(Buffer.from(output.data, 'base64'));
    const parsed = await parseMusicXmlBuffer(bytes.buffer, output.filename);
    const score = parseScoreDocument({ ...parsed, sourceFormat: 'pdf' });
    expect(score.tracks.length).toBeGreaterThan(0);
    expect(score.tracks.some(track => track.measures.some(measure => measure.voices.some(voice =>
      voice.events.some(event => event.kind === 'note' || event.kind === 'chord'),
    )))).toBe(true);
  }
});
