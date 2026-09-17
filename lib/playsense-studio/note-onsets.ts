// PlaySense Studio — note onsets (pure, no DOM).
//
// An onset is a musical position (quarter notes from the start of the piece)
// at which at least one note or chord starts, on any track. Rests have no
// onset. The sync editor's per-note timing nudges are keyed by onset, because
// the time map is one function of qn shared by every track and voice: two
// tracks hitting the same onset share one time.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';

/** measureNumber -> distinct onset qns, sorted ascending. */
export type OnsetIndex = Map<number, number[]>;

const ONSET_KEY_SCALE = 1e6;

/** Distinct sorted onset qns per measure, across all tracks (rests excluded). */
export function collectOnsets(score: ScoreDocument): OnsetIndex {
  const sets = new Map<number, Map<number, number>>();
  for (const track of score.tracks) {
    const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths ?? 0);
    for (const block of blocks) {
      let set = sets.get(block.measure.number);
      if (!set) {
        set = new Map();
        sets.set(block.measure.number, set);
      }
      for (const ev of block.events) {
        if (ev.isRest) continue;
        // Key by a rounded value so float noise across tracks collapses to one onset.
        set.set(Math.round(ev.qnStart * ONSET_KEY_SCALE), ev.qnStart);
      }
    }
  }
  const out: OnsetIndex = new Map();
  for (const [measureNumber, set] of sets) {
    out.set(measureNumber, [...set.values()].sort((a, b) => a - b));
  }
  return out;
}

/**
 * The onset a staff selection refers to, or null when the selection is a rest
 * or points outside the score.
 */
export function onsetForSelection(
  score: ScoreDocument,
  trackIndex: number,
  ref: { measureIndex: number; eventIndex: number }
): { measureNumber: number; qn: number } | null {
  const track = score.tracks[trackIndex];
  if (!track) return null;
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths ?? 0);
  const block = blocks[ref.measureIndex];
  const ev = block?.events[ref.eventIndex];
  if (!block || !ev || ev.isRest) return null;
  return { measureNumber: block.measure.number, qn: ev.qnStart };
}
