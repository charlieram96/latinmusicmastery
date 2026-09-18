import { expect, it } from 'vitest';
import { editorReducer, type EditorState } from '../editor-state';
import { repeatGroups, repeatProjection, repeatSpans } from '../repeats';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

function initial(): EditorState {
  const score: ScoreDocument = {
    schemaVersion: 1, title: 'Repeat test', sourceFormat: 'native', initialTempo: 120,
    initialTimeSignature: [4, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'Test', tuning: null,
      stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [1, 2, 3].map(number => ({ number, voices: [{ number: 1,
        events: [{ kind: 'note', midi: 60 + number, durationQN: 4 }] }] })) }],
  };
  return { score, past: [], future: [], isDirty: false };
}

function repeated() {
  return editorReducer(initial(), { type: 'repeat-measures', trackIndex: 0, start: 0, end: 1, count: 3, id: 'group' });
}

it('expands a measure range in performance order and persists its repeat metadata', () => {
  const state = repeated();
  const measures = state.score.tracks[0].measures;
  expect(measures.map(m => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(measures.map(m => m.repeat?.pass)).toEqual([0, 0, 1, 1, 2, 2, undefined]);
  expect(parseScoreDocument(JSON.parse(JSON.stringify(state.score)))).toEqual(state.score);
  expect(editorReducer(state, { type: 'undo' }).score).toEqual(initial().score);
});

it('keeps the video timeline expanded while the cursor returns to the repeat start', () => {
  const projection = repeatProjection(repeated().score, 0)!;
  expect(projection.score.tracks[0].measures).toHaveLength(3);
  expect(projection.originalDuration).toBe(14000);
  expect(projection.toCompactMs(4500)).toBe(500);
  expect(projection.toCompactMs(8500)).toBe(500);
  expect(projection.toCompactMs(12500)).toBe(4500);
  expect(projection.toOriginalQN(1, 8500)).toEqual({ qn: 17, measure: 5 });
  expect(projection.toOriginalQN(1, 7900)).toEqual({ qn: 9, measure: 3 });
  expect(projection.toOriginalQN(8, 4500, true)).toEqual({ qn: 16, measure: 4 });
});

it('updates matching notation across passes and can unlink them', () => {
  const state = repeated();
  const edited = editorReducer(state, { type: 'set-event-pitch', trackIndex: 0, measureIndex: 2, eventIndex: 0, midi: 72 });
  for (const i of [0, 2, 4]) expect(edited.score.tracks[0].measures[i].voices[0].events[0]).toMatchObject({ midi: 72 });
  expect(repeatGroups(edited.score.tracks[0])).toHaveLength(1);
  const changed = editorReducer(state, { type: 'delete-measures', trackIndex: 0, start: 0, count: 6 });
  expect(repeatGroups(changed.score.tracks[0])).toHaveLength(0);
  const unlinked = editorReducer(state, { type: 'unlink-repeat', trackIndex: 0, id: 'group' });
  expect(unlinked.score.tracks[0].measures).toHaveLength(7);
  expect(repeatProjection(unlinked.score, 0)).toBeNull();
});

it('rejects overlapping repeats and invalid ranges', () => {
  const state = repeated();
  expect(editorReducer(state, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 1, count: 2, id: 'nested' })).toBe(state);
  expect(editorReducer(state, { type: 'repeat-measures', trackIndex: 0, start: -1, end: 1, count: 2, id: 'bad' })).toBe(state);
});

it('spans consecutive strip items that belong to one repeat group', () => {
  const item = (repeatPass?: { id: string; pass: number; count: number; offset: number; length: number }) => ({ repeatPass });
  const a = (pass: number, offset: number) => item({ id: 'a', pass, count: 4, offset, length: 2 });
  const b = (pass: number) => item({ id: 'b', pass, count: 2, offset: 0, length: 1 });
  const items = [item(), a(0, 0), a(0, 1), a(1, 0), a(1, 1), a(2, 0), a(2, 1), a(3, 0), a(3, 1), item(), b(0), b(1)];
  expect(repeatSpans(items)).toEqual([
    { id: 'a', firstIndex: 1, lastIndex: 8, count: 4, length: 2, passStarts: [1, 3, 5, 7] },
    { id: 'b', firstIndex: 10, lastIndex: 11, count: 2, length: 1, passStarts: [10, 11] },
  ]);
  expect(repeatSpans([item(), item()])).toEqual([]);
});
