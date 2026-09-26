# Studio Rework P4b — Flex Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In video lessons and the exercise Watch part, the admin can stretch the teacher's recording so the played notes land on the written ones (Logic-style Flex Time). Students then hear and see the stretched performance: the video plays at a per-segment rate with pitch preserved, and the notation follows.

**Architecture:**
- **Two times.** There are two time domains. *Media time* is seconds in the video file. *Timeline time* is where the score lives: bar markers, waypoints, nudges and note ticks.
- **The flex map.** A flex map (`params.flex: {src, dst, anchor}[]` on the time map) is a monotonic piecewise-linear warp between them. Media equals timeline outside the outermost flex markers. With no flex, the two domains are identical, so all existing data keeps working unchanged.
- **Where the conversion happens.** It happens only at the edges:
  - the video element's clock is media, so it is converted to timeline for the cursor and playhead
  - seeks go timeline → media
  - the waveform peaks and detected hits are media, so they are converted for drawing, snapping, flags and Auto-place
  - the playback rate is per segment
- **Rate driver.** One rAF-driven rate driver sets `video.playbackRate = userSpeed × segment ratio` with `preservesPitch = true`. Admin playback and student playback both use it.
- **No drift correction needed.** The notation clock is *derived from the video's own media time* through the map, so notes can never drift from the audio. This is why no ±3% drift trim is needed: the rate only makes the timeline advance at a steady pace.

**Tech Stack:** React 19, TypeScript, canvas 2D, HTMLMediaElement `playbackRate` / `preservesPitch`, vitest (+ jsdom; no testing-library).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` §7 "Flex Time". The spike gate is assumed passed on the user's instruction (2026-09-26: "assume it works now"). The spike results are recorded when the user runs it.

## Global Constraints

- **Git rules:**
  - Never run `git stash` in any form. Use `git show HEAD:<path>` to compare.
  - Stage only your files, by explicit path.
  - Commit messages are imperative with no prefix, then a blank line and your `Co-Authored-By` trailer.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**'`. Typecheck: `npx tsc --noEmit -p .`. Lint: `npx eslint --no-cache <files>`. Add no new lint issues against the plan's base commit, and compare from stdin when a file already has issues.
  - Component tests start with `// @vitest-environment jsdom` and use `createRoot` + `act`.
- **Data:**
  - `params.flex: Array<{ src: number; dst: number; anchor: boolean }>`, sorted, with `src` and `dst` both strictly increasing.
  - Media equals timeline outside the first and last point. It is stored on the section's time map through the Plan 6 draft path (never written live).
  - Flex applies only to **Watch sections** (video lessons and the exercise Watch part), never to the graded exercise play-along.
- **Flex points** must lie strictly inside the section's bar span (first downbeat … tail). The section's edges are therefore identity, and a section's video range means the same thing in both domains.
- **Rate driver:**
  - `rate = userSpeed × (Δsrc / Δdst)` of the current segment, clamped to [0.5, 2.0].
  - `preservesPitch = true`, plus `webkitPreservesPitch` where present.
  - It writes only when the change exceeds 0.001.
  - Outside flex segments, `rate = userSpeed`.
- **UI:**
  - Snapping to written notes uses 8 px (`SNAP_PX` from `lib/playsense-studio/hits.ts`). ⌘ skips the snap.
  - Stretched-region tint: slower (Δdst > Δsrc) is blue `hsl(210 90% 55% / .14)`, faster is orange `hsl(28 95% 55% / .14)`.
  - The Flex toggle is a context-bar chip, `Flex`, plus the F key when the measure zoom is closed and focus isn't in a text field. The zoom uses F as a note letter.
- **Exact copy:**
  - Chip: `Flex`.
  - Drag label: `+12 ms · 104%` (signed ms of dst−src, then the segment speed as a %).
  - Quantize button: `Quantize`. Popover: title `Quantize to the score`, a strength slider with label `Strength` (default 70%), preview `<n> notes will move, largest <m> ms` or `No notes to move`, and buttons `Apply` and `Reset flex`.
  - Timing tab button: `Flex the recording onto this note`.
  - Measure bar info when flexed: `flexed ±<m> ms`.
- **Quantize:**
  - Match each written note onset in the selected bars to the nearest hit within ⅓ beat (one-to-one, in onset order).
  - Each matched hit gets a point with `dst = hit + strength × (note − hit)`, where `hit` is in timeline time before the new flex.
  - Anchor points go at the first and last bar lines of the selection (`anchor: true`), unless points already exist there.

## Decisions this plan makes

