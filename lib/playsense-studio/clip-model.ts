// PlaySense Studio — audio clip geometry (pure, no DOM).
//
// A CLIP is one backing track placed on the studio timeline. It has three
// numbers: where its trimmed-in point lands on the timeline, and how far into
// the SOURCE FILE its usable window starts and ends. Trimming is always
// non-destructive — the upload is never rewritten, so clearing a trim restores
// the original exactly.
//
// Two coordinate spaces meet here and must not be confused:
//   • TIMELINE seconds — the axis the waveform is drawn on (x = t*pps - scroll)
//   • SOURCE seconds   — offsets into the audio file itself (trimIn / trimOut)
// Every mutator below takes a TIMELINE edge, because that is the only thing a
// pointer handler knows; the source-side arithmetic happens in here so no
// component ever does trim math.
//
// The same clamping serves the main track (MediaTrim), which is just a clip
// pinned to timeline zero.

/** Float-noise floor, well below any perceptible sync error. Mirrors marker-model's EPS. */
export const CLIP_EPS = 1e-3;

/** Shortest window a clip may be trimmed to, so an edge drag can never destroy it. */
export const MIN_CLIP_SECONDS = 0.05;

export interface Clip {
  /** Where trimInSeconds lands on the visible timeline. */
  timelineStartSeconds: number;
  /** Offset into the source file where the usable window starts. */
  trimInSeconds: number;
  /** Offset into the source file where it ends; null = play to the end of the file. */
  trimOutSeconds: number | null;
}

export interface ClipBounds {
  /** Source length, learned from the first waveform decode. null = not yet probed. */
  sourceDurationSeconds: number | null;
}

export interface TimeRangeSeconds {
  startSeconds: number;
  endSeconds: number;
}

/**
 * The clip's effective out-point in SOURCE seconds: an explicit trim wins (but
 * can never run past the file), otherwise the file's own end. null means we
 * know neither — the caller must treat the clip as unmeasurable, not as zero.
 */
function resolvedOutSeconds(clip: Clip, bounds: ClipBounds): number | null {
  if (clip.trimOutSeconds != null) {
    return bounds.sourceDurationSeconds != null
      ? Math.min(clip.trimOutSeconds, bounds.sourceDurationSeconds)
      : clip.trimOutSeconds;
  }
  return bounds.sourceDurationSeconds;
}

/** How much timeline the clip occupies. 0 when the source length is still unknown. */
export function clipLength(clip: Clip, bounds: ClipBounds): number {
  const out = resolvedOutSeconds(clip, bounds);
  if (out == null) return 0;
  return Math.max(0, out - clip.trimInSeconds);
}

export function clipTimelineRange(clip: Clip, bounds: ClipBounds): TimeRangeSeconds {
  const startSeconds = clip.timelineStartSeconds;
  return { startSeconds, endSeconds: startSeconds + clipLength(clip, bounds) };
}

/** Slide the whole clip. Trims are untouched, so the length is invariant. */
export function moveClip(clip: Clip, _bounds: ClipBounds, nextTimelineStartSeconds: number): Clip {
  // A drag that leaves the window can produce NaN/Infinity; never persist that.
  if (!Number.isFinite(nextTimelineStartSeconds)) return clip;
  return { ...clip, timelineStartSeconds: Math.max(0, nextTimelineStartSeconds) };
}

/**
 * Drag the LEFT edge to a timeline position. trimIn and timelineStart move by
 * the same delta, so the audio under the rest of the clip stays put — standard
 * DAW trim, as opposed to sliding the content.
 */
export function trimClipIn(clip: Clip, bounds: ClipBounds, timelineEdgeSeconds: number): Clip {
  if (!Number.isFinite(timelineEdgeSeconds)) return clip;

  let delta = timelineEdgeSeconds - clip.timelineStartSeconds;
  // Can't reveal audio before the start of the file...
  delta = Math.max(delta, -clip.trimInSeconds);
  // ...nor push the clip off the front of the timeline.
  delta = Math.max(delta, -clip.timelineStartSeconds);
  // ...nor swallow the clip entirely from the left.
  const out = resolvedOutSeconds(clip, bounds);
  if (out != null) {
    delta = Math.min(delta, out - MIN_CLIP_SECONDS - clip.trimInSeconds);
  }

  return {
    ...clip,
    trimInSeconds: clip.trimInSeconds + delta,
    timelineStartSeconds: clip.timelineStartSeconds + delta,
  };
}

/** Drag the RIGHT edge to a timeline position. Only trimOut moves. */
export function trimClipOut(clip: Clip, bounds: ClipBounds, timelineEdgeSeconds: number): Clip {
  if (!Number.isFinite(timelineEdgeSeconds)) return clip;

  let out = clip.trimInSeconds + (timelineEdgeSeconds - clip.timelineStartSeconds);
  if (bounds.sourceDurationSeconds != null) {
    out = Math.min(out, bounds.sourceDurationSeconds);
  }
  out = Math.max(out, clip.trimInSeconds + MIN_CLIP_SECONDS);
  return { ...clip, trimOutSeconds: out };
}

/**
 * Repair a clip read back from the database. Rows can predate the duration
 * probe, or come from an older/buggier client, so nothing here trusts its
 * input. Idempotent by construction.
 */
