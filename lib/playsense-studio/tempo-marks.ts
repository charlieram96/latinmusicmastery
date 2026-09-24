// PlaySense Studio — per-bar tempo marks (Measure.tempoChange). Imports leave
// marks that disagree with the lesson tempo; graded play ignores tempoChange
// until the admin confirms the marks (score.tempoMarksConfirmed), see spec §8.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface TempoMark { measureIndex: number; measureNumber: number; bpm: number }

export function tempoMarks(score: ScoreDocument, trackIndex = 0): TempoMark[] {
  const track = score.tracks[trackIndex];
  if (!track) return [];
  return track.measures.flatMap((m, i) =>
    m.tempoChange === undefined ? [] : [{ measureIndex: i, measureNumber: m.number, bpm: m.tempoChange }]);
}

export function tempoAt(score: ScoreDocument, trackIndex: number, measureIndex: number): number {
  const track = score.tracks[trackIndex];
  let bpm = score.initialTempo;
  for (let i = 0; track && i <= measureIndex && i < track.measures.length; i++) {
    const t = track.measures[i].tempoChange;
    if (t !== undefined) bpm = t;
  }
  return bpm;
}

export function unconfirmedTempoMarks(score: ScoreDocument, trackIndex = 0): TempoMark[] {
  if (score.tempoMarksConfirmed) return [];
  return tempoMarks(score, trackIndex).filter((m) => Math.abs(m.bpm - score.initialTempo) > 0.5);
}
