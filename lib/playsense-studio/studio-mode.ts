/**
 * Which admin Studio shell a class item's page.tsx mounts, by item_type.
 * Pure so the routing decision is unit-testable without rendering the
 * (async, data-fetching) page component itself.
 *
 * - 'videoSections': VIDEO — multiple scored sections, each anchored in the
 *   demo video (own workspace; handles the empty-list case itself).
 * - 'exerciseStudio': EXERCISE — two parts (Watch sections + the graded
 *   score), shelled by ExerciseStudio behind a part toggle.
 * - 'gradedWorkspace': JAM_SESSION (Studio rework P5, Task 8) — the graded
 *   workspace directly (StudioWorkspace mode="exercise"), same shell EXERCISE
 *   uses for its graded part, no Watch part.
 * - 'legacyWorkspace': anything else (QUIZ, and any legacy single-score item)
 *   — the plain StudioWorkspace mode="video" over one score.
 */
export type StudioPageMode = 'videoSections' | 'exerciseStudio' | 'gradedWorkspace' | 'legacyWorkspace';

export function studioModeFor(itemType: string): StudioPageMode {
  if (itemType === 'VIDEO') return 'videoSections';
  if (itemType === 'EXERCISE') return 'exerciseStudio';
  if (itemType === 'JAM_SESSION') return 'gradedWorkspace';
  return 'legacyWorkspace';
}
