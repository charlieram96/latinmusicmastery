// PlaySense Studio — measure-level structural edits on a ScoreDocument (pure).
//
// Insert, delete, paste, append-an-import, and repeat all live here so the
// reducer and the sync panel share one implementation and one set of guards.
// Every edit clones the score, keeps tempo / meter / key continuity by
// re-stamping the bar that follows a splice (the same rule the MIDI recorder
// uses), renumbers 1..n, and reports the splice it made so the sync markers
// can be transformed to match. Timing is NOT handled here — see
// components/playsense-studio/sync/structural-timing.ts.
//
// Repeat groups are never split: an edit that would cut through a group is
// refused with a message the UI shows, because withHistory would otherwise
// silently strip the group's repeat metadata.

import type {
  Instrument,
  Measure,
  MusicalEvent,
  ScoreDocument,
  Span,
  Track,
  Voice,
} from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureSpan } from '@/components/playsense-studio/sync/marker-model';
import { recordingContext } from './midi-recording';
import { isPercussion } from './perc-strokes';
import { repeatGroups } from './repeats';
import { newEventId, pruneSpans, reidMeasures, withPassIds } from './event-ids';

export interface MeasureContext {
  bpm: number;
  timeSignature: [number, number];
  keyFifths: number;
}

/** Bars copied out of a score, with the context they were written in. */
export interface MeasureClip {
  /** Deep clones; `repeat` and `endBarline` are stripped. */
  measures: Measure[];
  /** Effective tempo / meter / key at the first copied bar. */
  context: MeasureContext;
  /** Source track instrument — percussion notation cannot be pasted into a pitched part. */
  instrument: Instrument;
  /** Video timing of the copied bars, when they were copied from a synced score. */
  timing?: MeasureSpan[];
  /** Slurs and hairpins whose two ends are both inside the copied bars (source ids). */
  notationSpans?: Span[];
}

export type StructuralAction =
  | { type: 'insert-measure'; trackIndex: number; index: number }
  | { type: 'delete-measures'; trackIndex: number; start: number; count: number }
  | { type: 'paste-measures'; trackIndex: number; index: number; clip: MeasureClip }
  | { type: 'append-score'; score: ScoreDocument }
  | { type: 'repeat-measures'; trackIndex: number; start: number; end: number; count: number; id: string }
  | { type: 'set-repeat-count'; trackIndex: number; id: string; count: number }
  | { type: 'add-measure'; trackIndex: number };

export interface Splice {
  index: number;
  removeCount: number;
  insertCount: number;
}

export type MeasureEditResult =
  | { ok: true; score: ScoreDocument; splice: Splice }
  | { ok: false; problem: string };

/** Keep the strip (one VexFlow SVG per bar) and the reducer's history sane. */
export const MAX_MEASURES = 512;

const STRUCTURAL_TYPES = new Set<string>([
  'insert-measure', 'delete-measures', 'paste-measures', 'append-score', 'repeat-measures', 'set-repeat-count', 'add-measure',
]);

export function isStructuralAction(action: { type: string }): action is StructuralAction {
  return STRUCTURAL_TYPES.has(action.type);
}

export function emptyMeasure(number: number): Measure {
  // A blank measure starts empty — the author drops the first note straight in,
  // with no placeholder rest to delete first.
  const voice: Voice = { number: 1, events: [] as MusicalEvent[] };
  return { number, voices: [voice] };
}

