// Auto-align for the graded Studio (spec §8): where bar 1 sits in the media.
// The graded onsets are fixed by the score's tempo grid (seconds from bar 1),
// so aligning is one number — the shift that lands the most onsets on detected
// hits. Pure; the SyncPanel's graded mode owns the UI.

/** How close an onset must be to a hit to count as on it. */
export const ON_HIT_S = 0.03;
/** How far from the current bar 1 Auto-align looks. */
const SEARCH_S = 2;
/** Below this many matched onsets, a candidate is noise, not an alignment. */
const MIN_MATCHES = 3;

/**
 * One-to-one matches between `onsets` (shifted by `shift`) and `hits`, both
 * ascending, within ON_HIT_S. Greedy in time order: each onset takes the first
 * unused hit in its window, so two onsets never share a hit.
 */
function matches(onsets: readonly number[], hits: readonly number[], shift: number): number {
  let j = 0;
  let k = 0;
  for (const o of onsets) {
    const t = o + shift;
    while (j < hits.length && hits[j] < t - ON_HIT_S) j++;
    if (j < hits.length && Math.abs(hits[j] - t) <= ON_HIT_S) {
      k++;
      j++;
    }
  }
  return k;
}

const ascending = (xs: readonly number[]) => {
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) return [...xs].sort((a, b) => a - b);
  return xs;
};

/** Candidate bar-1 values = h − onset for every (hit h, onset) pair with h within ±2 s of current + onset; score = one-to-one matches within 30 ms; best score, ties → nearest current. null when no candidate matches ≥ 3 onsets. */
export function autoAlign(onsets: number[], hits: number[], current: number): number | null {
  const os = ascending(onsets);
  const hs = ascending(hits);
  let best: { value: number; score: number } | null = null;
  const seen = new Set<number>();
  for (const o of os) {
    const lo = current + o - SEARCH_S;
    const hi = current + o + SEARCH_S;
    for (const h of hs) {
      if (h < lo) continue;
      if (h > hi) break;
      const candidate = h - o;
      // Pairs that give the same shift (to the microsecond) score the same.
      const key = Math.round(candidate * 1e6);
      if (seen.has(key)) continue;
      seen.add(key);
      const score = matches(os, hs, candidate);
      if (
        !best ||
        score > best.score ||
        (score === best.score && Math.abs(candidate - current) < Math.abs(best.value - current))
      ) {
        best = { value: candidate, score };
      }
    }
  }
  return best && best.score >= MIN_MATCHES ? best.value : null;
}

/** How many of the graded onsets (placed at `bar1`) sit within 30 ms of a hit, one to one. */
export function onHitCount(onsets: number[], hits: number[], bar1: number): { k: number; n: number } {
  return { k: matches(ascending(onsets), ascending(hits), bar1), n: onsets.length };
}
