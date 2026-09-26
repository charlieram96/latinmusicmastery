import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { advanceCursor, clampCursor, cursorRange, entryReference, walkCursor, type CursorContext, type NoteCursor } from '../note-cursor';
import { staffIndex } from '../pitch';

const n = (midi: number, d = 1): MusicalEvent => ({ kind: 'note', midi, durationQN: d });
const bars: MusicalEvent[][] = [[n(60), n(62)], [], [n(67, 4)]];
const ctx: CursorContext = { count: 3, events: (m) => bars[m] ?? [], barQN: () => 4 };
const c = (measureIndex: number, index: number | 'end', anchor: number | null = null) => ({ measureIndex, voice: 0 as const, index, anchor });

describe('note cursor', () => {
  it('ranges', () => {
    expect(cursorRange(c(0, 'end'), 2)).toEqual([]);
    expect(cursorRange(c(0, 1), 2)).toEqual([1]);
    expect(cursorRange(c(0, 0, 1), 2)).toEqual([0, 1]);
    expect(cursorRange(c(0, 'end', 0), 2)).toEqual([0, 1]);
  });
  it('accumulates a multi-step selection to the end of a longer bar', () => {
    const four: CursorContext = { ...ctx, events: (m) => (m === 0 ? [n(60), n(62), n(64), n(65)] : bars[m]) };
    let cur: NoteCursor = c(0, 0);
    for (let i = 0; i < 4; i++) cur = walkCursor(cur, 1, true, four);
    expect(cur).toEqual(c(0, 'end', 0));
    expect(cursorRange(cur, 4)).toEqual([0, 1, 2, 3]);
  });
  it('advances within a bar, to its end while it has room, then to the next bar', () => {
    expect(advanceCursor(c(0, 0), ctx)).toEqual(c(0, 1));
    expect(advanceCursor(c(0, 1), ctx)).toEqual(c(0, 'end'));
    const full: CursorContext = { ...ctx, events: (m) => (m === 0 ? [n(60, 2), n(62, 2)] : bars[m]) };
    expect(advanceCursor(c(0, 1), full)).toEqual(c(1, 'end'));
    expect(advanceCursor(c(2, 0), ctx)).toEqual(c(2, 'end'));
  });
  it('walks across bars and extends with shift', () => {
    expect(walkCursor(c(0, 'end'), 1, false, ctx)).toEqual(c(1, 'end'));
    expect(walkCursor(c(1, 'end'), 1, false, ctx)).toEqual(c(2, 0));
    expect(walkCursor(c(2, 0), -1, false, ctx)).toEqual(c(1, 'end'));
    expect(walkCursor(c(0, 0), -1, false, ctx)).toEqual(c(0, 0));
    expect(walkCursor(c(0, 0), 1, true, ctx)).toEqual(c(0, 1, 0));
  });
  it('clamps after edits', () => {
    expect(clampCursor(c(0, 5), ctx)).toEqual(c(0, 'end'));
    expect(clampCursor(c(9, 0), ctx)).toEqual(c(2, 0));
  });
  it('clamps a stale anchor', () => {
    expect(clampCursor(c(0, 0, 5), ctx)).toEqual(c(0, 0, 1));
    expect(clampCursor(c(1, 'end', 0), ctx)).toEqual(c(1, 'end', null));
  });
  it('finds the reference pitch for a letter, searching back', () => {
    expect(entryReference(c(1, 'end'), ctx, 0, 99)).toBe(staffIndex('D', 4));
    expect(entryReference(c(0, 0), ctx, 0, 99)).toBe(99);
  });
});
