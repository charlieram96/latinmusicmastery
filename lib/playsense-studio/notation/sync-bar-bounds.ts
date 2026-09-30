/** Sync uses time-proportional bounds for both engraving and selection. */
export function syncBarBounds(start: number, end: number) {
  return { left: start, right: end };
}
