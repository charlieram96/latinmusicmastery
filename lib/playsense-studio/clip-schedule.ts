// Where and when a clip should sound, given where the playhead is.
//
// Pure so it can be unit-tested in node: this is the arithmetic that decides
// whether a backing track lines up or is a bar out, and it is the last place
// you want to be debugging through a Web Audio graph.
//
// The property that makes rate changes work: the caller sets
// `source.playbackRate = rate`, so a clip's WALL-CLOCK length becomes len/rate
// while its TIMELINE length stays len — because the timeline itself is running
// at `rate`. Context times therefore divide by rate; buffer offsets never do.

export interface SchedulableClip {
  /** Where the clip's trimmed-in point sits on the timeline. */
  timelineStartSeconds: number;
  trimInSeconds: number;
  /** null = play to the end of the buffer. */
  trimOutSeconds: number | null;
  /** buffer.duration. */
  sourceDurationSeconds: number;
}

/** A timeline position pinned to a context time, captured back-to-back. */
export interface Anchor {
  ctxStartSeconds: number;
  timelineStartSeconds: number;
  rate: number;
}

/** The main track's usable region, in timeline seconds. */
export interface UsableRegion {
  startSeconds: number;
  endSeconds: number;
}

export interface ClipSchedule {
  /** AudioContext time to start at. */
  when: number;
  /** Offset INTO THE BUFFER, in source seconds. Never scaled by rate. */
  offset: number;
  /** AudioContext time to stop at. */
  stopAt: number;
}

/**
 * Returns null when the clip should not sound at all from this anchor: it is
 * already finished, or it falls entirely outside the usable region. Callers
 * must NOT cache a null — the next seek has to re-evaluate it.
 */
export function scheduleClip(
  clip: SchedulableClip,
  anchor: Anchor,
  usable: UsableRegion
): ClipSchedule | null {
  const { rate } = anchor;
  if (!(rate > 0) || !(clip.sourceDurationSeconds > 0)) return null;

  const out = Math.min(clip.trimOutSeconds ?? clip.sourceDurationSeconds, clip.sourceDurationSeconds);
  const length = out - clip.trimInSeconds;
  if (!(length > 0)) return null;

  // Footprint on the timeline, cropped to the main track's usable region.
  const clipStart = Math.max(clip.timelineStartSeconds, usable.startSeconds);
  const clipEnd = Math.min(clip.timelineStartSeconds + length, usable.endSeconds);
  if (clipEnd <= clipStart) return null;

  // Where we actually begin, given where the playhead already is.
  const from = Math.max(anchor.timelineStartSeconds, clipStart);
  if (from >= clipEnd) return null;

  const when = anchor.ctxStartSeconds + (from - anchor.timelineStartSeconds) / rate;
  const offset = clip.trimInSeconds + (from - clip.timelineStartSeconds);
  if (offset < 0 || offset >= out) return null;

  const stopAt = anchor.ctxStartSeconds + (clipEnd - anchor.timelineStartSeconds) / rate;
  if (!(stopAt > when)) return null;

  return { when, offset, stopAt };
}
