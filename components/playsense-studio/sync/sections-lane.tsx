'use client';

// PlaySense Studio — scored-sections lane.
//
// A thin strip under the waveform showing WHERE each scored section sits on the
// video timeline, in the same x = t*pps - scrollLeft coordinate space as the
// canvas. Sibling sections render from their published video ranges; the ACTIVE
// section renders live from its marker span (so it tracks drags in real time);
// an optional ghost block previews a pending "place at playhead".

import { useRef } from 'react';
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
  /** Reports the active section being dragged along the video, in delta
   *  seconds from where the drag started. Absent = the active block sits still. */
  onDragActive?: (deltaSeconds: number, phase: 'move' | 'end') => void;
}

/** Below this, a pointerdown-then-up on the active block is a click, not a drag. */
const DRAG_DEAD_ZONE_PX = 4;

export function SectionsLane({
  sections,
  activeSectionId,
  activeRange,
  ghostRange,
  ghostConflict,
  pixelsPerSecond,
  scrollLeftPx,
  onSelectSection,
  onDragActive,
}: SectionsLaneProps) {
  const toX = (t: number) => t * pixelsPerSecond - scrollLeftPx;

  // Active-section drag bookkeeping. Kept out of React state: onDragActive
  // already re-renders this lane (via the parent's marker state), so the drag's
  // own pointer tracking doesn't need to trigger a render of its own.
  const dragRef = useRef<{ pointerId: number; startX: number; dragging: boolean } | null>(null);
  // A `click` event fires right after pointerup wherever the pointer released,
  // ignoring pointer capture — it can land on a different (now-adjacent) block.
  // A real drag must swallow that one trailing click, wherever it lands.
  const suppressClickRef = useRef(false);

  const onActivePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!onDragActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, dragging: false };
  };
  const onActivePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.dragging) {
      if (Math.abs(dx) < DRAG_DEAD_ZONE_PX) return;
      d.dragging = true;
    }
    onDragActive?.(dx / pixelsPerSecond, 'move');
  };
  // Shared by pointerup, pointercancel and lostpointercapture: whichever fires
  // first ends the drag (reporting 'end' if it had really started) and clears
  // dragRef; a second one for the same pointer (e.g. the implicit
  // lostpointercapture that follows an explicit releasePointerCapture call)
  // finds dragRef already null and is a no-op.
  const finishDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (d.dragging) {
      onDragActive?.((e.clientX - d.startX) / pixelsPerSecond, 'end');
      suppressClickRef.current = true;
      // The trailing click can land outside the lane entirely (the pointer
      // drifted off it before release), in which case onClickCapture below
      // never runs and the flag would stick, swallowing some later, unrelated
      // click. A click arriving in the same turn as this one is still caught
      // (it runs before this timeout fires); anything after self-clears.
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
  };

  return (
    <div
      className="st-sections-lane"
      aria-label="Scored sections on the timeline"
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
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
            title={isActive ? 'Drag to move this section' : `${s.label} — click to edit`}
            onClick={() => !isActive && onSelectSection(s.sectionId)}
            onPointerDown={isActive ? onActivePointerDown : undefined}
            onPointerMove={isActive ? onActivePointerMove : undefined}
            onPointerUp={isActive ? finishDrag : undefined}
            onPointerCancel={isActive ? finishDrag : undefined}
            onLostPointerCapture={isActive ? finishDrag : undefined}
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
