// Compás — renderer interface.
//
// Every notation surface (staff, tab, fretboard, rhythm grid, PDF) implements
// this interface. The player wires the same hooks to all of them, so swapping
// the active view is a one-line operation.
//
// The interface is imperative because the underlying renderers (VexFlow, SVG,
// pdf.js) are imperative. React components in components/compas/player/notation/
// renderers/ wrap these classes thinly.

import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

export interface SeekTarget {
  /** Cumulative quarter notes from start, used by TimeMap.toVideoTime(). */
  qn: number;
  /** 1-based measure containing this target. */
  measure: number;
  /** 1-based beat within the measure. */
  beat: number;
}

export type SeekListener = (target: SeekTarget) => void;

export interface ScoreRenderer {
  /**
   * Mount the renderer into a DOM element. The element should be empty;
   * any prior content is cleared. Re-mounting rebuilds the layout.
   */
  mount(el: HTMLElement, score: ScoreDocument, trackIndex: number): void;

  /**
   * Move the playback cursor to the given score-relative time in milliseconds.
   * Cheap to call at 60fps — implementations should update via direct DOM
   * mutation, not React re-render.
   */
  setTimeMs(ms: number): void;

  /**
   * Register a callback for click-to-seek. Returns an unsubscribe function.
   */
  onSeek(listener: SeekListener): () => void;

  /**
   * Tear down the rendered SVG/canvas and detach all event listeners.
   * Idempotent — safe to call multiple times.
   */
  destroy(): void;
}
