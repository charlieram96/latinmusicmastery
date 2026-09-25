// Pure module — type-only imports from the actions/components layers, so a
// node-environment test can load it without pulling in 'use server' or React.
import type { ClassItemScoreSection, ExerciseMedia } from '@/app/actions/playsense-studio';
import type { StudioDraft } from '@/app/actions/studio-drafts';
import type { StudioMode, StudioOwner } from '@/app/admin/playsense-studio/[classItemId]/studio-workspace';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { EMPTY_TIMING, timingFromLive, timingToTimeMap } from './timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

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

/** What the workspace opens on: the owner's unpublished draft, else live. */
export function workspaceSeed(input: {
  owner: StudioOwner;
  mode: StudioMode;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  exerciseMedia?: ExerciseMedia | null;
  studioDraft?: StudioDraft | null;
}) {
  const isExercise = input.mode === 'exercise' && input.owner.kind === 'classItem';
  const live =
    input.owner.kind === 'song'
      ? EMPTY_TIMING
      : isExercise
        ? timingFromLive(
            input.exerciseMedia?.timeMap ?? null,
            input.exerciseMedia?.metronomeAnchorSeconds == null
              ? null
              : { seconds: input.exerciseMedia.metronomeAnchorSeconds, qn: null }
          )
        : timingFromLive(input.activeTimeMap, null);
  const timing = input.studioDraft?.timing ?? live;
  return {
    score: input.studioDraft?.score ?? input.initialScore,
    timing,
    timeMap: timingToTimeMap(timing),
    anchorSeconds: timing.anchor?.seconds ?? null,
  };
}