1. **No drift trim.** The spec's "drift beyond 60 ms is corrected by a ±3% trim" assumed the notes run on a separate wall clock. Here the notation is derived from the video's media time, so it can't drift. The rate only paces the timeline, and a small rate error only means a tiny tempo wobble. Leaving out the trim also avoids fighting the click and backing reschedules on every `ratechange`.
2. **Where the user's speed lives.** With flex active, the student's speed menu sets a `userSpeed` that the rate driver multiplies in. The transport shows `userSpeed`, not the flickering element rate.
3. **Anchors.** Clicking a hit adds a point at that hit and pins its neighbouring hits as anchors (only if no point exists there). Double-clicking a point removes it. Anchors left with no non-anchor neighbour are removed with it.
4. **The student click track** schedules beats at `toMedia(beatTimeline)`, so the click follows the stretched recording.
5. **Deleting the spike page.** `app/(dev)/flex-spike` stays until the user has run it. Deleting it is Plan 7's cleanup item.

## Review Focus

1. **No flex.** Existing lessons behave exactly as before, in the admin and for students: cursor, seeks, loops, click, rates. Test: identity map tests in Task 1, and player mapping tests in Task 4.
2. **The user's speed with flex.** At 0.75× plus a 110% segment, the rate is 0.825. The transport shows 0.75×. Test: Task 3.
3. **Seeking and looping in the student player** across flexed segments. They land on the right note: seek target = `toMedia(toVideoTime(qn))`. Test: Task 4.
4. **Only on publish.** Flex edits reach students only through Publish, and a flex-only edit counts as a change (the preview says "Timing changed"). Test: Task 2.
5. **Monotonic points.** Dragging a flex point can never cross a neighbour or leave the section span, so the map stays strictly monotonic. Test: Task 1 (`moveFlexPoint` clamps).

---

## File map

| File | Responsibility |
|---|---|
| `lib/playsense-studio/flex.ts` | `FlexPoint`, `FlexMap` (`toTimeline`, `toMedia`, `segmentAt`, `rateAt`), `readFlex`, edits (`addFlexAtHit`, `moveFlexPoint`, `removeFlexPoint`), `quantizePlan`, `flexWithin` |
| `lib/playsense-studio/use-flex-playback.ts` | the rAF rate driver hook |
| `components/playsense-studio/player/playsense-studio-player.tsx` | student: map clock ↔ timeline, seeks, loops, click grid, speed |
| `app/actions/playsense-studio.ts` | `loadTimeMap` returns `flex` |
| `lib/playsense-studio/drafts/{timing,timing-patch,changes}.ts` | flex through the draft |
| `components/playsense-studio/studio/sync-panel.tsx` | admin: flex state, domain conversions, rate driver, UI wiring |
| `components/playsense-studio/sync/waveform-canvas.tsx` | the warped peaks, the flex layer, flex pointer interactions |
| `components/playsense-studio/studio/measure/{measure-bar,quantize-popover}.tsx` + `integrated-editor.tsx` | Quantize |
| `components/playsense-studio/studio/zoom/more-popover.tsx` + `note-details.tsx` | Flex this note |

---

### Task 1: The flex map and its edits (pure)

**Files:**
- Create: `lib/playsense-studio/flex.ts`
- Test: `lib/playsense-studio/__tests__/flex.test.ts`

**Interfaces (produced):**