export function normalizeClip(clip: Clip, bounds: ClipBounds): Clip {
  const duration = bounds.sourceDurationSeconds;

  const timelineStartSeconds = Number.isFinite(clip.timelineStartSeconds)
    ? Math.max(0, clip.timelineStartSeconds)
    : 0;
  let trimInSeconds = Number.isFinite(clip.trimInSeconds) ? Math.max(0, clip.trimInSeconds) : 0;
  let trimOutSeconds =
    clip.trimOutSeconds != null && Number.isFinite(clip.trimOutSeconds) ? clip.trimOutSeconds : null;

  if (duration != null) {
    if (trimOutSeconds != null) trimOutSeconds = Math.min(trimOutSeconds, duration);
    // An in-point at or past the usable end would leave a zero-length clip that
    // can never be dragged back. Restoring the full window beats silence.
    if (trimInSeconds > (trimOutSeconds ?? duration) - MIN_CLIP_SECONDS) {
      trimInSeconds = 0;
      trimOutSeconds = duration;
    }
  } else if (trimOutSeconds != null && trimInSeconds > trimOutSeconds - MIN_CLIP_SECONDS) {
    trimInSeconds = 0;
  }

  return { timelineStartSeconds, trimInSeconds, trimOutSeconds };
}

/**
 * Snap a timeline value to the nearest candidate (measure downbeats) inside a
 * tolerance. Ties resolve to the lower candidate so the result is deterministic
 * regardless of the order the candidates arrive in.
 */
export function snapToNearest(
  seconds: number,
  candidates: readonly number[],
  toleranceSeconds: number
): number {
  if (!Number.isFinite(seconds)) return seconds;

  let best: number | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue;
    const distance = Math.abs(candidate - seconds);
    if (distance > toleranceSeconds) continue;
    if (
      best === null ||
      distance < bestDistance - CLIP_EPS ||
      (distance <= bestDistance + CLIP_EPS && candidate < best)
    ) {
      best = candidate;
      bestDistance = Math.min(distance, bestDistance);
    }
  }
  return best ?? seconds;
}

// ---- Main track ----------------------------------------------------------
// The main track's trim is the same idea with the start pinned to timeline
// zero: it defines the USABLE REGION of the media. Playback starts at trimIn
// and stops at trimOut, in the studio and for students. It deliberately does
// NOT rebase sync waypoints — those keep their absolute media positions.

export interface MediaTrim {
  trimInSeconds: number;
  /** null = play to the end of the media. */
  trimOutSeconds: number | null;
}

export function normalizeMediaTrim(trim: MediaTrim, durationSeconds: number | null): MediaTrim {
  let trimInSeconds = Number.isFinite(trim.trimInSeconds) ? Math.max(0, trim.trimInSeconds) : 0;
  let trimOutSeconds =
    trim.trimOutSeconds != null && Number.isFinite(trim.trimOutSeconds) ? trim.trimOutSeconds : null;

  if (durationSeconds != null) {
    if (trimOutSeconds != null) trimOutSeconds = Math.min(trimOutSeconds, durationSeconds);
    if (trimInSeconds > (trimOutSeconds ?? durationSeconds) - MIN_CLIP_SECONDS) trimInSeconds = 0;
  } else if (trimOutSeconds != null && trimInSeconds > trimOutSeconds - MIN_CLIP_SECONDS) {
    trimInSeconds = 0;
  }

  return { trimInSeconds, trimOutSeconds };
}

/** The usable region in media seconds. endSeconds is Infinity while the duration is unknown. */
export function trimRange(trim: MediaTrim, durationSeconds: number | null): TimeRangeSeconds {
  const startSeconds = Math.max(0, trim.trimInSeconds);
  let endSeconds: number;
  if (trim.trimOutSeconds != null) {
    endSeconds =
      durationSeconds != null ? Math.min(trim.trimOutSeconds, durationSeconds) : trim.trimOutSeconds;
  } else {
    endSeconds = durationSeconds ?? Infinity;
  }
  return { startSeconds, endSeconds };
}

export function setTrimIn(
  trim: MediaTrim,
  durationSeconds: number | null,
  atSeconds: number
): MediaTrim {
  if (!Number.isFinite(atSeconds)) return trim;
  const { endSeconds } = trimRange(trim, durationSeconds);
  const latest = Number.isFinite(endSeconds) ? endSeconds - MIN_CLIP_SECONDS : Number.MAX_VALUE;
  return { ...trim, trimInSeconds: Math.min(Math.max(0, atSeconds), latest) };
}

export function setTrimOut(
  trim: MediaTrim,
  durationSeconds: number | null,
  atSeconds: number
): MediaTrim {
  if (!Number.isFinite(atSeconds)) return trim;
  let out = atSeconds;
  if (durationSeconds != null) out = Math.min(out, durationSeconds);
  out = Math.max(out, trim.trimInSeconds + MIN_CLIP_SECONDS);
  return { ...trim, trimOutSeconds: out };
}

/** Pull a seek target back into the usable region. */
export function clampToTrim(
  seconds: number,
  trim: MediaTrim,
  durationSeconds: number | null
): number {
  const { startSeconds, endSeconds } = trimRange(trim, durationSeconds);
  if (!Number.isFinite(seconds)) return startSeconds;
  return Math.min(Math.max(seconds, startSeconds), endSeconds);
}
