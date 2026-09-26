// PlaySense Studio — "Copy notes from a Watch section" (Studio rework P5,
// Task 7). Replaces the exercise (or jam) score's own track-0 notation with a
// Watch section's, while keeping the exercise document's own identity: its
// title, instrumentation and tempo aren't the section's business.

import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { pruneSpans, reidMeasures } from './event-ids';
import { stripCopyTags } from './measure-clipboard';

/** stripCopyTags drops `repeat` and `endBarline`; a section copy is also never
 *  itself a notated repeat bracket or bracketed ending. */
function stripSectionTags(m: Measure): Measure {
  const { repeatStart: _repeatStart, repeatEnd: _repeatEnd, volta: _volta, ...rest } = stripCopyTags(m);
  return rest;
}

/**
 * Build the score that results from copying a Watch section's notation (its
 * track 0) onto `target`'s track 0 — the exercise score's "Copy notes from a
 * Watch section" action.
 *
 * Every event gets a fresh id (`reidMeasures`), notated repeat brackets are
 * stripped, and the source's slurs/hairpins are carried over onto the fresh
 * ids. The target keeps its own title, track instrumentation and
 * `initialTempo`; the meter and key it's written in follow the source. Spans
 * that pointed at the target's now-replaced notes are pruned. Copied tempo
 * marks arrive unconfirmed (`tempoMarksConfirmed: false`): the Studio's
 * tempo-marks notice asks the admin to confirm or clear them before graded
 * play honours them. Pure: returns a
 * new ScoreDocument (or `target` unchanged if either side has no track).
 */
export function copySectionScore(source: ScoreDocument, target: ScoreDocument): ScoreDocument {
  const sourceTrack = source.tracks[0];
  const targetTrack = target.tracks[0];
  if (!sourceTrack || !targetTrack) return target;

  const { measures, spans: copiedSpans } = reidMeasures(sourceTrack.measures.map(stripSectionTags), source.spans);

  const next: ScoreDocument = {
    ...target,
    initialTimeSignature: source.initialTimeSignature,
    initialKeyFifths: source.initialKeyFifths,
    tracks: target.tracks.map((t, i) => (i === 0 ? { ...t, measures } : t)),
    spans: [...(target.spans ?? []), ...copiedSpans],
    ...(measures.some((m) => m.tempoChange !== undefined) ? { tempoMarksConfirmed: false } : {}),
  };
  next.spans = pruneSpans(next);
  return next;
}
