// PlaySense Studio — event-id integrity. Slurs and hairpins (score.spans) point
// at events by id, so ids must be unique and spans must never point at an
// event that is gone.
//
// Copies (paste, duplicate, append) get fresh random ids. Repeat passes are
// different: every pass is the same written music, so pass p's ids are the
// source ids with a `~p` suffix — stable across edits, distinct per pass.

import type { Measure, ScoreDocument, Span } from '@/components/playsense-studio/shared/score-model/types';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A fresh event id: 'e' + 8 random base-36 chars. */
export function newEventId(): string {
  return 'e' + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 8);
}

/** The id an event (or tuplet group) carries in repeat pass `pass`: the base id for pass 0, `${base}~${pass}` otherwise. */
export function passEventId(id: string, pass: number): string {
  const base = id.replace(/~\d+$/, '');
  return pass === 0 ? base : `${base}~${pass}`;
}

/** A deep copy of `measure` with every event id and tuplet id rewritten for repeat pass `pass`. */
export function withPassIds(measure: Measure, pass: number): Measure {
  const out = clone(measure);
  for (const v of out.voices) {
    for (const e of v.events) {
      if (e.id) e.id = passEventId(e.id, pass);
      if (e.tuplet) e.tuplet.id = passEventId(e.tuplet.id, pass);
    }
  }
  return out;
}

/**
 * Deep copies of `measures` with fresh event and tuplet-group ids (every member
 * of a group gets the same new group id), plus a copy of each span whose two
 * ends are both inside the copied bars, with a new id and remapped ends.
 */
export function reidMeasures(
  measures: Measure[],
  spans: Span[] | undefined,
  makeId: () => string = newEventId
): { measures: Measure[]; spans: Span[] } {
  const out = clone(measures);
  const idMap = new Map<string, string>();
  const tupletMap = new Map<string, string>();
  for (const m of out) {
    for (const v of m.voices) {
      for (const e of v.events) {
        const fresh = makeId();
        if (e.id) idMap.set(e.id, fresh);
        e.id = fresh;
        if (e.tuplet) {
          let group = tupletMap.get(e.tuplet.id);
          if (!group) { group = 't' + makeId().slice(1); tupletMap.set(e.tuplet.id, group); }
          e.tuplet.id = group;
        }
      }
    }
  }
  const copied = (spans ?? [])
    .filter((s) => idMap.has(s.from) && idMap.has(s.to))
    .map((s) => ({ ...s, id: 's' + makeId().slice(1), from: idMap.get(s.from)!, to: idMap.get(s.to)! }));
  return { measures: out, spans: copied };
}

/** The spans whose two ends still exist; undefined stays undefined. */
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans'] {
  if (!score.spans) return score.spans;
  const ids = new Set<string>();
  for (const t of score.tracks) for (const m of t.measures) for (const v of m.voices) for (const e of v.events) if (e.id) ids.add(e.id);
  return score.spans.filter((s) => ids.has(s.from) && ids.has(s.to));
}
