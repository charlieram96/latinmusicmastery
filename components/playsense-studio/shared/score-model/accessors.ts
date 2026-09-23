// Read the score model's notation fields whether a score was saved before the
// additive fields existed (legacy `dotted`, `triplet`, `articulation`,
// `spellingHint`) or after. New code reads through these, never the raw fields.
import type { Articulation, MusicalEvent, ScoreDocument, Spelling } from './types';

export function eventDots(e: MusicalEvent): 0 | 1 | 2 {
  return e.dots ?? (e.dotted ? 1 : 0);
}

export function eventTuplet(e: MusicalEvent): { id?: string; n: number; m: number } | null {
  if (e.tuplet) return e.tuplet;
  return e.triplet ? { n: 3, m: 2 } : null;
}

/** Factor the tuplet applies to the written value (3:2 → 2/3). */
export function tupletScale(e: MusicalEvent): number {
  const t = eventTuplet(e);
  return t ? t.m / t.n : 1;
}

export function eventArticulations(e: MusicalEvent): Articulation[] {
  if (e.articulations) return e.articulations;
  return e.articulation ? [e.articulation] : [];
}

const HINT = /^([A-Ga-g])(bb|b|##|#|x)?$/;
const ALTER: Record<string, Spelling['alter']> = { bb: -2, b: -1, '#': 1, '##': 2, x: 2 };

export function parseSpellingHint(hint?: string): Spelling | null {
  const m = hint ? HINT.exec(hint.trim()) : null;
  if (!m) return null;
  return { step: m[1].toUpperCase() as Spelling['step'], alter: m[2] ? ALTER[m[2]] : 0 };
}

export function eventSpelling(n: { spelling?: Spelling; spellingHint?: string }): Spelling | null {
  return n.spelling ?? parseSpellingHint(n.spellingHint);
}

/** Give every event an id. Returns the same object when nothing was missing. */
export function ensureEventIds(score: ScoreDocument, makeId: () => string): ScoreDocument {
  const missing = score.tracks.some(t => t.measures.some(m => m.voices.some(v => v.events.some(e => !e.id))));
  if (!missing) return score;
  return {
    ...score,
    tracks: score.tracks.map(t => ({
      ...t,
      measures: t.measures.map(m => ({
        ...m,
        voices: m.voices.map(v => ({ ...v, events: v.events.map(e => (e.id ? e : { ...e, id: makeId() })) })),
      })),
    })),
  };
}
