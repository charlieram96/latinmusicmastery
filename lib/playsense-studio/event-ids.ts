// PlaySense Studio — event-id integrity. Slurs and hairpins (score.spans) point
// at events by id, so ids must be unique and spans must never point at an
// event that is gone.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/** The spans whose two ends still exist; undefined stays undefined. */
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans'] {
  if (!score.spans) return score.spans;
  const ids = new Set<string>();
  for (const t of score.tracks) for (const m of t.measures) for (const v of m.voices) for (const e of v.events) if (e.id) ids.add(e.id);
  return score.spans.filter((s) => ids.has(s.from) && ids.has(s.to));
}
