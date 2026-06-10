'use client';

// PlaySense Studio — scored-sections lane.
//
// A thin strip under the waveform showing WHERE each scored section sits on the
// video timeline, in the same x = t*pps - scrollLeft coordinate space as the
// canvas. Sibling sections render from their published video ranges; the ACTIVE
// section renders live from its marker span (so it tracks drags in real time);
// an optional ghost block previews a pending "place at playhead".

import type { TimeRange } from '@/components/playsense-studio/sync/marker-model';

/** Shared palette for section blocks + the left-rail list dots. */
export const SECTION_COLORS = [
  '25 90% 55%', // amber
  '180 55% 45%', // teal
  '280 50% 60%', // violet
  '340 65% 55%', // rose
  '95 45% 48%', // green
  '210 70% 58%', // blue
];

export function sectionColor(index: number): string {
  return `hsl(${SECTION_COLORS[index % SECTION_COLORS.length]})`;
}

export interface LaneSection {
  sectionId: string;
  label: string;
  startSeconds: number | null;
  endSeconds: number | null;
}

export interface SectionsLaneProps {
  sections: LaneSection[];
  activeSectionId: string;
  /** Live footprint of the section being edited (from markerSpan(markers)). */
  activeRange: TimeRange;
  /** Armed place-at-playhead preview; null when not previewing. */
  ghostRange: TimeRange | null;
  ghostConflict: boolean;
  pixelsPerSecond: number;
  scrollLeftPx: number;
  onSelectSection: (sectionId: string) => void;
}

export function SectionsLane({
  sections,
  activeSectionId,
  activeRange,
  ghostRange,
  ghostConflict,
  pixelsPerSecond,
  scrollLeftPx,
  onSelectSection,
}: SectionsLaneProps) {
  const toX = (t: number) => t * pixelsPerSecond - scrollLeftPx;

  return (
    <div className="st-sections-lane" aria-label="Scored sections on the timeline">
      {sections.map((s, i) => {
        const isActive = s.sectionId === activeSectionId;
        // The active section always draws from its LIVE marker span; siblings
        // need a published range to have a position at all.
        const start = isActive ? activeRange.startSeconds : s.startSeconds;
        const end = isActive ? activeRange.endSeconds : s.endSeconds;
        if (start == null || end == null || end <= start) return null;

        const x = toX(start);
        const w = (end - start) * pixelsPerSecond;
        if (x + w < 0 || w <= 0) return null; // off-screen left / degenerate

        return (
          <button
            key={s.sectionId}
            type="button"
            className={`st-section-block${isActive ? ' is-active' : ''}`}
            style={{ left: x, width: Math.max(w, 14), ['--block-color' as string]: sectionColor(i) }}
            title={isActive ? `${s.label} (editing)` : `${s.label} — click to edit`}
            onClick={() => !isActive && onSelectSection(s.sectionId)}
          >
            <span className="st-section-block-label">{s.label}</span>
          </button>
        );
      })}

      {ghostRange && (
        <div
          className={`st-section-block is-ghost${ghostConflict ? ' is-conflict' : ''}`}
          style={{
            left: toX(ghostRange.startSeconds),
            width: Math.max((ghostRange.endSeconds - ghostRange.startSeconds) * pixelsPerSecond, 14),
          }}
        >
          <span className="st-section-block-label">
            {ghostConflict ? 'Overlaps another section' : 'Score will land here'}
          </span>
        </div>
      )}
    </div>
  );
}