/** Effective tempo / meter / key after bar `index` (−1 = the score's opening values). */
export function contextAt(score: ScoreDocument, track: Track, index: number): MeasureContext {
  return recordingContext(score, track, index);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameSignature(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** The fields of `wanted` that differ from `flowing` — what a bar must carry to restore `wanted`. */
function contextDiff(flowing: MeasureContext, wanted: MeasureContext): Partial<MeasureContext> {
  const out: Partial<MeasureContext> = {};
  if (wanted.bpm !== flowing.bpm) out.bpm = wanted.bpm;
  if (!sameSignature(wanted.timeSignature, flowing.timeSignature)) out.timeSignature = wanted.timeSignature;
  if (wanted.keyFifths !== flowing.keyFifths) out.keyFifths = wanted.keyFifths;
  return out;
}

/**
 * Stamp context overrides on a bar — and on every bar sharing its
 * (repeat.id, repeat.offset), because the passes of a group must stay
 * identical (apart from their per-pass ids) or `repeatGroups` stops
 * recognising the group.
 */
export function stampContext(track: Track, index: number, ctx: Partial<MeasureContext>): void {
  const target = track.measures[index];
  if (!target) return;
  const apply = (m: Measure) => {
    if (ctx.bpm !== undefined) m.tempoChange = ctx.bpm;
    if (ctx.timeSignature !== undefined) m.timeSignature = [ctx.timeSignature[0], ctx.timeSignature[1]];
    if (ctx.keyFifths !== undefined) m.keyFifths = ctx.keyFifths;
  };
  apply(target);
  const r = target.repeat;
  if (!r) return;
  for (const m of track.measures) {
    if (m !== target && m.repeat?.id === r.id && m.repeat.offset === r.offset) apply(m);
  }
}

function stripOverrides(m: Measure): Measure {
  const { repeat: _repeat, endBarline: _end, ...rest } = m;
  return rest;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const INVALID = 'Choose a valid measure position.';

function groupSpans(track: Track): Array<{ start: number; end: number }> {
  return repeatGroups(track).map((g) => ({ start: g.start, end: g.start + g.length * g.count }));
}

function insideGroup(track: Track, index: number): boolean {
  return groupSpans(track).some((g) => g.start < index && index < g.end);
}

function splitsGroup(track: Track, start: number, count: number): boolean {
  const end = start + count;
  return groupSpans(track).some((g) => start < g.end && end > g.start && !(start <= g.start && end >= g.end));
}

/** The reason an edit cannot be applied, or null when it can. Cheap; safe to call per render. */
export function structuralEditProblem(score: ScoreDocument, action: StructuralAction): string | null {
  const trackIndex = action.type === 'append-score' ? 0 : action.trackIndex;
  const track = score.tracks[trackIndex];
  if (!track) return INVALID;
  const n = track.measures.length;
  switch (action.type) {
    case 'add-measure':
      return n + 1 > MAX_MEASURES ? `Scores are limited to ${MAX_MEASURES} measures.` : null;
    case 'insert-measure': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > n) return INVALID;
      if (n + 1 > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
      if (insideGroup(track, action.index)) return 'Unlink this repeat before inserting inside it.';
      return null;
    }
    case 'delete-measures': {
      const { start, count } = action;
      if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1 || start + count > n) return INVALID;
      if (count >= n) return 'Keep at least one measure in the score.';
      if (splitsGroup(track, start, count)) return 'Delete the whole repeat, or unlink it first.';
      return null;
    }
    case 'paste-measures': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > n) return INVALID;
      if (!action.clip.measures.length) return 'There is nothing to paste.';
      if (isPercussion(action.clip.instrument) !== isPercussion(track.instrument)) {
        return isPercussion(action.clip.instrument)
          ? 'Copied from a percussion part; paste into a percussion part.'
          : 'Copied from a pitched part; it cannot go into a percussion part.';
      }
      if (n + action.clip.measures.length > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
      if (insideGroup(track, action.index)) return 'Unlink this repeat before inserting inside it.';
      return null;
    }
    case 'append-score': {
      const imported = action.score.tracks[0];
      if (!imported || !imported.measures.length) return 'That file has no measures to add.';
      if (n + imported.measures.length > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
      return null;
    }
    case 'repeat-measures': {
      const { start, end, count, id } = action;
      if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(count) ||
        start < 0 || end < start || end >= n || count < 2 || count > 8 || !id) return 'Choose a valid measure range.';
      if (track.measures.slice(start, end + 1).some((m) => m.repeat)) return 'These measures are already part of a repeat.';
      if (n + (end - start + 1) * (count - 1) > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
      return null;
    }
    case 'set-repeat-count': {
      const g = repeatGroups(track).find((x) => x.id === action.id);
      if (!g) return 'That repeat no longer exists.';
      if (!Number.isInteger(action.count) || action.count < 2 || action.count > 8) return 'Choose between 2 and 8 times.';
      if (action.count === g.count) return 'It already plays that many times.';
      if (n + g.length * (action.count - g.count) > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

/**
 * Bars left over from an unlinked repeat still carry pass ids (`a~1`). Pass 0
 * of a new repeat strips that suffix, which would collide with the old pass 0's
 * `a`, so such events get fresh ids first (spans follow them).
 */
function renamePassIds(score: ScoreDocument, bars: Measure[]): void {
  const renamed = new Map<string, string>();
  const tuplets = new Map<string, string>();
  for (const m of bars) for (const v of m.voices) for (const e of v.events) {
    if (e.id && /~\d+$/.test(e.id)) { const id = newEventId(); renamed.set(e.id, id); e.id = id; }
    if (e.tuplet && /~\d+$/.test(e.tuplet.id)) {
      let id = tuplets.get(e.tuplet.id);
      if (!id) { id = 't' + newEventId().slice(1); tuplets.set(e.tuplet.id, id); }
      e.tuplet.id = id;
    }
  }
  if (renamed.size && score.spans) {
    score.spans = score.spans.map((s) => ({ ...s, from: renamed.get(s.from) ?? s.from, to: renamed.get(s.to) ?? s.to }));
  }
}

function renumber(track: Track): void {
  track.measures.forEach((m, i) => { m.number = i + 1; });
}

/** Apply a structural edit to a clone of the score. Refusals carry the guard's message. */
export function applyMeasureEdit(score: ScoreDocument, action: StructuralAction): MeasureEditResult {
  const problem = structuralEditProblem(score, action);
  if (problem) return { ok: false, problem };
  const trackIndex = action.type === 'append-score' ? 0 : action.trackIndex;
  const original = score.tracks[trackIndex];
  const next = clone(score);
  const track = next.tracks[trackIndex];
  const n = original.measures.length;

  switch (action.type) {
    case 'add-measure':
    case 'insert-measure': {
      const index = action.type === 'add-measure' ? n : action.index;
      const flowing = contextAt(score, original, index - 1);
      const resume = contextAt(score, original, index);
      track.measures.splice(index, 0, emptyMeasure(index + 1));
      if (index < n) stampContext(track, index + 1, contextDiff(flowing, resume));
      renumber(track);
      return { ok: true, score: next, splice: { index, removeCount: 0, insertCount: 1 } };
    }
    case 'delete-measures': {
      const { start, count } = action;
      const flowing = contextAt(score, original, start - 1);
      const resume = contextAt(score, original, start + count - 1 + 1);
      track.measures.splice(start, count);
      if (start < track.measures.length) stampContext(track, start, contextDiff(flowing, resume));
      if (next.spans) next.spans = pruneSpans(next);
      renumber(track);
      return { ok: true, score: next, splice: { index: start, removeCount: count, insertCount: 0 } };
    }
    case 'paste-measures': {
      const { index, clip } = action;
      // A paste is a new copy: fresh ids, with the slurs inside it remapped.
      const { measures: pasted, spans: copied } = reidMeasures(clip.measures.map(stripOverrides), clip.notationSpans);
      if (copied.length) next.spans = [...(next.spans ?? []), ...copied];
      const flowing = contextAt(score, original, index - 1);
      const resume = contextAt(score, original, index);
      track.measures.splice(index, 0, ...pasted);
      stampContext(track, index, contextDiff(flowing, clip.context));
      if (index < n) {
        const out = contextAt(next, track, index + pasted.length - 1);
        stampContext(track, index + pasted.length, contextDiff(out, resume));
      }
      renumber(track);
      return { ok: true, score: next, splice: { index, removeCount: 0, insertCount: pasted.length } };
    }
    case 'append-score': {
      const imported = action.score.tracks[0];
      const { measures: bars, spans: copied } = reidMeasures(
        imported.measures.map((m) => { const { repeat: _r, ...rest } = m; return rest; }),
        action.score.spans,
      );
      if (copied.length) next.spans = [...(next.spans ?? []), ...copied];
      const tail = contextAt(score, original, n - 1);
      const header: MeasureContext = {
        bpm: action.score.initialTempo,
        timeSignature: action.score.initialTimeSignature,
        keyFifths: action.score.initialKeyFifths,
      };
      const diff = contextDiff(tail, header);
      const first = bars[0];
      if (diff.bpm !== undefined && first.tempoChange === undefined) first.tempoChange = diff.bpm;
      if (diff.timeSignature !== undefined && first.timeSignature === undefined) first.timeSignature = [diff.timeSignature[0], diff.timeSignature[1]];
      if (diff.keyFifths !== undefined && first.keyFifths === undefined) first.keyFifths = diff.keyFifths;
      track.measures.push(...bars);
      renumber(track);
      return { ok: true, score: next, splice: { index: n, removeCount: 0, insertCount: bars.length } };
    }
    case 'repeat-measures': {
      const { start, end, count, id } = action;
      const source = track.measures.slice(start, end + 1);
      renamePassIds(next, source);
      const ctx = contextAt(score, original, start);
      source[0] = { ...source[0], tempoChange: ctx.bpm, timeSignature: ctx.timeSignature, keyFifths: ctx.keyFifths };
      const expanded = Array.from({ length: count }, (_, pass) => source.map((m, offset) => withPassIds({
        ...clone(m), repeat: { id, pass, count, offset, length: source.length },
      }, pass))).flat();
      track.measures.splice(start, source.length, ...expanded);
      renumber(track);
      return { ok: true, score: next, splice: { index: start, removeCount: source.length, insertCount: expanded.length } };
    }
    case 'set-repeat-count': {
      const g = repeatGroups(original).find((x) => x.id === action.id)!;
      const groupEnd = g.start + g.length * g.count;
      for (let i = g.start; i < groupEnd; i++) track.measures[i].repeat!.count = action.count;
      if (action.count > g.count) {
        const pass1 = track.measures.slice(g.start, g.start + g.length);
        const added = Array.from({ length: action.count - g.count }, (_, k) => pass1.map((m) => withPassIds({
          ...clone(m), repeat: { ...m.repeat!, pass: g.count + k, count: action.count },
        }, g.count + k))).flat();
        track.measures.splice(groupEnd, 0, ...added);
        renumber(track);
        return { ok: true, score: next, splice: { index: groupEnd, removeCount: 0, insertCount: added.length } };
      }
      const keepEnd = g.start + g.length * action.count;
      const removeCount = groupEnd - keepEnd;
      track.measures.splice(keepEnd, removeCount);
      if (next.spans) next.spans = pruneSpans(next);
      renumber(track);
      return { ok: true, score: next, splice: { index: keepEnd, removeCount, insertCount: 0 } };
    }
  }
}
