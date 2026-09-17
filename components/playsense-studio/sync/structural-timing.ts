// PlaySense Studio — structural edits WITH their timing.
//
// A structural edit (insert / delete / paste / append / repeat) changes the
// score and must change the sync markers to match. This module pairs the
// score edit from lib/playsense-studio/measure-edits with a span splice from
// marker-model so the sync panel can adopt both atomically:
//
//   copied or repeated bars keep their sources' video-time shape;
//   blank and appended bars take the pace of the neighbouring bar;
//   later bars ripple by (inserted − removed); deletes close the gap.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import {
  applyMeasureEdit,
  contextAt,
  type MeasureClip,
  type Splice,
  type StructuralAction,
} from '@/lib/playsense-studio/measure-edits';
import { measureLengthInQN, walkMeasures } from '@/lib/playsense-studio/time-mapping';
import {
  copyMeasureSpans,
  paceSpan,
  spliceMeasureSpans,
  type MarkerState,
  type MeasureSpan,
} from './marker-model';

/** Deleting bars closes the gap: later bars slide earlier by the removed span. */
export const DELETE_RIPPLES = true;

export type StructuralEditResult =
  | { ok: true; score: ScoreDocument; markers: MarkerState; splice: Splice }
  | { ok: false; problem: string };

/** Seconds per quarter note of the bar the new bars sit next to. */
function paceAt(markers: MarkerState, index: number): number {
  const n = markers.measures.length;
  if (n === 0) return 0.5;
  const i = Math.min(n - 1, Math.max(0, index > 0 ? index - 1 : 0));
  const [span] = copyMeasureSpans(markers, i, 1);
  return span.lengthQN > 0 ? span.durationSeconds / span.lengthQN : 0.5;
}

/** The bars copied out of a synced score, with their spans and context. */
export function clipFromMeasures(
  markers: MarkerState,
  score: ScoreDocument,
  trackIndex: number,
  start: number,
  count: number
): MeasureClip {
  const track = score.tracks[trackIndex];
  return {
    measures: track.measures.slice(start, start + count),
    context: contextAt(score, track, start),
    instrument: track.instrument,
    spans: copyMeasureSpans(markers, start, count),
  };
}

export function prepareStructuralEdit(
  markers: MarkerState,
  score: ScoreDocument,
  action: StructuralAction,
  opts: { deleteRipples?: boolean } = {}
): StructuralEditResult {
  const edited = applyMeasureEdit(score, action);
  if (!edited.ok) return edited;
  const trackIndex = action.type === 'append-score' ? 0 : action.trackIndex;
  const nextTrack = edited.score.tracks[trackIndex];
  const rows = [...walkMeasures(nextTrack, edited.score)];
  const { splice } = edited;
  const signatureAt = (i: number): [number, number] => rows[i]?.state.timeSignature ?? score.initialTimeSignature;

  let insert: MeasureSpan[] = [];
  let ripple = true;
  switch (action.type) {
    case 'add-measure':
    case 'insert-measure': {
      insert = [paceSpan(paceAt(markers, splice.index), signatureAt(splice.index))];
      break;
    }
    case 'delete-measures':
      ripple = opts.deleteRipples ?? DELETE_RIPPLES;
      break;
    case 'repeat-measures': {
      const source = copyMeasureSpans(markers, splice.index, splice.removeCount);
      insert = Array.from({ length: action.count }, () => source.map((s) => ({ ...s }))).flat();
      break;
    }
    case 'paste-measures': {
      const pace = paceAt(markers, splice.index);
      const fromClip = action.clip.spans;
      insert = Array.from({ length: splice.insertCount }, (_, k) => {
        const ts = signatureAt(splice.index + k);
        const candidate = fromClip?.[k];
        return candidate && Math.abs(candidate.lengthQN - measureLengthInQN(ts)) < 1e-6
          ? { ...candidate }
          : paceSpan(pace, ts);
      });
      break;
    }
    case 'append-score': {
      const pace = paceAt(markers, splice.index);
      insert = Array.from({ length: splice.insertCount }, (_, k) => paceSpan(pace, signatureAt(splice.index + k)));
      break;
    }
  }

  try {
    const next = spliceMeasureSpans(
      markers,
      { index: splice.index, removeCount: splice.removeCount, insert, ripple },
      { track: nextTrack, score: edited.score }
    );
    return { ok: true, score: edited.score, markers: next, splice };
  } catch (err) {
    return { ok: false, problem: err instanceof Error ? err.message : 'The sync could not follow this edit.' };
  }
}
