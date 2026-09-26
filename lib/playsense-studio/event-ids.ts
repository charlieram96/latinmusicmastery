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

/** A measure's notation with its bar number, repeat tag, event ids and tuplet ids left out. */
function idFreeContent(measure: Measure): string {
  const { number: _number, repeat: _repeat, ...notation } = clone(measure);
  for (const v of notation.voices) for (const e of v.events) {
    delete e.id;
    if (e.tuplet) delete (e.tuplet as { id?: string }).id;
  }
  return JSON.stringify(notation);
}

/**
 * Repeat groups whose tags are well formed and whose passes hold the same
 * music once ids are ignored. Scores saved before per-pass ids have passes with
 * no ids or with pass 0's ids, so `repeatGroups` alone would not see them.
 */
function idFreeRepeatGroups(measures: Measure[]): Array<{ start: number; length: number; count: number }> {
  const groups: Array<{ start: number; length: number; count: number }> = [];
  measures.forEach((m, start) => {
    const r = m.repeat;
    if (!r || r.pass !== 0 || r.offset !== 0 || r.length < 1 || r.count < 1) return;
    if (r.length * r.count > measures.length - start) return;
    for (let i = 0; i < r.length * r.count; i++) {
      const other = measures[start + i].repeat;
      if (!other || other.id !== r.id || other.length !== r.length || other.count !== r.count ||
        other.pass !== Math.floor(i / r.length) || other.offset !== i % r.length) return;
      if (i >= r.length && idFreeContent(measures[start + i]) !== idFreeContent(measures[start + i % r.length])) return;
    }
    groups.push({ start, length: r.length, count: r.count });
  });
  return groups;
}

/**
 * Missing or duplicate event ids are replaced (the first holder keeps its id),
 * as `ensureEventIds` does, but repeat groups stay groups. In a group whose
 * passes match apart from ids, pass 0 keeps its ids (fresh where missing,
 * duplicated, or carrying a pass suffix) and every later pass gets pass 0's
 * ids for its pass number (`a~1`, …). A span end whose id was renamed and is
 * no longer held by any event follows the rename. Bars that don't form such a
 * group get the plain repair. Pure: returns a new score.
 */
export function ensureScoreEventIds(score: ScoreDocument, makeId: () => string = newEventId): ScoreDocument {
  const out = clone(score);
  const seen = new Set<string>();
  const renamed = new Map<string, string>();
  const rename = (from: string, to: string) => { if (!renamed.has(from)) renamed.set(from, to); };
  for (const track of out.tracks) {
    const groupOf = new Map<number, { start: number; length: number; count: number }>();
    for (const g of idFreeRepeatGroups(track.measures)) {
      for (let i = g.start; i < g.start + g.length * g.count; i++) groupOf.set(i, g);
    }
    track.measures = track.measures.map((m, i) => {
      const g = groupOf.get(i);
      if (g && m.repeat!.pass > 0) {
        const source = track.measures[g.start + m.repeat!.offset];
        const pass = withPassIds({ ...source, number: m.number, repeat: m.repeat }, m.repeat!.pass);
        pass.voices.forEach((v, vi) => v.events.forEach((e, ei) => {
          const old = m.voices[vi]?.events[ei]?.id;
          if (old && old !== e.id) rename(old, e.id!);
        }));
        return pass;
      }
      for (const v of m.voices) {
        for (const e of v.events) {
          const passIdsFree = (id: string) => Array.from({ length: g!.count - 1 }, (_, k) => passEventId(id, k + 1)).every((p) => !seen.has(p));
          const usable = !!e.id && !seen.has(e.id) && (!g || (passEventId(e.id, 0) === e.id && passIdsFree(e.id)));
          if (!usable) {
            const id = makeId();
            if (e.id) rename(e.id, id);
            e.id = id;
          }
          seen.add(e.id!);
          if (g) {
            for (let p = 1; p < g.count; p++) seen.add(passEventId(e.id!, p));
            if (e.tuplet) e.tuplet.id = passEventId(e.tuplet.id, 0);
          }
        }
      }
      return m;
    });
  }
  if (out.spans && renamed.size) {
    const held = new Set<string>();
    for (const t of out.tracks) for (const m of t.measures) for (const v of m.voices) for (const e of v.events) if (e.id) held.add(e.id);
    const follow = (id: string) => (held.has(id) ? id : renamed.get(id) ?? id);
    out.spans = out.spans.map((s) => ({ ...s, from: follow(s.from), to: follow(s.to) }));
  }
  return out;
}

/** The spans whose two ends still exist; undefined stays undefined. */
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans'] {
  if (!score.spans) return score.spans;
  const ids = new Set<string>();
  for (const t of score.tracks) for (const m of t.measures) for (const v of m.voices) for (const e of v.events) if (e.id) ids.add(e.id);
  return score.spans.filter((s) => ids.has(s.from) && ids.has(s.to));
}
