// Pure module — type-only imports from the actions/components layers, so a
// node-environment test can load it without pulling in 'use server' or React.
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio';
import { timingFromLive, timingToTimeMap } from './timing';

/** What a section's editor opens on: its unpublished draft, else what students see. */
export function sectionSeed(s: ClassItemScoreSection) {
  const timing = s.studioDraft?.timing ?? timingFromLive(
    s.activeTimeMap,
    s.metronomeAnchorSeconds == null ? null : { seconds: s.metronomeAnchorSeconds, qn: s.metronomeAnchorQn }
  );
  return {
    score: s.studioDraft?.score ?? s.scoreDocument.parsedScore,
    timing,
    timeMap: timingToTimeMap(timing),
    anchorSeconds: timing.anchor?.seconds ?? null,
  };
}