```ts
export interface FlexPoint { src: number; dst: number; anchor: boolean }
export const FLEX_RATE_MIN = 0.5;
export const FLEX_RATE_MAX = 2;
export function readFlex(params: unknown): FlexPoint[];            // defensive; drops malformed; sorts; drops non-monotonic
export class FlexMap {
  constructor(points: FlexPoint[]);
  readonly points: FlexPoint[];
  readonly isIdentity: boolean;
  toTimeline(media: number): number;
  toMedia(timeline: number): number;
  /** Segment index containing a MEDIA time: -1 before the first point, points.length-1 after the last. */
  segmentAtMedia(media: number): number;
  /** Media seconds per timeline second at a media time (1 outside the points), clamped to [FLEX_RATE_MIN, FLEX_RATE_MAX]. */
  rateAtMedia(media: number): number;
}
export function addFlexAtHit(points: FlexPoint[], hitMedia: number, hitsMedia: number[], span: { start: number; end: number }): FlexPoint[];
export function moveFlexPoint(points: FlexPoint[], index: number, dst: number, span: { start: number; end: number }): FlexPoint[];
export function removeFlexPoint(points: FlexPoint[], index: number): FlexPoint[];
export function flexWithin(points: FlexPoint[], span: { start: number; end: number }): FlexPoint[]; // drop points outside (start, end)
export function quantizePlan(input: {
  points: FlexPoint[]; notesTimeline: number[]; hitsMedia: number[]; beatSeconds: number;
  range: { start: number; end: number }; strength: number;
}): { points: FlexPoint[]; moved: number; largestMs: number };
export function resetFlexRange(points: FlexPoint[], range: { start: number; end: number }): FlexPoint[];
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/__tests__/flex.test.ts
import { describe, expect, it } from 'vitest';
import { FlexMap, addFlexAtHit, moveFlexPoint, quantizePlan, readFlex, removeFlexPoint, resetFlexRange } from '../flex';

const p = (src: number, dst: number, anchor = false) => ({ src, dst, anchor });
const span = { start: 0, end: 100 };

describe('FlexMap', () => {
  it('is the identity with no points', () => {
    const m = new FlexMap([]);
    expect(m.isIdentity).toBe(true);
    expect(m.toTimeline(12.3)).toBe(12.3);
    expect(m.toMedia(12.3)).toBe(12.3);
    expect(m.rateAtMedia(5)).toBe(1);
  });
  it('maps piecewise-linearly and inverts', () => {
    const m = new FlexMap([p(10, 10, true), p(12, 12.5), p(14, 14, true)]);
    expect(m.toTimeline(11)).toBeCloseTo(11.25);
    expect(m.toMedia(11.25)).toBeCloseTo(11);
    expect(m.toTimeline(13)).toBeCloseTo(13.25);
    expect(m.toTimeline(5)).toBe(5);   // outside: identity
    expect(m.toTimeline(20)).toBe(20);
    for (const t of [9, 10.3, 11.9, 12.5, 13.7, 15]) expect(m.toMedia(m.toTimeline(t))).toBeCloseTo(t, 9);
  });
  it('reports the media rate per segment, clamped', () => {
    const m = new FlexMap([p(10, 10), p(12, 12.5), p(14, 14)]);
    expect(m.rateAtMedia(11)).toBeCloseTo(2 / 2.5); // slower
    expect(m.rateAtMedia(13)).toBeCloseTo(2 / 1.5); // faster
    expect(m.rateAtMedia(20)).toBe(1);
    expect(new FlexMap([p(0, 0), p(1, 5)]).rateAtMedia(0.5)).toBe(0.5); // clamped
  });
  it('reads params defensively', () => {
    expect(readFlex({ flex: [p(2, 2), { src: 'x' }, p(1, 1), p(3, 2.5)] })).toEqual([p(1, 1), p(2, 2), p(3, 2.5)]);
    expect(readFlex({ flex: [p(1, 1), p(2, 0.5)] })).toEqual([p(1, 1)]); // non-monotonic dst dropped
    expect(readFlex(null)).toEqual([]);
  });
});

describe('flex edits', () => {
  it('adds a point at a hit and pins its neighbours as anchors', () => {
    const pts = addFlexAtHit([], 12, [10, 12, 14, 16], span);
    expect(pts).toEqual([p(10, 10, true), p(12, 12), p(14, 14, true)]);
    // a second add next to it reuses the existing anchor and turns it into a real point
    expect(addFlexAtHit(pts, 14, [10, 12, 14, 16], span)).toEqual([p(10, 10, true), p(12, 12), p(14, 14), p(16, 16, true)]);
  });
  it('moves a point within its neighbours and the span', () => {
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(moveFlexPoint(pts, 1, 12.4, span)[1].dst).toBeCloseTo(12.4);
    expect(moveFlexPoint(pts, 1, 20, span)[1].dst).toBeLessThan(14);
    expect(moveFlexPoint(pts, 1, 1, span)[1].dst).toBeGreaterThan(10);
    expect(moveFlexPoint([p(10, 10)], 0, 0.001, { start: 5, end: 20 })[0].dst).toBeGreaterThan(5);
  });
  it('removes a point and orphaned anchors', () => {
    const pts = [p(10, 10, true), p(12, 12), p(14, 14, true)];
    expect(removeFlexPoint(pts, 1)).toEqual([]);
    const two = [p(10, 10, true), p(12, 12), p(14, 14), p(16, 16, true)];
    expect(removeFlexPoint(two, 1)).toEqual([p(10, 10, true), p(14, 14), p(16, 16, true)]);
  });
  it('quantizes toward the notes by strength, with anchors at the range edges', () => {
    const notes = [10, 10.5, 11, 11.5];
    const hits = [10.04, 10.52, 10.95, 11.6];
    const r = quantizePlan({ points: [], notesTimeline: notes, hitsMedia: hits, beatSeconds: 0.5, range: { start: 9.9, end: 11.9 }, strength: 0.7 });
    expect(r.moved).toBe(4);
    expect(r.largestMs).toBe(100);
    const m = new FlexMap(r.points);
    expect(m.toTimeline(10.04)).toBeCloseTo(10.04 + 0.7 * (10 - 10.04), 6);
    expect(r.points[0]).toEqual(p(9.9, 9.9, true));
    expect(r.points[r.points.length - 1]).toEqual(p(11.9, 11.9, true));
    expect(resetFlexRange(r.points, { start: 9.9, end: 11.9 })).toEqual([]);
  });
  it('quantize ignores notes with no hit within a third of a beat, and never matches a hit twice', () => {
    const r = quantizePlan({ points: [], notesTimeline: [10, 10.1], hitsMedia: [10.05, 12], beatSeconds: 0.5, range: { start: 9.9, end: 10.5 }, strength: 1 });
    expect(r.moved).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/playsense-studio/__tests__/flex.test.ts`
