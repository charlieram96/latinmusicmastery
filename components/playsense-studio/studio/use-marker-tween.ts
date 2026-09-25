// Tweens the sync markers from one state to another over a few frames (the
// Auto-place animation, spec §7). Each frame writes a plain VALUE with
// setMarkers, never an updater, and remembers what it wrote in a ref outside
// React's queue. An effect on `markers` then spots a write that isn't ours (a
// drag, a structural edit, a reconcile) and stops the tween, so that write
// wins. Updaters with side effects were unreliable here: React may run them
// late (other updates pending, like the clock's per-frame setState during
// playback) or twice (StrictMode).
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { lerpMarkers } from '@/lib/playsense-studio/auto-place';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';

export const MARKER_TWEEN_MS = 300;

function easeOut(p: number): number {
  return 1 - (1 - p) ** 3;
}

export interface MarkerTween {
  /** Animate from `from` (normally the current markers) to `to`. */
  start(from: MarkerState, to: MarkerState): void;
  /** Stop where it is. onDone is not called. */
  cancel(): void;
  /** True while frames are still being written. A ref, so effects and event
   *  handlers read the live value without re-rendering. */
  running: { readonly current: boolean };
}

export function useMarkerTween(opts: {
  markers: MarkerState;
  setMarkers: (m: MarkerState) => void;
  onDone: (final: MarkerState) => void;
}): MarkerTween {
  const { markers, setMarkers, onDone } = opts;
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastWrittenRef = useRef<MarkerState | null>(null);
  // The latest callbacks, so a tween started in an older render calls the
  // current ones.
  const setMarkersRef = useRef(setMarkers);
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    setMarkersRef.current = setMarkers;
    onDoneRef.current = onDone;
  });

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    runningRef.current = false;
  }, []);

  const write = useCallback((m: MarkerState) => {
    lastWrittenRef.current = m;
    setMarkersRef.current(m);
  }, []);

  const start = useCallback(
    (from: MarkerState, to: MarkerState) => {
      cancel();
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (reducedMotion) {
        write(to);
        onDoneRef.current(to);
        return;
      }
      lastWrittenRef.current = from;
      runningRef.current = true;
      let startedAt: number | null = null;
      const tick = (now: number) => {
        rafRef.current = null;
        if (!runningRef.current) return;
        startedAt ??= now;
        const p = Math.min(1, (now - startedAt) / MARKER_TWEEN_MS);
        if (p < 1) {
          write(lerpMarkers(from, to, easeOut(p)));
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        runningRef.current = false;
        write(to);
        onDoneRef.current(to);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancel, write]
  );

  // A foreign write wins: once the rendered markers are something this tween
  // didn't write, stop writing frames over them.
  useEffect(() => {
    if (runningRef.current && markers !== lastWrittenRef.current) cancel();
  }, [markers, cancel]);

  useEffect(() => cancel, [cancel]);

  return { start, cancel, running: runningRef };
}
