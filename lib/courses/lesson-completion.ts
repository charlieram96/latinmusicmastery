export type LessonActivity = 'media' | 'performance' | 'questions'
export type CompletionStatus = 'in-progress' | 'saving' | 'complete' | 'error'
export interface ItemCompletion {
  activities: LessonActivity[]
  status: CompletionStatus
}

/** Watching an exercise demo doesn't finish the performance or its questions. */
export function completionRequirements(type: string, hasPerformance: boolean, hasQuestions: boolean): LessonActivity[] {
  if (type === 'VIDEO' || type === 'JAM_SESSION') return ['media']
  if (type === 'QUIZ') return hasQuestions ? ['questions'] : []
  if (type === 'EXERCISE') return [
    ...(hasPerformance ? ['performance' as const] : []),
    ...(hasQuestions ? ['questions' as const] : []),
  ]
  return []
}

/** Duplicate end events and rerenders must not submit progress twice. */
export function finishLessonActivity(current: ItemCompletion | undefined, activity: LessonActivity, required: readonly LessonActivity[]): ItemCompletion | undefined {
  if (!required.includes(activity) || current?.activities.includes(activity) || current?.status === 'complete') return current
  const activities = [...(current?.activities ?? []), activity]
  return { activities, status: required.every(part => activities.includes(part)) ? 'saving' : 'in-progress' }
}

/** Results also appear after Stop; only reaching the end completes an exercise. */
export function finishedExercise(state: string, progress: number, preview: boolean): boolean {
  return !preview && state === 'results' && Number.isFinite(progress) && progress >= 1
}