Expected: FAIL (the module doesn't exist yet).

- [ ] **Step 3: Implement**

```ts
// lib/playsense-studio/flex.ts
// Flex Time (spec §7): a monotonic piecewise-linear warp between MEDIA time
// (seconds in the video file) and TIMELINE time (where bars, notes and
// waypoints live). Identity outside the outermost points and when empty, so
// unflexed lessons behave exactly as before.
export interface FlexPoint { src: number; dst: number; anchor: boolean }
export const FLEX_RATE_MIN = 0.5;
export const FLEX_RATE_MAX = 2;
const EPS = 1e-3;

export function readFlex(params: unknown): FlexPoint[] {
  const raw = (params as { flex?: unknown } | null)?.flex;
  if (!Array.isArray(raw)) return [];
  const pts = raw
    .filter((q): q is FlexPoint =>
      !!q && Number.isFinite((q as FlexPoint).src) && Number.isFinite((q as FlexPoint).dst))
    .map((q) => ({ src: q.src, dst: q.dst, anchor: !!q.anchor }))
    .sort((a, b) => a.src - b.src);
  const out: FlexPoint[] = [];
  for (const q of pts) {
    const last = out[out.length - 1];
    if (!last || (q.src > last.src + EPS / 10 && q.dst > last.dst + EPS / 10)) out.push(q);
  }
  return out;
}

function interp(x: number, xs: number[], ys: number[]): number {
  if (!xs.length || x <= xs[0]) return x - (xs[0] ?? x) + (ys[0] ?? x);
  if (x >= xs[xs.length - 1]) return x - xs[xs.length - 1] + ys[ys.length - 1];
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + f * (ys[hi] - ys[lo]);
}

export class FlexMap {
  readonly points: FlexPoint[];
  readonly isIdentity: boolean;
  private readonly srcs: number[];
  private readonly dsts: number[];
  constructor(points: FlexPoint[]) {
    this.points = points;
    this.srcs = points.map((q) => q.src);
    this.dsts = points.map((q) => q.dst);
    this.isIdentity = points.every((q) => Math.abs(q.src - q.dst) < 1e-9);
  }
  toTimeline(media: number): number { return this.points.length ? interp(media, this.srcs, this.dsts) : media; }
  toMedia(timeline: number): number { return this.points.length ? interp(timeline, this.dsts, this.srcs) : timeline; }
  segmentAtMedia(media: number): number {
    const s = this.srcs;
    if (!s.length || media < s[0]) return -1;
    let i = 0;
    while (i + 1 < s.length && s[i + 1] <= media) i++;
    return i;
  }
  rateAtMedia(media: number): number {
    const i = this.segmentAtMedia(media);
    if (i < 0 || i >= this.points.length - 1) return 1;
    const a = this.points[i];
    const b = this.points[i + 1];
    const r = (b.src - a.src) / (b.dst - a.dst);
    return Math.min(FLEX_RATE_MAX, Math.max(FLEX_RATE_MIN, r));
  }
}

const inSpan = (x: number, span: { start: number; end: number }) => x > span.start + EPS && x < span.end - EPS;

export function flexWithin(points: FlexPoint[], span: { start: number; end: number }): FlexPoint[] {
  return points.filter((q) => inSpan(q.src, span) && inSpan(q.dst, span));
}

export function addFlexAtHit(points: FlexPoint[], hitMedia: number, hitsMedia: number[], span: { start: number; end: number }): FlexPoint[] {
  if (!inSpan(hitMedia, span)) return points;
  const map = new FlexMap(points);
  const existing = points.findIndex((q) => Math.abs(q.src - hitMedia) < EPS);
  let out = points.slice();
  if (existing >= 0) {
    out[existing] = { ...out[existing], anchor: false };
  } else {
    out.push({ src: hitMedia, dst: map.toTimeline(hitMedia), anchor: false });
  }
  const sorted = hitsMedia.filter((h) => inSpan(h, span)).sort((a, b) => a - b);
  const idx = sorted.findIndex((h) => Math.abs(h - hitMedia) < EPS);
  for (const n of [sorted[idx - 1], sorted[idx + 1]]) {
    if (n === undefined || out.some((q) => Math.abs(q.src - n) < EPS)) continue;
    out.push({ src: n, dst: map.toTimeline(n), anchor: true });
  }
  out = out.sort((a, b) => a.src - b.src);
  return out;
}

export function moveFlexPoint(points: FlexPoint[], index: number, dst: number, span: { start: number; end: number }): FlexPoint[] {
  const lo = Math.max(span.start, index > 0 ? points[index - 1].dst : -Infinity) + EPS;
  const hi = Math.min(span.end, index < points.length - 1 ? points[index + 1].dst : Infinity) - EPS;
  const out = points.slice();
  out[index] = { ...out[index], dst: Math.min(hi, Math.max(lo, dst)) };
  return out;
}

export function removeFlexPoint(points: FlexPoint[], index: number): FlexPoint[] {
  const out = points.filter((_, i) => i !== index);
  // Drop anchors that no longer border a real (non-anchor) point.
  return out.filter((q, i) => !q.anchor || (out[i - 1] && !out[i - 1].anchor) || (out[i + 1] && !out[i + 1].anchor));
}

export function resetFlexRange(points: FlexPoint[], range: { start: number; end: number }): FlexPoint[] {
  return points.filter((q) => q.dst < range.start - EPS || q.dst > range.end + EPS);
}

export function quantizePlan(input: {
  points: FlexPoint[]; notesTimeline: number[]; hitsMedia: number[]; beatSeconds: number;
  range: { start: number; end: number }; strength: number;
}): { points: FlexPoint[]; moved: number; largestMs: number } {
  const { range, strength } = input;
  const current = new FlexMap(input.points);
  const tol = input.beatSeconds / 3;
  const hits = input.hitsMedia.map((h) => ({ media: h, t: current.toTimeline(h) })).filter((h) => h.t > range.start && h.t < range.end);
  const used = new Set<number>();
  const moves: FlexPoint[] = [];
  let largest = 0;
  for (const note of input.notesTimeline.filter((n) => n >= range.start && n <= range.end).sort((a, b) => a - b)) {
    let best = -1;
    for (let i = 0; i < hits.length; i++) {
      if (used.has(i) || Math.abs(hits[i].t - note) > tol) continue;
      if (best < 0 || Math.abs(hits[i].t - note) < Math.abs(hits[best].t - note)) best = i;
    }
    if (best < 0) continue;
    used.add(best);
    const h = hits[best];
    const dst = h.t + strength * (note - h.t);
    moves.push({ src: h.media, dst, anchor: false });
    largest = Math.max(largest, Math.abs(note - h.t));
  }
  const kept = resetFlexRange(input.points, range);
  const edges = [range.start, range.end]
    .filter((t) => !kept.some((q) => Math.abs(q.dst - t) < EPS))
    .map((t) => ({ src: current.toMedia(t), dst: t, anchor: true }));
  const points = readFlex({ flex: [...kept, ...edges, ...moves] });
  return { points, moved: moves.length, largestMs: Math.round(largest * 1000) };
}
```

The test expects `largestMs` 100: the 11.5 note against the 11.6 hit is 100 ms. `readFlex` sorts the points and drops any that aren't strictly monotonic. If a strong quantize would create a crossing, the crossing point is dropped, which is safe.

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/__tests__/flex.test.ts && npx tsc --noEmit -p .`
Expected: PASS. Fix the implementation, not the tests, except for a genuine float tolerance, which you must report.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/flex.ts lib/playsense-studio/__tests__/flex.test.ts
git commit -m "Add the Flex Time map between media and timeline time"
```

---

### Task 2: Flex through the time map, the draft and publish

**Files:**
- Modify: `components/playsense-studio/player/playsense-studio-player.tsx`: `PlaysenseStudioPlayerTimeMap` gains `flex?: FlexPoint[]`.
- Modify: `app/actions/playsense-studio.ts`: `ClassItemScorePayload['activeTimeMap']` gains `flex?: FlexPoint[]`, and `loadTimeMap` returns `flex: readFlex(tm.params)`.
- Modify: `lib/playsense-studio/drafts/timing.ts`: `timingToTimeMap` returns `flex: readFlex(t.params)`.
- Modify: `lib/playsense-studio/drafts/timing-patch.ts`: `timingPatchFromMarkers(markers, { pps, peaksCached, flex })` puts `flex` into params when it is non-empty.
- Modify: `lib/playsense-studio/drafts/changes.ts`: `timingCanon` includes `flex` rounded to the millisecond.
- Tests: `lib/playsense-studio/drafts/__tests__/{timing,changes,timing-patch}.test.ts` (extend each).

- [ ] **Step 1: Write the failing tests** (add to the existing files)

```ts
// timing.test.ts
it('carries flex from params into the map shape', () => {
  const t = { ...EMPTY_TIMING, params: { flex: [{ src: 1, dst: 1.1, anchor: false }, { src: 2, dst: 2, anchor: true }] },
    waypoints: [wp(0, 0), wp(4, 4)] };
  expect(timingToTimeMap(t)?.flex).toEqual([{ src: 1, dst: 1.1, anchor: false }, { src: 2, dst: 2, anchor: true }]);
});
// changes.test.ts
it('a flex-only edit counts as a timing change', () => {
  const live = { score: score('A', [m(60)]), timing: timed(1) };
  const draft = { score: score('A', [m(60)]), timing: { ...timed(1), params: { flex: [{ src: 1.2, dst: 1.25, anchor: false }] } } };
  expect(diffParts(live, draft).timing).toBe(true);
  expect(summarizeChanges(live, draft)).toContain('Timing changed');
});
// timing-patch.test.ts
it('keeps flex in the timing params', () => {
  // …build markers as the existing test does…
  const patch = timingPatchFromMarkers(markers, { pps: 40, peaksCached: true, flex: [{ src: 1, dst: 1.05, anchor: false }] })!;
  expect(patch.params.flex).toEqual([{ src: 1, dst: 1.05, anchor: false }]);
  expect(timingPatchFromMarkers(markers, { pps: 40, peaksCached: true, flex: [] })!.params.flex).toBeUndefined();
});
```

- [ ] **Step 2: Run them to see them fail**, then **Step 3: Implement** the five changes listed under Files. Every caller of `timingPatchFromMarkers` passes `flex` (SyncPanel passes its flex state from Task 5; until then, pass `[]`). Then **Step 4:** run the full suite and tsc, and **Step 5: Commit** with `git commit -m "Carry flex through the time map, the draft and publish"`.

---

### Task 3: The rate driver

**Files:**
- Create: `lib/playsense-studio/use-flex-playback.ts`
- Test: `lib/playsense-studio/__tests__/use-flex-playback.test.tsx`

**Interfaces:**

```ts
/** Pure: the element rate for a media time. */
export function flexElementRate(map: FlexMap, media: number, userSpeed: number): number; // userSpeed × map.rateAtMedia(media), clamped [0.25, 4]
/** Drives video.playbackRate from rAF while playing; sets preservesPitch. No-op when map.isIdentity (then it sets rate = userSpeed once). */
export function useFlexPlayback(videoRef: React.RefObject<HTMLVideoElement | null>, map: FlexMap, userSpeed: number): void;
```

- [ ] **Step 1: Write the failing tests** (jsdom): use a fake video object on the ref with `currentTime`, `paused`, `playbackRate` and `preservesPitch`, and stub `requestAnimationFrame` with a manual queue.
  - `flexElementRate(new FlexMap([]), 5, 0.75)` is `0.75`.
  - With points `[p(10,10), p(12,12.5), p(14,14)]` at media 11 and speed 1 it is `0.8`, and at speed 0.75 it is `0.6`.
  - The hook with the video playing at `currentTime` 11:
    - after one frame, `playbackRate` is `0.8` and `preservesPitch` is true
    - move `currentTime` to 13, and the next frame gives `≈1.333`
    - with `paused` set, no writes happen
    - on unmount, the rAF is cancelled
  - Writes happen only when the change exceeds 0.001: count the setter calls with a getter/setter pair.
  - An identity map sets the rate to `userSpeed` once, and doesn't loop.
- [ ] **Step 2:** Run them to see them fail.
- [ ] **Step 3: Implement.**
  - rAF loop: while `!video.paused`, compute `flexElementRate(map, video.currentTime, userSpeed)` and write it if `|Δ| > 0.001`.
  - Set `preservesPitch` (and `webkitPreservesPitch` / `mozPreservesPitch` when the property exists) to true when the map isn't the identity.
  - Restart the loop on the `play` event. Cancel it on `pause` and on unmount.
  - Keep `map` and `userSpeed` in refs updated in an effect (no render-time ref writes).
- [ ] **Step 4:** Run the tests and tsc. **Step 5: Commit** with `git commit -m "Drive the video rate through flex segments"`.

---

### Task 4: The student player follows the flexed timeline

**Files:**
- Modify: `components/playsense-studio/player/playsense-studio-player.tsx`
- Create: `lib/playsense-studio/flex-player.ts`, with pure helpers the player uses
- Test: `lib/playsense-studio/__tests__/flex-player.test.ts`

**Interfaces:**

```ts
// lib/playsense-studio/flex-player.ts
export function timelineOf(map: FlexMap, media: number): number;               // map.toTimeline
export function mediaSeekFor(map: FlexMap, timeMap: { toVideoTime(qn: number): number }, qn: number): number; // map.toMedia(timeMap.toVideoTime(qn))
export function clickTimesInMedia(map: FlexMap, beatTimesTimeline: number[]): number[];
```

- [ ] **Step 1: Write the failing tests** for the three helpers:
  - With the identity map each is a pass-through.
  - With the Task 1 points, `mediaSeekFor` of a qn whose timeline time is 12.5 returns 12.
  - `clickTimesInMedia([10, 12.5, 14])` returns `[10, 12, 14]`.
- [ ] **Step 2:** Run them to see them fail.
- [ ] **Step 3: Implement the helpers, then wire the player.**
  - `const flexMap = useMemo(() => new FlexMap(activeTimeMap?.flex ?? []), [activeTimeMap])`.
  - `cursorMs` uses `timeMap.toMusicalPosition(timelineOf(flexMap, clock.currentSeconds))`. The leading and trailing gap cases use timeline seconds too.
  - Loop marker positions use `toMusicalPosition(timelineOf(flexMap, clock.loopA/B))`.
  - Click-to-seek and range loops use `mediaSeekFor(...)` for their media targets.
  - Build the click-track grid from timeline beat times mapped with `clickTimesInMedia`: find where `clickGrid` is built and map its seconds.
  - **Speed:**
    - Add `const [userSpeed, setUserSpeed] = useState(1)`, keeping it in step with any clip-restored rate.
    - When `!flexMap.isIdentity`, pass `playbackRate={userSpeed}` and `onRateChange={setUserSpeed}` to `TransportBar`, and call `useFlexPlayback(videoRef, flexMap, userSpeed)`.
    - When the map is the identity, keep the existing `clock.playbackRate` / `clock.setPlaybackRate` wiring unchanged. `useFlexPlayback` with an identity map only sets `userSpeed` once. To avoid two writers, call the hook with an identity map *only* when flex is present.
  - Section selection stays in media time; this is safe because flex points lie inside section spans (Global Constraints).
- [ ] **Step 4:** Run the full suite and tsc. Any existing player tests must still pass, which is Review Focus 1.
- [ ] **Step 5: Commit** with `git commit -m "Play flexed sections at the stretched rate with the notation in step"`.

---

### Task 5: The admin works in timeline time

**Files:**
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx` (new prop `warp?: FlexMap`; the peaks loop draws through it)
- Create: `lib/playsense-studio/warp-draw.ts` (pure: `mediaForColumn(map, timelineStart, timelineEnd)`)
- Test: `lib/playsense-studio/__tests__/warp-draw.test.ts`

**Steps:**

- [ ] **Step 1: Write the failing test.** With the identity map, `mediaForColumn` returns `[timelineStart, timelineEnd]` unchanged. With the Task 1 points, for the column [12.25, 12.5] it returns `[toMedia(12.25), toMedia(12.5)]`, which is about [11.8, 12].
- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: SyncPanel flex state.**
  - `const [flex, setFlex] = useState<FlexPoint[]>(() => activeTimeMap?.flex ?? [])` and `const flexMap = useMemo(() => new FlexMap(flex), [flex])`.
  - Any flex change sets `dirty` (the same path as a marker change).
  - Pass `flex` into `timingPatchFromMarkers(…, { …, flex })`.
- [ ] **Step 4: Domain conversions in SyncPanel.**
  - **The playhead and anything that reads the clock** (auto-scroll, loop checks, "set anchor at playhead", placing the score at the playhead) use `timelineNow = flexMap.toTimeline(clock.currentSeconds)`. Give `WaveformCanvas` a `getCurrentSeconds` that returns timeline time.
  - **Every seek** (`seekClamped` and all its callers) takes TIMELINE seconds and calls `clock.seek(flexMap.toMedia(t))`. The trim clamp works in media: convert, clamp, then seek.
  - **Hits.** `hitsTimeline = useMemo(() => hits.map((h) => flexMap.toTimeline(h)), [hits, flexMap])`. Use `hitsTimeline` for snapping, `barFlags`, Auto-place and the hit handles.
  - **Trim** is stored in media. The canvas gets trim edges converted with `toTimeline`, and trim drags convert back with `toMedia` before `onTrimDrag`.
  - **The anchor**, set from the playhead, is timeline time, as the markers are.
- [ ] **Step 5: Warped waveform.** In `waveform-canvas.tsx`'s peaks loop, each pixel column spans timeline [t0, t1]. Aggregate the buckets over media `[mediaForColumn(warp, t0, t1)]` instead of [t0, t1]. With no `warp`, or an identity warp, it behaves exactly as before.
- [ ] **Step 6: Admin audio through the warp.** Call `useFlexPlayback(videoRef, flexMap, userSpeed)`, where `userSpeed` is the transport's speed state. Wire it the same way as the student player (Task 4): with flex present, the transport's speed control sets `userSpeed`. Use the draft's current `flexMap`.
- [ ] **Step 7: Run the tests and tsc.** Also check by hand that nothing else in SyncPanel reads `clock.currentSeconds` raw. Grep for `currentSeconds` and `getCurrentSeconds`, and convert each use or justify it in the report.
- [ ] **Step 8: Commit** with `git commit -m "Work in timeline time in the Studio and draw the waveform through the flex"`.

---

### Task 6: Flex editing on the waveform

**Files:**
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx`
  - new props: `flexMode: boolean`, `flexPoints: FlexPoint[]`, `hitsTimeline: number[]`, `noteTimes: number[]`
  - new callbacks: `onFlexAdd(hitIndex)`, `onFlexDrag(index, dstTimeline, mods)`, `onFlexRemove(index)`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
  - the Flex chip plus the F key when the zoom is closed
  - the handlers use Task 1's edits, with the span = the section's first downbeat … tail
- Test: `components/playsense-studio/sync/__tests__/waveform-canvas-flex.test.tsx`

**Behaviour (Flex mode on):**
- **Drawing:**
  - Hits are small grip ticks along the top 6 px of the wave area, at `hitsTimeline`.
  - Flex points are amber lines. Anchors are dashed and dimmer.
  - Each segment between consecutive points gets the slower/faster tint from Global Constraints.
  - While a point is dragging, a label near its top shows `±ms · %`, where ms = round((dst − src_timeline) × 1000) and % = round(100 / segmentRate) for the segment to its left.
- **Pointer:**
  - Clicking a hit grip (within the existing handle hit radius) calls `onFlexAdd`.
  - Dragging a flex point calls `onFlexDrag` with the pointer's timeline time. SyncPanel snaps it to the nearest `noteTimes` value within `SNAP_PX / pps` unless ⌘ is held, then calls `moveFlexPoint`.
  - Double-clicking a flex point calls `onFlexRemove`.
  - Flex-mode hit-testing takes priority over bar markers only for flex points and hit grips. Bar chips keep working.
- **Mode off:** nothing flex-related draws except the tint, which shows whenever points exist, so the admin can see a section is flexed.

- [ ] **Step 1: Write the failing tests.** Use the existing `waveform-canvas-drag.test.tsx` harness pattern:
  - In flex mode, clicking a hit grip calls `onFlexAdd` with that index.
  - Dragging a flex point calls `onFlexDrag` with the timeline time and `{ snap: true }`, or `{ snap: false }` with ⌘.
  - Double-clicking a point calls `onFlexRemove`.
  - With flex mode off, clicking the same place selects or drags the bar marker as before.
- [ ] **Step 2:** Run them to see them fail.
- [ ] **Step 3: Implement** the canvas drawing and pointer handling, and the SyncPanel handlers and chip. For the key, add `f`/`F` to SyncPanel's existing keydown handler. Toggle only when no measure zoom is open (SyncPanel knows whether the zoom is open through IntegratedEditor's zoom state; lift it with a callback if needed), and not when `isTypingTarget`, meta, ctrl or alt is held.
- [ ] **Step 4:** Run the full suite, tsc and eslint.
- [ ] **Step 5: Commit** with `git commit -m "Add Flex points, stretch tints and snapping on the waveform"`.

