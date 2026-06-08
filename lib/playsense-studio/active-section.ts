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
