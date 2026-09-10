export interface LessonNotationSection {
  id: string;
  label?: string | null;
  videoStartSeconds: number | null;
  videoEndSeconds: number | null;
}

export interface LessonInterlude {
  startSeconds: number;
  endSeconds: number;
  nextLabel: string | null;
}

/** Real video intervals around a section; adjacent/overlapping scores have no gap. */
export function lessonSectionGaps(section: LessonNotationSection, sections: readonly LessonNotationSection[], durationSeconds: number) {
  const placed = sections.filter(s => s.videoStartSeconds != null).sort((a, b) => a.videoStartSeconds! - b.videoStartSeconds!);
  const index = placed.findIndex(s => s.id === section.id);
  const start = section.videoStartSeconds ?? 0;
  const leading: LessonInterlude | null = index === 0 && start > 0
    ? { startSeconds: 0, endSeconds: start, nextLabel: section.label ?? null } : null;
  const next = index >= 0 ? placed[index + 1] : null;
  const end = section.videoEndSeconds;
  const gapEnd = next?.videoStartSeconds ?? durationSeconds;
  const trailing: LessonInterlude | null = end != null && gapEnd > end
    ? { startSeconds: end, endSeconds: gapEnd, nextLabel: next?.label ?? null } : null;
  return { leading, trailing, hasNext: !!next };
}

/** One rounding rule for total and remaining time, including fractional markers. */
export function interludeTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function interludeProgress(ms: number, startMs: number, durationMs: number) {
  const elapsed = Math.max(0, Math.min(durationMs, ms - startMs));
  return { remaining: interludeTime(durationMs - elapsed), progress: durationMs > 0 ? elapsed / durationMs : 0 };
}