---

### Task 7: Quantize and "Flex this note"

**Files:**
- Create: `components/playsense-studio/studio/measure/quantize-popover.tsx`
- Modify: `measure-bar.tsx`: a `Quantize` button (`SlidersVertical` or `Magnet` icon), props `onQuantize(anchor)` and `quantizeProblem`, and an info suffix `flexed ±<m> ms` when the selection has flex.
- Modify: `integrated-editor.tsx`, which threads `onQuantizePlan` / `onQuantizeApply` / `onResetFlex` and a `flexInfo(bounds)` from its props, the way `onLoopMeasures` is threaded.
- Modify: `sync-panel.tsx`, which supplies them using `quantizePlan` / `resetFlexRange` with the notes from `noteTicks(markers)` (timeline) and `hits` (media).
- Modify: `zoom/more-popover.tsx` and `note-details.tsx`: `NoteTimingProps.onFlex?: () => void`. The Timing tab gets a button, `Flex the recording onto this note`, shown when `onFlex` is present. SyncPanel implements it: find the nearest hit (in timeline time) within 90 ms of the note, then `addFlexAtHit`, then `moveFlexPoint` so its dst sits on the note time.
- Tests:
  - `components/playsense-studio/studio/measure/__tests__/quantize-popover.test.tsx`: the slider defaults to 70, and the preview text updates from the `plan(strength)` prop. `Apply` calls `onApply(strength)`, and `Reset flex` calls `onReset`.
  - `measure-bar.test.tsx`: the Quantize button and the `flexed ±` info.
  - `more-popover.test.tsx`: the Flex button appears only with `onFlex`.

