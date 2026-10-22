import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
// Pure module — type-only imports from the actions/components layers, so a
// node-environment test can load it without pulling in 'use server' or React.
import type { ClassItemScoreSection, ExerciseMedia } from '@/app/actions/playsense-studio';
import type { StudioDraft } from '@/app/actions/studio-drafts';
import type { StudioMode, StudioOwner } from '@/app/admin/playsense-studio/[classItemId]/studio-workspace';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { EMPTY_TIMING, timingFromLive, timingToTimeMap, type StudioTiming } from './timing';
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
  // 'exercise' mode is the graded workspace (EXERCISE and JAM_SESSION items
  // alike — see Studio rework P5): bar 1 places the media, so there's no time
  // map to seed; preserve play-along settings and the independent click anchor.
  const live: StudioTiming =
    input.owner.kind === 'song'
      ? EMPTY_TIMING
      : isExercise
        ? { ...EMPTY_TIMING, play: input.exerciseMedia?.play, anchor: input.exerciseMedia?.metronomeAnchorSeconds == null ? null : {seconds: input.exerciseMedia.metronomeAnchorSeconds, qn: input.exerciseMedia.metronomeAnchorQn} }
        : timingFromLive(input.activeTimeMap, null);
  const timing = input.studioDraft?.timing ?? live;
  return {
    score: input.studioDraft?.score ?? input.initialScore,
    timing,
    timeMap: timingToTimeMap(timing),
    anchorSeconds: timing.anchor?.seconds ?? null,
  };
}

/** Authoring lanes use the same draft clock as the section editor. */
export function sectionDraftRange(s: ClassItemScoreSection) {
  const points = sectionSeed(s).timing.waypoints;
  if (points.length >= 2) {
    const times = points.map(p => p.videoTimeSeconds).filter(Number.isFinite);
    if (times.length >= 2) return { startSeconds: Math.min(...times), endSeconds: Math.max(...times) };
  }
  // An explicitly unplaced draft must not resurrect a published position.
  return s.studioDraft
    ? { startSeconds: null, endSeconds: null }
    : { startSeconds: s.videoStartSeconds, endSeconds: s.videoEndSeconds };
}

/** Unplaced imports remain visible after preceding sections as previews only.
 * Authored placements are never reordered or written by this projection. */
export function sectionTimelineSeeds(sections: ClassItemScoreSection[]) {
  let previousEnd = 0;
  return sections.map(section => {
    const seed = sectionSeed(section);
    const range = sectionDraftRange(section);
    const preview = range.startSeconds == null;
    const timing = preview ? { ...seed.timing, waypoints: (seed.score.tracks?.length ? buildWaypoints(seed.score, seed.score.initialTempo, previousEnd) : []) } : seed.timing;
    const startSeconds = preview ? timing.waypoints[0]?.videoTimeSeconds ?? previousEnd : range.startSeconds;
    const endSeconds = preview ? timing.waypoints.at(-1)?.videoTimeSeconds ?? previousEnd : range.endSeconds;
    previousEnd = Math.max(previousEnd, endSeconds ?? previousEnd);
    return { sectionId: section.sectionId, score: seed.score, timing, startSeconds, endSeconds, preview };
  });
}

/** Timeline order for both the inspector and lane; new unplaced imports follow
 * placed music in upload order. Sorting never changes authored timestamps. */
export function orderedScoreSections(sections: ClassItemScoreSection[]) {
  return [...sections].sort((a,b) => {
    const aStart=sectionDraftRange(a).startSeconds;
    const bStart=sectionDraftRange(b).startSeconds;
    if(aStart!=null && bStart!=null && aStart!==bStart) return aStart-bStart;
    if(aStart==null && bStart!=null) return 1;
    if(aStart!=null && bStart==null) return -1;
    return a.sectionIndex-b.sectionIndex;
  });
}
