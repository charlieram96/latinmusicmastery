import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export function staffGroupIndices(score: ScoreDocument, index: number): number[] {
  const group = score.tracks[index]?.staffGroup;
  return group ? score.tracks.flatMap((t, i) => t.staffGroup === group ? [i] : []) : [index];
}

/** Selecting an instrument must retain every one of its staves and its spans. */
export function selectInstrument(score: ScoreDocument, index: number): ScoreDocument {
  const tracks = staffGroupIndices(score, index).map((i, index) => ({ ...score.tracks[i], index }));
  const ids = new Set(tracks.flatMap(t => t.measures.flatMap(m => m.voices.flatMap(v => v.events.map(e => e.id)))));
  return { ...score, tracks, ...(score.spans ? { spans: score.spans.filter(s => ids.has(s.from) && ids.has(s.to)) } : {}) };
}
