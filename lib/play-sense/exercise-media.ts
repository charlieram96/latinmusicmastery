// Pure helpers for the EXERCISE lesson's play-part media (the optional cropped
// video + instrument backing tracks). No DOM, no I/O — unit-tested in
// __tests__/exercise-media.test.ts.

export interface CropWindow {
  /** Largest valid start offset, or null when the video duration is unknown. */
  maxStart: number | null
  start: number
  end: number
}

/**
 * Crop window for the exercise-part video. Only a START offset is stored — the
 * visible window is exactly the score's fixed-BPM length, so the end is derived.
 * When the video is shorter than the score, the start pins to 0 and the window
 * simply runs out at the video's end.
 */
export function cropWindow(
  videoDurationSeconds: number | null,
  scoreLengthSeconds: number,
  requestedStartSeconds: number
): CropWindow {
  if (videoDurationSeconds == null) {
    const start = Math.max(0, requestedStartSeconds)
    return { maxStart: null, start, end: start + scoreLengthSeconds }
  }
  const maxStart = Math.max(0, videoDurationSeconds - scoreLengthSeconds)
  const start = Math.min(Math.max(0, requestedStartSeconds), maxStart)
  return { maxStart, start, end: Math.min(start + scoreLengthSeconds, videoDurationSeconds) }
}

/**
 * Legacy play-along audio: before backing tracks existed, the Watch demo
 * video's audio doubled as the engine's backing track. Keep that behavior ONLY
 * for items with no new exercise media, so existing lessons don't go silent
 * while newly-authored ones get the explicit backing-track mix.
 */
export function resolveLegacyAudioUrl(args: {
  legacyMediaUrl: string | null
  hasBackingTracks: boolean
  hasExerciseVideo: boolean
}): string | undefined {
  if (args.hasBackingTracks || args.hasExerciseVideo) return undefined
  return args.legacyMediaUrl ?? undefined
}
