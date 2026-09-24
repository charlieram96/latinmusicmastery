// PlaySense Studio — the timeline's zoom (pixels-per-second) limits and clamp.

export const MIN_PPS = 8;
export const MAX_PPS = 600;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}
