// PlaySense Studio — which slice of the timeline the continuous staff draws:
// one viewport either side of the visible range, kept until the view drifts
// within a third of a viewport of its edge (so scrolling rarely redraws).

export interface RenderWindow { start: number; end: number }

export function renderWindow(scrollLeft: number, viewportWidth: number, prev: RenderWindow | null): RenderWindow {
  const w = Math.max(1, viewportWidth);
  // Same width, compared with a tolerance: (s + 2w) − (s − w) drifts off 3w in
  // floating point at fractional scroll positions, and an exact test would then
  // move the window (and redraw) on every render.
  if (prev && Math.abs(prev.end - prev.start - 3 * w) < 0.5 && scrollLeft - prev.start >= w / 3 && prev.end - (scrollLeft + w) >= w / 3) return prev;
  return { start: scrollLeft - w, end: scrollLeft + 2 * w };
}
