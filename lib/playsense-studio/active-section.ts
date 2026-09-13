// PlaySense Studio — active scored-section selection.
//
// A video lesson carries multiple scored sections, each valid over a video
// time-range. Given the current video time, this picks which section's notation
// to show (or none → placeholder). Pure so it can be unit-tested in isolation.

export interface SectionRange {
  /** null start = always eligible (the synthetic single-section case). */
  videoStartSeconds: number | null;
  /** null end = open-ended (stays active to the end of the video). */
  videoEndSeconds: number | null;
}

/**
 * Index of the section active at video time `t`, or -1 if none. Among eligible
 * sections (start ≤ t ≤ end), the one with the LATEST start wins, so adjacent or
 * overlapping sections resolve deterministically.
 */
export function pickActiveSection(sections: SectionRange[], t: number): number {
  let best = -1;
  let bestStart = -Infinity;
  sections.forEach((s, i) => {
    const startsOk = s.videoStartSeconds == null || t >= s.videoStartSeconds;
    const endsOk = s.videoEndSeconds == null || t <= s.videoEndSeconds;
    if (!startsOk || !endsOk) return;
    const startVal = s.videoStartSeconds ?? -Infinity;
    if (startVal >= bestStart) {
      bestStart = startVal;
      best = i;
    }
  });
  return best;
}

/**
 * Index of the section whose notation the staff shows at video time `t`. The
 * staff is never blank: the active section wins; during a gap we keep the
 * section that just ended; before the first section we preview the upcoming
 * one; otherwise the first section.
 */
export function pickDisplaySection(sections: SectionRange[], t: number): number {
  if (!sections.length) return -1;
  const active = pickActiveSection(sections, t);
  if (active >= 0) return active;
  const placed = sections
    .map((s, index) => ({ s, index }))
    .filter(({ s }) => s.videoStartSeconds != null)
    .sort((a, b) => (a.s.videoStartSeconds as number) - (b.s.videoStartSeconds as number));
  let previous = -1;
  for (const { s, index } of placed) {
    const end = s.videoEndSeconds ?? s.videoStartSeconds;
    if (end != null && end <= t) previous = index;
  }
  if (previous >= 0) return previous;
  const upcoming = placed.find(({ s }) => (s.videoStartSeconds as number) > t);
  return upcoming ? upcoming.index : 0;
}
