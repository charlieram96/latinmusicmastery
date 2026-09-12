// Pure. Decides how measures wrap into rows for the printed page, once for all
// selected tracks, so system N of every track holds the same measures.
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { packLessonScoreRows, requiredMeasureWidths } from '@/lib/playsense-studio/notation-layout';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { repeatProjection } from '@/lib/playsense-studio/repeats';

export interface RowPlanRow { startIndex: number; widths: number[] }

export interface RowPlan {
  /** Score after optional repeat collapsing; every track has the same measure count when `aligned`. */
  score: ScoreDocument;
  trackIndexes: number[];
  availWidth: number;
  rows: RowPlanRow[];
  /** True when every selected track has the same measure count and shares `rows`. */
  aligned: boolean;
  /** Per-track rows when not aligned (each track packed on its own). */
  perTrackRows: Record<number, RowPlanRow[]>;
}

/** Collapse repeated passes on every selected track (the student view does the same). */
function collapseRepeats(score: ScoreDocument, trackIndexes: number[]): ScoreDocument {
  let out = score;
  for (const t of trackIndexes) {
    const projection = repeatProjection(out, t);
    if (projection) out = projection.score;
  }
  return out;
}

function trackWidths(score: ScoreDocument, trackIndex: number): number[] {
  const track = score.tracks[trackIndex];
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths);
  return requiredMeasureWidths(blocks);
}

function pack(widths: number[], availWidth: number): RowPlanRow[] {
  return packLessonScoreRows(widths, availWidth, { leading: false, trailing: false })
    .map(r => ({ startIndex: r.startIndex, widths: r.widths }));
}

export function buildRowPlan(
  score: ScoreDocument,
  trackIndexes: number[],
  availWidth: number,
  opts: { expandRepeats: boolean },
): RowPlan {
  const projected = opts.expandRepeats ? score : collapseRepeats(score, trackIndexes);
  const widthsByTrack = trackIndexes.map(t => trackWidths(projected, t));
  const counts = new Set(widthsByTrack.map(w => w.length));
  const aligned = counts.size === 1;

  if (aligned) {
    const merged = widthsByTrack[0].map((_, i) => Math.max(...widthsByTrack.map(w => w[i])));
    const rows = pack(merged, availWidth);
    return { score: projected, trackIndexes, availWidth, rows, aligned, perTrackRows: {} };
  }

  const perTrackRows: Record<number, RowPlanRow[]> = {};
  trackIndexes.forEach((t, k) => { perTrackRows[t] = pack(widthsByTrack[k], availWidth); });
  return { score: projected, trackIndexes, availWidth, rows: [], aligned, perTrackRows };
}