**Behaviour:**
- **Quantize button:** disabled with the title `Needs the audio analysed first` when there are no hits, and hidden when the lesson isn't a Watch section (no `onQuantizePlan`).
- **Popover (`MeasurePopover`, title `Quantize to the score`):**
  - A range input 0–100 labelled `Strength`, default 70.
  - Preview: `<n> notes will move, largest <m> ms`, or `No notes to move`.
  - `Apply` sets the flex to the plan's points (marking dirty), then closes.
  - `Reset flex` removes the points inside the selection's time range.

- [ ] **Step 1:** Write the failing tests above.
- [ ] **Step 2:** Run them to see them fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full suite, tsc and eslint.
- [ ] **Step 5: Commit** with `git commit -m "Quantize the recording to the score and flex a single note"`.

---

### Task 8: Roadmap and browser checklist

- [ ] **Step 1: Roadmap.** Under Plan 4, add "### Plan 4b — done <date>": what shipped, the rulings (no drift trim, speed multiplies in, flex only inside section spans) and follow-ups. Commit.
- [ ] **Step 2: Browser checklist for the user** (Chrome, Safari; the dev server):
  1. **Flex a note.** Open a Watch section and press **Flex** (or F). Hits show as grips; click one near an early note to add a point with anchors either side. Drag it onto the written note: it snaps, and the label shows `±ms · %`. The region tints blue or orange.
  2. **Hear it.** Play: the audio is stretched with its pitch unchanged, and the notes line up.
  3. **Quantize.** Select 4 bars, then Quantize at 70% and Apply. The preview count matched what moved. Reset flex clears it.
  4. **Flex this note.** Use "Flex the recording onto this note" in the note's Timing tab.
  5. **Student view.** Publish, then open the lesson as a student. The notation stays in step, speed 0.75× still works, and seeking to a note lands on it.
  6. **Unflexed lesson.** It behaves exactly as before.
