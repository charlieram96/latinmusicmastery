# Studio Rework P4a — Hits, Snapping, Auto-place, Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watch timing learns where the teacher actually plays. The Studio detects hits in the recording, and uses them in four ways:
- bar chips and section drags snap to hits
- **Auto-place bars** fits the bars to the performance
- bars that look off are flagged on the waveform, the measure bar and Sync status

**Architecture:**
- **Detection:** an offline onset detector runs on the same 8 kHz mono buffer that already feeds the waveform peaks. Its hits (seconds) ride along in the cached peaks JSON as an optional `hits` field.
- **Pure helpers:** a module `lib/playsense-studio/hits.ts` holds snapping, flags and the first attacked note. `lib/playsense-studio/auto-place.ts` holds the tempo fit and settle.
- **UI:** SyncPanel wires the helpers into the existing marker drags, the sections-lane drag, the chip drawing, the measure bar and the Sync status card.

This is Plan 4 **part a**. Flex Time (Plan 4b) stays gated on the flex-spike device results. Nothing here touches flex.

**Tech Stack:** React 19, TypeScript, canvas 2D, vitest (+ jsdom for components; no testing-library).

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` §7, bullets "Hit detection", "Snapping", "Auto-place bars", "Flags", "Section drag". The roadmap entry is "Plan 4".

## Global Constraints

- **Git rules:**
  - Never run `git stash` in any form. Use `git show HEAD:<path>` to compare.
  - Stage only your files, by explicit path.
  - Commit messages are imperative with no prefix, then a blank line and your `Co-Authored-By` trailer.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**'`. Typecheck: `npx tsc --noEmit -p .`. Lint: `npx eslint --no-cache <changed files>`.
  - Component tests start with `// @vitest-environment jsdom`, and use `createRoot` + `act`.
- **Detection:** runs on the existing 8 kHz mono mixdown in `decodeVideoPeaks`. It is log-energy flux with an adaptive threshold, and each onset is refined to the first sample over 30% of the local peak. Accuracy target: ±6 ms on synthetic onsets.
- **Snap tolerance:** 8 px at the current zoom (`SNAP_PX = 8`, tolerance seconds = `8 / pps`). ⌘ (metaKey) skips snapping. ⌥ (altKey) swaps ripple and single for that drag.
- **Flag thresholds:** a bar is flagged in any of these cases:
  - its first attacked note has no hit within 90 ms (`0.09`)
  - its first attacked note is more than 30 ms off (`0.03`)
  - its tempo differs from the median bar tempo by more than 5% (`0.05`)
- **Exact copy:**
  - Context-bar chip: `Auto-place bars`, and after it runs, `Undo auto-place`.
  - Disabled title without hits: `Re-analyze audio to find the hits`.
  - Failure notice: `Not enough clear hits to place the bars.`
  - Flag texts:
    - `No hit near the first note`
    - `First note <n> ms off the recording`
    - `Tempo <n>% off the other bars`
  - Sync status: `1 bar looks off` / `<n> bars look off`.
- **Timing draft path:** timing changes still reach the draft only through SyncPanel's existing `setMarkers` + `setDirty(true)` path (Plan 6). Nothing here writes live.
- **Behaviour without hits:** no snapping, no flags, Auto-place disabled. This covers old cached peaks without `hits`, and no decode yet.

## Decisions this plan makes (the spec is silent)

1. **Cache.** The cache path stays `-hires-v2`, and `hits` is an optional field on the existing version-1 peaks. Cached peaks from before this plan have no `hits`, and the Studio asks for **Re-analyze** instead of silently re-downloading every video on open. That matters because the entry effect auto-decodes on a cache miss, so bumping the path would force a full video download for every section on open.
2. **Undo.** SyncPanel has no marker undo stack, so "It can be undone" is a one-step `Undo auto-place` chip. It restores the markers from before the placement, and it disappears as soon as the markers change any other way.
3. **Auto-place scope.** Auto-place works on the whole section (every bar), and only uses hits inside the trim window. It resets `edited` beat markers inside bars (beats are re-spread evenly). Per-note nudges are kept.
4. **Snap target.** Snapping applies to bar chips (downbeats): the bar line or its first attacked note, whichever is closer. Expanded beat markers snap only their own line.

## Review Focus

1. **Old cached peaks** (no `hits`) and an undecoded video. Expected: no snapping, no flags, and Auto-place disabled with `Re-analyze audio to find the hits`. Nothing crashes. Test: Task 2 (deserialize without hits) and Task 5 (no flags when `hits` is empty).
2. **A recording with silence or noise only.** Expected: `detectHits` returns few or no hits, and Auto-place shows `Not enough clear hits to place the bars.` without moving anything. Test: Task 1 (silence and noise) and Task 6 (`autoPlaceBars` returns null).
3. **Snapping near a neighbour.** A snap never breaks the corridor or neighbour clamps: snap first, clamp after. Test: Task 4 (snap result then clamp).
4. **Auto-place near the ends.** It never places a bar outside the trim window or the video duration. `Undo auto-place` restores the exact previous markers. Test: Task 6.
5. **Zoom.** The tolerance is 8 px at the current zoom, so zoomed out the same pixel distance is more seconds. The helpers take a seconds tolerance computed from the live `pps`. Test: Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `lib/playsense-studio/onset-detect.ts` | `detectHits(samples, sampleRate)` |
| `lib/playsense-studio/waveform.ts` | `WaveformPeaks.hits?`, validation |
| `lib/playsense-studio/waveform-decode.ts` | compute hits during decode |
| `lib/playsense-studio/hits.ts` | `nearestHit`, `firstAttackTime`, `snapBarTime`, `snapSectionShift`, `barFlags`, `flagText` |
| `lib/playsense-studio/auto-place.ts` | `autoPlaceBars`, `lerpMarkers` |
| `components/playsense-studio/sync/waveform-canvas.tsx` | modifier-aware marker drag, flag dot on chips |
| `components/playsense-studio/sync/sections-lane.tsx` | pass ⌘ state with the drag |
| `components/playsense-studio/studio/sync-panel.tsx` | wiring: hits, snaps, flags, Auto-place chip + tween + undo, Sync status line |
| `components/playsense-studio/studio/stable-timings.ts` | compare the new `flag` field |
| `components/playsense-studio/studio/measure/measure-bar.tsx` + `integrated-editor.tsx` | show a flag in the bar info |

---

### Task 1: Onset detector

**Files:**
- Create: `lib/playsense-studio/onset-detect.ts`
- Test: `lib/playsense-studio/__tests__/onset-detect.test.ts`

**Interfaces:**
- Produces: `detectHits(samples: Float32Array, sampleRate: number): number[]`, sorted ascending seconds. It also exports its tunables: `FRAME_S`, `HOP_S`, `MIN_GAP_S`, `REFINE_FRACTION`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/__tests__/onset-detect.test.ts
import { describe, expect, it } from 'vitest';
import { detectHits } from '../onset-detect';

const SR = 8000;

/** Silence (plus optional noise) with decaying 330 Hz bursts starting exactly at `onsets`. */
function render(durationS: number, onsets: number[], opts: { amp?: number[]; noise?: number; decayS?: number } = {}) {
  const out = new Float32Array(Math.round(durationS * SR));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  if (opts.noise) for (let i = 0; i < out.length; i++) out[i] = rand() * opts.noise;
  const decay = opts.decayS ?? 0.08;
  onsets.forEach((t, k) => {
    const a = opts.amp?.[k] ?? 0.8;
    const start = Math.round(t * SR);
    for (let i = start; i < Math.min(out.length, start + Math.round(0.6 * SR)); i++) {
      const s = (i - start) / SR;
      out[i] += a * Math.exp(-s / decay) * Math.sin(2 * Math.PI * 330 * s);
    }
  });
  return out;
}

const near = (hits: number[], t: number) => hits.some((h) => Math.abs(h - t) <= 0.006);

describe('detectHits', () => {
  it('finds each onset within 6 ms and nothing else', () => {
    const onsets = [0.5, 1.0, 1.37, 2.0, 2.6];
    const hits = detectHits(render(3.2, onsets, { noise: 0.001 }), SR);
    expect(hits).toHaveLength(onsets.length);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
  });
  it('finds dense sixteenths at 120 bpm (125 ms apart)', () => {
    const onsets = Array.from({ length: 16 }, (_, i) => 0.25 + i * 0.125);
    const hits = detectHits(render(2.6, onsets, { noise: 0.001, decayS: 0.03 }), SR);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
    expect(hits.length).toBe(onsets.length);
  });
  it('finds quiet notes among loud ones', () => {
    const onsets = [0.4, 0.9, 1.4, 1.9];
    const hits = detectHits(render(2.5, onsets, { amp: [1, 0.12, 0.8, 0.2], noise: 0.001 }), SR);
    for (const t of onsets) expect(near(hits, t)).toBe(true);
  });
  it('returns nothing for silence or steady noise', () => {
    expect(detectHits(new Float32Array(SR * 2), SR)).toEqual([]);
    expect(detectHits(render(2, [], { noise: 0.05 }), SR).length).toBeLessThanOrEqual(1);
  });
  it('is sorted and never reports two hits closer than the minimum gap', () => {
    const hits = detectHits(render(3, [0.5, 0.52, 1.5], { noise: 0.001 }), SR);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(0.04);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run lib/playsense-studio/__tests__/onset-detect.test.ts`
Expected: FAIL (the module doesn't exist yet).

- [ ] **Step 3: Implement**

```ts
// lib/playsense-studio/onset-detect.ts
// Offline hit (onset) detection for the Watch timing tools (spec §7). Runs on
// the same 8 kHz mono mixdown the waveform peaks come from. Log-energy flux
// with an adaptive (local-median) threshold picks each attack; the reported
// time is then refined back to the first sample that reaches 30% of the
// attack's local peak, which lands within a few ms of the true onset.

export const FRAME_S = 0.016;
export const HOP_S = 0.004;
export const MIN_GAP_S = 0.045;
export const REFINE_FRACTION = 0.3;
const MEDIAN_WINDOW_S = 0.3;
/** Minimum rise over the local median, in log10-energy units (≈ 3 dB). */
const THRESHOLD_DELTA = 0.3;
/** Frames quieter than this far below the loudest frame never start a hit (≈ −45 dB). */
const FLOOR_BELOW_PEAK = 4.5;

export function detectHits(samples: Float32Array, sampleRate: number): number[] {
  const frame = Math.max(8, Math.round(FRAME_S * sampleRate));
  const hop = Math.max(1, Math.round(HOP_S * sampleRate));
  const nFrames = samples.length >= frame ? Math.floor((samples.length - frame) / hop) + 1 : 0;
  if (nFrames < 3) return [];

  const logE = new Float64Array(nFrames);
  let maxLog = -Infinity;
  for (let f = 0; f < nFrames; f++) {
    let e = 0;
    const start = f * hop;
    for (let i = start; i < start + frame; i++) e += samples[i] * samples[i];
    logE[f] = Math.log10(e / frame + 1e-12);
    if (logE[f] > maxLog) maxLog = logE[f];
  }
  if (maxLog < -9) return []; // digital silence

  // Positive flux against the quietest of the previous few frames, so a
  // rise spread over several hops still reads as one strong step.
  const flux = new Float64Array(nFrames);
  for (let f = 1; f < nFrames; f++) {
    const prev = Math.min(logE[f - 1], logE[Math.max(0, f - 2)], logE[Math.max(0, f - 3)]);
    flux[f] = Math.max(0, logE[f] - prev);
  }

  const half = Math.max(1, Math.round(MEDIAN_WINDOW_S / HOP_S / 2));
  const floor = maxLog - FLOOR_BELOW_PEAK;
  const minGapFrames = Math.max(1, Math.round(MIN_GAP_S / HOP_S));
  const peaks: number[] = [];
  const win: number[] = [];
  for (let f = 1; f < nFrames - 1; f++) {
    if (logE[f] < floor) continue;
    if (!(flux[f] >= flux[f - 1] && flux[f] > flux[f + 1])) continue;
    win.length = 0;
    for (let k = Math.max(0, f - half); k <= Math.min(nFrames - 1, f + half); k++) win.push(flux[k]);
    win.sort((a, b) => a - b);
    const median = win[win.length >> 1];
    if (flux[f] < median + THRESHOLD_DELTA) continue;
    const last = peaks[peaks.length - 1];
    if (last !== undefined && f - last < minGapFrames) {
      if (flux[f] > flux[last]) peaks[peaks.length - 1] = f;
      continue;
    }
    peaks.push(f);
  }

  // Refine: the first sample reaching REFINE_FRACTION of the attack's peak.
  const out: number[] = [];
  for (const f of peaks) {
    const lo = Math.max(0, (f - 3) * hop);
    const hi = Math.min(samples.length, f * hop + frame + Math.round(0.02 * sampleRate));
    let peak = 0;
    for (let i = lo; i < hi; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const target = peak * REFINE_FRACTION;
    let at = lo;
    for (let i = lo; i < hi; i++) {
      if (Math.abs(samples[i]) >= target) { at = i; break; }
    }
    const t = at / sampleRate;
    if (!out.length || t - out[out.length - 1] >= MIN_GAP_S - 0.005) out.push(t);
  }
  return out;
}
```

The constants are starting values. **Tune them until the Step 1 tests pass, and keep the tests exactly as written.** If a tuning change is needed, say which constant changed and why in the report. The refinement's search window must never start before the previous hit.

- [ ] **Step 4: Check it handles a long recording**

In the same test file, add a timing check: a 600 s buffer of noise at 0.01 (4.8 M samples) must be analysed in under 3 s. Wrap it in `it('handles ten minutes quickly', …)` and measure it with `performance.now()`. If it's too slow, replace the per-frame median sort with a sliding-window approach, for example a median over a coarser block grid.

- [ ] **Step 5: Run the tests, tsc and commit**

Run: `npx vitest run lib/playsense-studio/__tests__/onset-detect.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

```bash
git add lib/playsense-studio/onset-detect.ts lib/playsense-studio/__tests__/onset-detect.test.ts
git commit -m "Detect hits in the decoded recording"
```

---

### Task 2: Hits ride along in the cached peaks

**Files:**
- Modify: `lib/playsense-studio/waveform.ts` (add `hits?: number[]` to `WaveformPeaks`, and validate it in `deserializePeaks`)
- Modify: `lib/playsense-studio/waveform-decode.ts` (`decodeVideoPeaks` computes hits from `mono` before building the peaks)
- Test: `lib/playsense-studio/__tests__/waveform.test.ts`, `lib/playsense-studio/__tests__/waveform-decode.test.ts`

**Interfaces:**
- Consumes: `detectHits` (Task 1).
- Produces: `WaveformPeaks.hits?: number[]`, seconds on the media's own timeline (sorted). It is absent in caches written before this plan. `DecodeOptions.withHits?: boolean` (default `true`). Lane peaks pass `false` so backing tracks don't pay for it.

- [ ] **Step 1: Write the failing tests**

Add to `waveform.test.ts`:

```ts
it('round-trips optional hits and still accepts peaks without them', () => {
  const base = computePeaks(new Float32Array([0, 0.5, -0.5, 0]), 8000, 0.0005, 2);
  const withHits = { ...base, hits: [0.1, 0.25] };
  expect(deserializePeaks(serializePeaks(withHits)).hits).toEqual([0.1, 0.25]);
  expect(deserializePeaks(serializePeaks(base)).hits).toBeUndefined();
});
it('rejects malformed hits', () => {
  const base = computePeaks(new Float32Array([0, 0.5]), 8000, 0.00025, 1);
  expect(() => deserializePeaks(JSON.stringify({ ...base, hits: ['x'] }))).toThrow();
  expect(() => deserializePeaks(JSON.stringify({ ...base, hits: [0.3, 0.1] }))).toThrow();
});
```

Add to `waveform-decode.test.ts`, following that file's existing `OfflineAudioContext` / `fetch` stubs. Build the fake decoded channel from Task 1's `render` idea: bursts at 0.5 s and 1.0 s in 2 s of 8 kHz audio.

```ts
it('computes hits during decode unless asked not to', async () => {
  // …stub fetch + OfflineAudioContext exactly as the existing tests in this file do,
  // with getChannelData(0) returning a buffer that has bursts at 0.5 s and 1.0 s…
  const peaks = await decodeVideoPeaks('https://x/v.mp4');
  expect(peaks.hits?.length).toBe(2);
  expect(Math.abs(peaks.hits![0] - 0.5)).toBeLessThan(0.006);
  const lane = await decodeVideoPeaks('https://x/v.mp4', { withHits: false });
  expect(lane.hits).toBeUndefined();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/playsense-studio/__tests__/waveform.test.ts lib/playsense-studio/__tests__/waveform-decode.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `waveform.ts`:
- Add `/** Detected hits in seconds (sorted); absent in caches older than Studio rework P4a. */ hits?: number[];` to `WaveformPeaks`.
- At the end of `deserializePeaks`'s shape checks, add:

```ts
  if (p.hits !== undefined) {
    if (!Array.isArray(p.hits) || !p.hits.every((h) => typeof h === 'number' && Number.isFinite(h))) {
      throw new Error('WaveformPeaks: invalid hits');
    }
    for (let i = 1; i < p.hits.length; i++) {
      if ((p.hits[i] as number) < (p.hits[i - 1] as number)) throw new Error('WaveformPeaks: hits not sorted');
    }
  }
```

Make sure the returned object carries `hits` through (check how the function builds its return value).

In `waveform-decode.ts`:
- Add `withHits?: boolean` to `DecodeOptions`.
- In `decodeVideoPeaks`, after the mixdown:

```ts
  const peaks = computePeaks(mono, targetSampleRate, decoded.duration, targetBuckets);
  if (opts.withHits !== false) peaks.hits = detectHits(mono, targetSampleRate);
  return peaks;
```

- `loadOrComputeLanePeaks` passes `withHits: false` to its decode.
- Keep `waveformPath` at `-hires-v2` (see Decision 1).
- Check that `loadOrComputePeaks` uploads the peaks with hits (it serializes the whole object).

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/__tests__/ && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/waveform.ts lib/playsense-studio/waveform-decode.ts lib/playsense-studio/__tests__/waveform.test.ts lib/playsense-studio/__tests__/waveform-decode.test.ts
git commit -m "Cache detected hits with the waveform peaks"
```

---

### Task 3: Hit helpers: nearest, snapping, first attack, flags

**Files:**
- Create: `lib/playsense-studio/hits.ts`
- Test: `lib/playsense-studio/__tests__/hits.test.ts`

**Interfaces:**
- Consumes: `MarkerState`, `MarkerRef`, `noteTime` and `orderedMarkers` from `components/playsense-studio/sync/marker-model.ts`.
- Produces:
  - `SNAP_PX = 8`
  - `nearestHit(hits: number[], t: number, tol: number): number | null` (binary search, ties to the earlier hit)
  - `firstAttackTime(state: MarkerState, measureIndex: number): number | null` (the effective time of the bar's first onset, `noteTime(state, m.onsetQNs[0])`, or null if the bar has no onsets)
  - `snapBarTime(proposed: number, firstNoteOffset: number | null, hits: number[], tol: number): { time: number; snapped: boolean }`
  - `snapSectionShift(firstNoteTime: number, delta: number, hits: number[], tol: number): number`
  - `type BarFlag = { kind: 'no-hit' } | { kind: 'off'; ms: number } | { kind: 'tempo'; pct: number }`
  - `barFlags(state: MarkerState, hits: number[]): Map<number, BarFlag>`, keyed by measureNumber; empty when `hits` is empty
  - `flagText(flag: BarFlag): string`

- [ ] **Step 1: Write the failing tests**

Build the `MarkerState` fixtures by hand from the types in `marker-model.ts`. Use two or three measures of 4 QN each with evenly spaced beats, `onsetQNs` set, and no nudges. A helper in the test file is fine:

```ts
// lib/playsense-studio/__tests__/hits.test.ts
import { describe, expect, it } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { barFlags, firstAttackTime, flagText, nearestHit, snapBarTime, snapSectionShift } from '../hits';

/** Bars of 4 QN starting at `starts` (seconds), with first onsets `firstOnsetQN[i]` (absolute qn). */
function state(starts: number[], tail: number, firstOnsetQN: (number | null)[]): MarkerState {
  return {
    measures: starts.map((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] : tail;
      return {
        measureNumber: i + 1, beatsInMeasure: 4, downbeatQN: i * 4, expanded: false, nudges: [],
        onsetQNs: firstOnsetQN[i] == null ? [] : [firstOnsetQN[i]!],
        beats: [0, 1, 2, 3].map((b) => ({
          beatInMeasure: b + 1, musicalPositionQN: i * 4 + b, videoTimeSeconds: s + ((end - s) * b) / 4, edited: false,
        })),
      };
    }),
    tailQN: starts.length * 4,
    tailVideoTimeSeconds: tail,
  } as unknown as MarkerState;
}

describe('hits helpers', () => {
  it('finds the nearest hit within tolerance', () => {
    expect(nearestHit([1, 2, 3], 2.05, 0.1)).toBe(2);
    expect(nearestHit([1, 2, 3], 2.5, 0.1)).toBeNull();
    expect(nearestHit([], 1, 1)).toBeNull();
    expect(nearestHit([1, 1.2], 1.1, 0.2)).toBe(1);
  });
  it('first attack time follows the bar mapping', () => {
    const s = state([0, 2], 4, [1, null]);
    expect(firstAttackTime(s, 0)).toBeCloseTo(0.5);
    expect(firstAttackTime(s, 1)).toBeNull();
  });
  it('snaps the bar line or the first note, whichever is closer, only within tolerance', () => {
    expect(snapBarTime(1.03, null, [1.0], 0.05)).toEqual({ time: 1.0, snapped: true });
    expect(snapBarTime(1.03, 0.25, [1.3], 0.05)).toEqual({ time: 1.05, snapped: true });
    expect(snapBarTime(1.03, 0.25, [1.0, 1.3], 0.05).time).toBeCloseTo(1.05);
    expect(snapBarTime(1.2, 0.25, [1.0], 0.05)).toEqual({ time: 1.2, snapped: false });
  });
  it('tolerance is whatever seconds the caller computed from pixels', () => {
    const pps = 40;
    expect(snapBarTime(1.15, null, [1.0], 8 / pps).snapped).toBe(true);
    expect(snapBarTime(1.15, null, [1.0], 8 / 400).snapped).toBe(false);
  });
  it('snaps a section shift so its first note lands on a hit', () => {
    expect(snapSectionShift(2.0, 0.48, [2.5], 0.05)).toBeCloseTo(0.5);
    expect(snapSectionShift(2.0, 0.3, [2.5], 0.05)).toBeCloseTo(0.3);
  });
  it('flags a missing hit, an off first note, and a tempo outlier', () => {
    // Bars start 0,2,4,6,8.4 (the last bar is slower); the first onsets are on each downbeat.
    const s = state([0, 2, 4, 6], 8.4, [0, 4, 8, 12]);
    const hits = [0.0, 2.05, 6.0];
    const flags = barFlags(s, hits);
    expect(flags.get(1)).toBeUndefined();
    expect(flags.get(2)).toEqual({ kind: 'off', ms: 50 });
    expect(flags.get(3)).toEqual({ kind: 'no-hit' });
    expect(flags.get(4)).toEqual({ kind: 'tempo', pct: 20 });
    expect(barFlags(s, []).size).toBe(0);
  });
  it('words each flag', () => {
    expect(flagText({ kind: 'no-hit' })).toBe('No hit near the first note');
    expect(flagText({ kind: 'off', ms: 42 })).toBe('First note 42 ms off the recording');
    expect(flagText({ kind: 'tempo', pct: 7 })).toBe('Tempo 7% off the other bars');
  });
});
```

Check the real `MeasureMarker` field names in `marker-model.ts` before relying on the fixture helper, and adjust the helper (not the expectations) to match. Also confirm that `noteTime` works on this fixture: `anchorTimeMap` needs at least two anchors. If it needs more fields, add them to the helper.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run lib/playsense-studio/__tests__/hits.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/playsense-studio/hits.ts
// Pure helpers that tie detected hits (lib/playsense-studio/onset-detect.ts)
// to the sync markers: snapping a dragged bar or section, and flagging bars
// whose first note or tempo doesn't match the recording (spec §7).
import { noteTime, type MarkerState } from '@/components/playsense-studio/sync/marker-model';

export const SNAP_PX = 8;
const NO_HIT_S = 0.09;
const OFF_S = 0.03;
const TEMPO_TOLERANCE = 0.05;

export type BarFlag = { kind: 'no-hit' } | { kind: 'off'; ms: number } | { kind: 'tempo'; pct: number };

export function nearestHit(hits: number[], t: number, tol: number): number | null {
  if (!hits.length) return null;
  let lo = 0;
  let hi = hits.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hits[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  let best: number | null = null;
  for (const i of [lo - 1, lo]) {
    if (i < 0 || i >= hits.length) continue;
    const d = Math.abs(hits[i] - t);
    if (d <= tol && (best === null || d < Math.abs(best - t))) best = hits[i];
  }
  return best;
}

export function firstAttackTime(state: MarkerState, measureIndex: number): number | null {
  const m = state.measures[measureIndex];
  if (!m || !m.onsetQNs.length) return null;
  return noteTime(state, m.onsetQNs[0]);
}

export function snapBarTime(
  proposed: number,
  firstNoteOffset: number | null,
  hits: number[],
  tol: number
): { time: number; snapped: boolean } {
  let best: { time: number; dist: number } | null = null;
  const line = nearestHit(hits, proposed, tol);
  if (line !== null) best = { time: line, dist: Math.abs(line - proposed) };
  if (firstNoteOffset !== null) {
    const note = nearestHit(hits, proposed + firstNoteOffset, tol);
    if (note !== null) {
      const dist = Math.abs(note - (proposed + firstNoteOffset));
      if (!best || dist < best.dist) best = { time: note - firstNoteOffset, dist };
    }
  }
  return best ? { time: best.time, snapped: true } : { time: proposed, snapped: false };
}

export function snapSectionShift(firstNoteTime: number, delta: number, hits: number[], tol: number): number {
  const hit = nearestHit(hits, firstNoteTime + delta, tol);
  return hit === null ? delta : hit - firstNoteTime;
}

export function barFlags(state: MarkerState, hits: number[]): Map<number, BarFlag> {
  const out = new Map<number, BarFlag>();
  if (!hits.length) return out;
  const ms = state.measures;
  const spq = ms.map((m, i) => {
    const start = m.beats[0].videoTimeSeconds;
    const next = ms[i + 1];
    const end = next ? next.beats[0].videoTimeSeconds : state.tailVideoTimeSeconds;
    const qn = (next ? next.downbeatQN : state.tailQN) - m.downbeatQN;
    return qn > 0 ? (end - start) / qn : NaN;
  });
  const sorted = spq.filter(Number.isFinite).sort((a, b) => a - b);
  const median = sorted.length ? sorted[sorted.length >> 1] : NaN;
  ms.forEach((m, i) => {
    const t = firstAttackTime(state, i);
    if (t !== null) {
      const h = nearestHit(hits, t, NO_HIT_S);
      if (h === null) { out.set(m.measureNumber, { kind: 'no-hit' }); return; }
      const off = Math.abs(h - t);
      if (off > OFF_S) { out.set(m.measureNumber, { kind: 'off', ms: Math.round(off * 1000) }); return; }
    }
    if (Number.isFinite(median) && Number.isFinite(spq[i])) {
      const dev = Math.abs(spq[i] / median - 1);
      if (dev > TEMPO_TOLERANCE) out.set(m.measureNumber, { kind: 'tempo', pct: Math.round(dev * 100) });
    }
  });
  return out;
}

export function flagText(flag: BarFlag): string {
  if (flag.kind === 'no-hit') return 'No hit near the first note';
  if (flag.kind === 'off') return `First note ${flag.ms} ms off the recording`;
  return `Tempo ${flag.pct}% off the other bars`;
}
```

- [ ] **Step 4: Run the tests and tsc**

Run: `npx vitest run lib/playsense-studio/__tests__/hits.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/hits.ts lib/playsense-studio/__tests__/hits.test.ts
git commit -m "Add hit helpers for snapping and bar flags"
```

---

### Task 4: Snap bar chips and section drags to hits; ⌘ and ⌥ during drags

**Files:**
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx`
  - the marker drag callback gains a modifiers argument
  - ⌥ swaps the mode for that move
- Modify: `components/playsense-studio/sync/sections-lane.tsx`: `onDragActive` gains `{ snap: boolean }` (false while ⌘ is held)
- Modify: `components/playsense-studio/studio/sync-panel.tsx`: `handleMarkerDrag` and `onSectionDrag` snap (Task 3 helpers), with a seconds tolerance of `SNAP_PX / pps`
- Test: `components/playsense-studio/sync/__tests__/waveform-canvas-drag.test.tsx` and `components/playsense-studio/sync/__tests__/sections-lane.test.tsx` (extend both)

**Interfaces:**
- Consumes: `SNAP_PX`, `snapBarTime`, `snapSectionShift`, `firstAttackTime` (Task 3); `peaks.hits` (Task 2).
- Produces:
  - `WaveformCanvasProps.onMarkerDrag(ref, videoTimeSeconds, mode, mods: { snap: boolean })`. The canvas computes `mode` as `(dragAll !== e.altKey) ? 'all-after' : 'single'`, and `snap` as `!e.metaKey`.
  - `SectionsLaneProps.onDragActive(delta, phase, mods?: { snap: boolean })`.

- [ ] **Step 1: Write the failing tests**

In `waveform-canvas-drag.test.tsx`, follow the file's existing marker-drag test. Add:

```tsx
it('swaps ripple and single while Option is held, and reports ⌘ as no-snap', () => {
  // …mount exactly as the existing marker-drag test does, with dragAll = true…
  // Drag a downbeat chip with altKey: true on the move events.
  // Expect onMarkerDrag to have been called with mode 'single' and mods { snap: true }.
  // Repeat with metaKey: true (no altKey): mode 'all-after', mods { snap: false }.
});
```

Write the real body using the existing test's mount and pointer-event helpers. The move event is created the same way as in that test, with `altKey` / `metaKey` set in the `MouseEvent` init.

In `sections-lane.test.tsx`, add:

```tsx
it('reports snap: false while ⌘ is held during a section drag', () => {
  // …drag the active block as the existing test does, with metaKey on the move event…
  // expect(onDragActive).toHaveBeenLastCalledWith(expect.any(Number), 'move', { snap: false });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/playsense-studio/sync/__tests__/waveform-canvas-drag.test.tsx components/playsense-studio/sync/__tests__/sections-lane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the canvas and lane**

- **The canvas.**
  - In the pointer-move handler, change the marker branch to:

```ts
        else if (target.kind === 'marker') {
          const ripple = dragAllRef.current !== e.altKey;
          onMarkerDragRef.current(target.ref, t, ripple ? 'all-after' : 'single', { snap: !e.metaKey });
        }
```

  - Update the prop type and every other caller of `onMarkerDrag`: grep for it. Test stubs may need the extra argument.
  - The Ripple/Single control titles already promise "hold Option". They are now true.
- **The lane.** Pass `{ snap: !e.metaKey }` as the third argument on both `'move'` and `'end'`.

- [ ] **Step 4: Implement the snapping in SyncPanel**

- Keep refs so the drag callbacks see the latest hits and zoom:

```ts
  const hits = peaks?.hits ?? EMPTY_HITS; // module-level `const EMPTY_HITS: number[] = []`
  const hitsRef = useRef(hits);
  hitsRef.current = hits;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
```

  If the repo's React Compiler lint rejects render-time ref writes, mirror them in a `useLayoutEffect` instead.
- In `handleMarkerDrag`, add the `mods` parameter and snap BEFORE the existing clamps:

```ts
  const handleMarkerDrag = useCallback((ref: MarkerRef, videoTimeSeconds: number, mode: DragMode, mods?: { snap: boolean }) => {
    setMarkers((s) => {
      let proposed = videoTimeSeconds;
      if (mods?.snap !== false && hitsRef.current.length) {
        const mi = s.measures.findIndex((m) => m.measureNumber === ref.measureNumber);
        const barStart = mi >= 0 ? s.measures[mi].beats[0].videoTimeSeconds : null;
        const first = ref.beatInMeasure === 1 && mi >= 0 ? firstAttackTime(s, mi) : null;
        const offset = first !== null && barStart !== null ? first - barStart : null;
        proposed = snapBarTime(videoTimeSeconds, offset, hitsRef.current, SNAP_PX / ppsRef.current).time;
      }
      // …existing body, with `videoTimeSeconds` replaced by `proposed`…
    });
    setDirty(true);
  }, []);
```

- In `onSectionDrag`, add a `mods?: { snap: boolean }` parameter. Before `clampSectionShift`, snap the delta so the section's first attacked note lands on a hit:

```ts
      let d = delta;
      if (mods?.snap !== false && hitsRef.current.length) {
        const idx = base.measures.findIndex((m) => m.onsetQNs.length > 0);
        const firstNote = idx >= 0 ? firstAttackTime(base, idx) : base.measures[0].beats[0].videoTimeSeconds;
        if (firstNote !== null) d = snapSectionShift(firstNote, delta, hitsRef.current, SNAP_PX / ppsRef.current);
      }
      const shift = clampSectionShift(markerSpan(base), corridor, videoDurationSeconds ?? null, d);
```

- Wire the new parameters through the `SectionsLane` and `WaveformCanvas` props in SyncPanel.

- [ ] **Step 5: Run the tests, tsc, eslint and commit**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`, plus eslint on the three files.
Expected: PASS.

```bash
git add components/playsense-studio/sync/waveform-canvas.tsx components/playsense-studio/sync/sections-lane.tsx components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/sync/__tests__/waveform-canvas-drag.test.tsx components/playsense-studio/sync/__tests__/sections-lane.test.tsx
git commit -m "Snap dragged bars and sections to hits; ⌘ skips, ⌥ swaps ripple"
```

---

### Task 5: Show bar flags: chip dot, measure bar, Sync status

**Files:**
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx`
  - `MarkerHandle.flagged?: boolean`
  - draw a 6 px dot at the chip's top-right in the theme's `flag` colour
  - add `flag: v('--destructive', '#dc2626')` to `readTheme`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
  - compute `flags = useMemo(() => barFlags(markers, hits), [markers, hits])`
  - set `flagged` on the handles
  - add `flag: string | null` to each `measureTimings` entry (`flagText(...)` or null)
  - add the Sync status line
- Modify: `components/playsense-studio/studio/stable-timings.ts` (compare `flag` too, when present)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (the `IntegratedEditorMeasureTiming` type gains `flag?: string | null`, and the MeasureBar receives the first flag in the selected range)
- Modify: `components/playsense-studio/studio/measure/measure-bar.tsx` (new optional prop `flag?: string | null`, rendered in the info span)
- Test: `components/playsense-studio/studio/__tests__/stable-timings.test.ts`, `components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx`

**Interfaces:**
- Consumes: `barFlags`, `flagText` (Task 3).
- Produces: `MeasureBar` prop `flag?: string | null`; `IntegratedEditorMeasureTiming.flag?: string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
// stable-timings.test.ts — add
it('treats a flag change as a change', () => {
  const a = [{ measureNumber: 1, startVideoTimeSeconds: 0, endVideoTimeSeconds: 2, flag: null }];
  const b = [{ measureNumber: 1, startVideoTimeSeconds: 0, endVideoTimeSeconds: 2, flag: 'No hit near the first note' }];
  expect(stableTimings(a, b)).toBe(b);
  expect(stableTimings(b, [{ ...b[0] }])).toBe(b);
});
```

```tsx
// measure-bar.test.tsx — add, mounting MeasureBar the way the file's existing test does
it('shows a flag in the bar info', () => {
  // …mount with flag="First note 42 ms off the recording"…
  // expect(host.querySelector('.st-fbar-info')!.textContent).toContain('First note 42 ms off the recording');
  // and the flag element has class 'st-fbar-flag'
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run components/playsense-studio/studio/__tests__/stable-timings.test.ts components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

- **`stableTimings`.** Extend the type to `BarTiming & { flag?: string | null }`, and add `|| (a.flag ?? null) !== (b.flag ?? null)` to the comparison.
- **`MeasureBar`.** After the BPM part of the info span, add:

```tsx
        {props.flag && (
          <>
            {' · '}
            <span className="st-fbar-flag" title={props.flag}>{props.flag}</span>
          </>
        )}
```

- **CSS.** In `app/globals.css`, next to `.st-fbar-info`, add `.st-fbar-flag { color: hsl(var(--destructive)); font-weight: 600; }`. Check how `--destructive` is declared and match that form.
- **`IntegratedEditor`.** Pass `flag={measureTimings.slice(bounds[0], bounds[1] + 1).find((t) => t.flag)?.flag ?? null}` to `MeasureBar`.
- **The canvas.** In the chip loop, after filling the chip:

```ts
      if (hnd.flagged) {
        ctx.fillStyle = theme.flag;
        ctx.beginPath();
        ctx.arc(x + chipW - 1, 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }
```

- **SyncPanel.**
  - Add `flagged: flags.has(o.ref!.measureNumber) && o.ref!.beatInMeasure === 1` to the handles.
  - Add `flag: flags.has(m.measureNumber) ? flagText(flags.get(m.measureNumber)!) : null` to the `measureTimings` entries.
  - In the Sync status card, next to the "N measures on the grid" line, add `flags.size > 0 && <p className="text-xs text-destructive">{flags.size === 1 ? '1 bar looks off' : `${flags.size} bars look off`}</p>`.

- [ ] **Step 4: Run the tests, tsc, eslint and commit**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`, plus eslint on the changed files.
Expected: PASS.

```bash
git add components/playsense-studio/sync/waveform-canvas.tsx components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/studio/stable-timings.ts components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/measure/measure-bar.tsx app/globals.css components/playsense-studio/studio/__tests__/stable-timings.test.ts components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx
git commit -m "Flag bars whose first note or tempo is off the recording"
```

---

### Task 6: Auto-place bars (fit, settle, tween, undo)

**Files:**
- Create: `lib/playsense-studio/auto-place.ts`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
  - an `Auto-place bars` chip after "Anchor at playhead"
  - the tween
  - an `Undo auto-place` chip
  - the failure notice
- Test: `lib/playsense-studio/__tests__/auto-place.test.ts`

**Interfaces:**
- Consumes: `MarkerState` and `noteTime` (marker-model); `nearestHit` (Task 3).
- Produces:
  - `autoPlaceBars(state, hits, window) => { state: MarkerState; matched: number; settled: number } | null`
    - `state: MarkerState`, `hits: number[]`, `window: { start: number; end: number }`
    - returns null when fewer than 4 onsets match, or fewer than half do
  - `lerpMarkers(a: MarkerState, b: MarkerState, t: number): MarkerState`
    - the same structure as `b`, with every beat time and the tail interpolated
    - `a` and `b` must have the same measure and beat layout; otherwise it returns `b`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/__tests__/auto-place.test.ts
import { describe, expect, it } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { autoPlaceBars, lerpMarkers } from '../auto-place';

/** N bars of 4 QN laid at `spb` seconds per beat from `start`, onsets on every beat. */
function laid(n: number, start: number, spb: number): MarkerState {
  return {
    measures: Array.from({ length: n }, (_, i) => ({
      measureNumber: i + 1, beatsInMeasure: 4, downbeatQN: i * 4, expanded: false, nudges: [],
      onsetQNs: [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3],
      beats: [0, 1, 2, 3].map((b) => ({ beatInMeasure: b + 1, musicalPositionQN: i * 4 + b, videoTimeSeconds: start + (i * 4 + b) * spb, edited: b === 2 })),
    })),
    tailQN: n * 4,
    tailVideoTimeSeconds: start + n * 4 * spb,
  } as unknown as MarkerState;
}
const downbeats = (s: MarkerState) => s.measures.map((m) => m.beats[0].videoTimeSeconds);

describe('autoPlaceBars', () => {
  it('fits a steady tempo to the hits even when the markers start far off', () => {
    const truth = laid(8, 2.0, 0.5); // 120 bpm starting at 2.0 s
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const start = laid(8, 2.3, 0.47); // wrong start and tempo
    const res = autoPlaceBars(start, hits, { start: 0, end: 60 })!;
    expect(res).not.toBeNull();
    downbeats(res.state).forEach((t, i) => expect(t).toBeCloseTo(downbeats(truth)[i], 2));
    expect(res.state.tailVideoTimeSeconds).toBeCloseTo(truth.tailVideoTimeSeconds, 2);
    expect(res.state.measures[0].beats[2].edited).toBe(false);
  });
  it('settles each bar onto the hit under its first note', () => {
    const truth = laid(6, 1.0, 0.5);
    const hits = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    hits[8] += 0.04; // bar 3's downbeat was played 40 ms late
    const res = autoPlaceBars(laid(6, 1.0, 0.5), hits, { start: 0, end: 60 })!;
    expect(res.state.measures[2].beats[0].videoTimeSeconds).toBeCloseTo(truth.measures[2].beats[0].videoTimeSeconds + 0.04, 3);
    expect(res.settled).toBeGreaterThanOrEqual(1);
  });
  it('gives up without moving anything when too few hits match', () => {
    expect(autoPlaceBars(laid(4, 0, 0.5), [0.1, 7.3], { start: 0, end: 60 })).toBeNull();
    expect(autoPlaceBars(laid(4, 0, 0.5), [], { start: 0, end: 60 })).toBeNull();
  });
  it('ignores hits outside the trim window and never places a bar outside it', () => {
    const truth = laid(4, 5.0, 0.5);
    const inside = truth.measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    const res = autoPlaceBars(laid(4, 5.2, 0.5), [0.5, 1.0, 1.5, ...inside], { start: 4, end: 20 })!;
    expect(downbeats(res.state)[0]).toBeCloseTo(5.0, 2);
    expect(Math.min(...downbeats(res.state))).toBeGreaterThanOrEqual(4);
    expect(res.state.tailVideoTimeSeconds).toBeLessThanOrEqual(20);
  });
  it('keeps note nudges', () => {
    const s = laid(4, 0, 0.5);
    (s.measures[1] as unknown as { nudges: unknown[] }).nudges = [{ qn: 5, deltaSeconds: 0.02 }];
    const hits = laid(4, 0, 0.5).measures.flatMap((m) => m.beats.map((b) => b.videoTimeSeconds));
    expect(autoPlaceBars(s, hits, { start: 0, end: 60 })!.state.measures[1].nudges).toEqual([{ qn: 5, deltaSeconds: 0.02 }]);
  });
});

describe('lerpMarkers', () => {
  it('interpolates every beat and the tail', () => {
    const a = laid(2, 0, 0.5);
    const b = laid(2, 1, 0.5);
    const mid = lerpMarkers(a, b, 0.5);
    expect(mid.measures[1].beats[3].videoTimeSeconds).toBeCloseTo((a.measures[1].beats[3].videoTimeSeconds + b.measures[1].beats[3].videoTimeSeconds) / 2);
    expect(mid.tailVideoTimeSeconds).toBeCloseTo((a.tailVideoTimeSeconds + b.tailVideoTimeSeconds) / 2);
    expect(lerpMarkers(a, b, 1)).toBe(b);
  });
});
```

Check the `MeasureMarker` / nudge field names in `marker-model.ts` and adjust the fixture helper (not the expectations) to match.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/playsense-studio/__tests__/auto-place.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/playsense-studio/auto-place.ts
// "Auto-place bars" (spec §7): fit one steady tempo to the score's note onsets
// against the detected hits (widening the window as the fit firms up), lay
// every bar on that line, then let each bar settle onto the hit under its first
// attacked note. Pure: SyncPanel tweens to the result and keeps the old markers
// for one-step undo.
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { nearestHit } from './hits';

const SETTLE_S = 0.09;

interface Onset { qn: number }

export function autoPlaceBars(
  state: MarkerState,
  allHits: number[],
  window: { start: number; end: number }
): { state: MarkerState; matched: number; settled: number } | null {
  const hits = allHits.filter((h) => h >= window.start && h <= window.end);
  const onsets: Onset[] = state.measures.flatMap((m) => m.onsetQNs.map((qn) => ({ qn })));
  if (onsets.length < 4 || hits.length < 4 || state.measures.length === 0) return null;

  // Start from the current markers: time = a + b * (qn - qn0).
  const qn0 = onsets[0].qn;
  const first = state.measures[0];
  const last = state.measures[state.measures.length - 1];
  const spanQN = state.tailQN - first.downbeatQN;
  let b = spanQN > 0 ? (state.tailVideoTimeSeconds - first.beats[0].videoTimeSeconds) / spanQN : 0.5;
  let a = first.beats[0].videoTimeSeconds + (qn0 - first.downbeatQN) * b;

  // Coarse offset search: the markers may start well away from the playing
  // (further than the fit tolerance), so first try putting the first onset on
  // each hit within ±2 s and keep the offset that lines up the most onsets.
  {
    const tol0 = Math.min(0.12, 0.3 * b);
    const probe = onsets.slice(0, 8);
    let bestA = a;
    let bestCount = -1;
    for (const h of hits) {
      if (Math.abs(h - a) > 2) continue;
      const count = probe.filter((o) => nearestHit(hits, h + b * (o.qn - qn0), tol0) !== null).length;
      if (count > bestCount) { bestCount = count; bestA = h; }
    }
    a = bestA;
  }

  let matched = 0;
  for (let n = Math.min(8, onsets.length); ; n = Math.min(onsets.length, n * 2)) {
    const tol = Math.min(0.12, 0.3 * b);
    const pairs: Array<[number, number]> = [];
    for (const o of onsets.slice(0, n)) {
      const h = nearestHit(hits, a + b * (o.qn - qn0), tol);
      if (h !== null) pairs.push([o.qn - qn0, h]);
    }
    if (pairs.length >= 3) {
      const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
      const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
      const sxx = pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      if (sxx > 0) {
        b = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
        a = my - b * mx;
      }
    }
    matched = pairs.length;
    if (n === onsets.length) break;
  }
  if (b <= 0 || matched < 4 || matched < onsets.length / 2) return null;

  const at = (qn: number) => a + b * (qn - qn0);
  // Lay the downbeats, then settle each onto the hit under its first note.
  const downs = state.measures.map((m) => at(m.downbeatQN));
  let settled = 0;
  state.measures.forEach((m, i) => {
    if (!m.onsetQNs.length) return;
    const predicted = at(m.onsetQNs[0]);
    const h = nearestHit(hits, predicted, SETTLE_S);
    if (h === null) return;
    const next = downs[i] + (h - predicted);
    const prevOk = i === 0 || next > downs[i - 1] + 0.01;
    const nextOk = i === downs.length - 1 || next < at(state.measures[i + 1].downbeatQN) - 0.01;
    if (prevOk && nextOk) { downs[i] = next; if (Math.abs(h - predicted) > 1e-6) settled++; }
  });
  let tail = downs[downs.length - 1] + (state.tailQN - last.downbeatQN) * b;

  // Keep everything inside the window.
  const lo = window.start;
  const hi = window.end;
  if (downs[0] < lo || tail > hi) return null;
  tail = Math.min(tail, hi);

  const measures = state.measures.map((m, i) => {
    const start = downs[i];
    const end = i + 1 < downs.length ? downs[i + 1] : tail;
    const endQN = i + 1 < state.measures.length ? state.measures[i + 1].downbeatQN : state.tailQN;
    const secPerQN = (end - start) / (endQN - m.downbeatQN);
    return {
      ...m,
      beats: m.beats.map((bt) => ({ ...bt, videoTimeSeconds: start + (bt.musicalPositionQN - m.downbeatQN) * secPerQN, edited: false })),
    };
  });
  return { state: { ...state, measures, tailVideoTimeSeconds: tail }, matched, settled };
}

export function lerpMarkers(a: MarkerState, b: MarkerState, t: number): MarkerState {
  if (t >= 1) return b;
  if (a.measures.length !== b.measures.length) return b;
  const k = Math.max(0, t);
  const mix = (x: number, y: number) => x + (y - x) * k;
  const measures = b.measures.map((mb, i) => {
    const ma = a.measures[i];
    if (!ma || ma.beats.length !== mb.beats.length) return mb;
    return { ...mb, beats: mb.beats.map((bb, j) => ({ ...bb, videoTimeSeconds: mix(ma.beats[j].videoTimeSeconds, bb.videoTimeSeconds) })) };
  });
  return { ...b, measures, tailVideoTimeSeconds: mix(a.tailVideoTimeSeconds, b.tailVideoTimeSeconds) };
}
```

**Tuning.** If a test fails on the fit, adjust `tol`, the window schedule or the settle guard. Never change the tests. Report what changed.

**The "outside the window" test** expects a placement that would fall outside to return null. If the implementation instead clamps and still meets every expectation in that test (the downbeats and tail stay inside, and the first downbeat is ≈5.0), keep whichever behaviour passes, and say which in the report.

- [ ] **Step 4: Wire it into SyncPanel**

- **State:** `const [autoPlaceUndo, setAutoPlaceUndo] = useState<MarkerState | null>(null)`, `const placedRef = useRef<MarkerState | null>(null)`, `const [autoPlaceNotice, setAutoPlaceNotice] = useState<string | null>(null)`.
- **Clearing the undo:** an effect clears `autoPlaceUndo` when `markers !== placedRef.current` and a tween is not running. Any other marker change retires the undo.
- **`runAutoPlace`:**
  1. `const res = autoPlaceBars(markersRef.current, hits, { start: trimWindow.startSeconds, end: Number.isFinite(trimWindow.endSeconds) ? trimWindow.endSeconds : (videoDurationSeconds ?? clock.durationSeconds ?? Infinity) })`.
  2. If `!res`: `setAutoPlaceNotice('Not enough clear hits to place the bars.')` and return.
  3. Otherwise keep `const from = markersRef.current`, `setAutoPlaceUndo(from)` and `placedRef.current = res.state`.
  4. Tween: unless `window.matchMedia?.('(prefers-reduced-motion: reduce)').matches`, run a `requestAnimationFrame` loop for 300 ms that calls `setMarkers(lerpMarkers(from, res.state, easeOut(p)))`, with `easeOut = (p) => 1 - (1 - p) ** 3`.
  5. At the end: `setMarkers(res.state)` then `setDirty(true)`.
  6. Cancel the rAF on unmount.
- **`undoAutoPlace`:** `setMarkers(autoPlaceUndo)`, `setDirty(true)`, `setAutoPlaceUndo(null)`.
- **Context bar** (after the "Anchor at playhead" button, when `showSync`):

```tsx
            <button
              type="button"
              onClick={runAutoPlace}
              disabled={!hits.length}
              className="st-chip"
              title={hits.length ? 'Fit the bars to the recording' : 'Re-analyze audio to find the hits'}
            >
              <Wand2 className="h-4 w-4" />
              <span className="hidden lg:inline">Auto-place bars</span>
            </button>
            {autoPlaceUndo && (
              <button type="button" onClick={undoAutoPlace} className="st-chip" title="Put the bars back where they were">
                <Undo2 className="h-4 w-4" />
                Undo auto-place
              </button>
            )}
            {autoPlaceNotice && <span className="text-xs text-muted-foreground" role="status">{autoPlaceNotice}</span>}
```

  Clear `autoPlaceNotice` on the next marker change or after 6 s. Import `Wand2` and `Undo2` from lucide-react, if they aren't imported already.
- **The draft.** Timing reaches the draft through the existing `dirty` → debounce → `onTimingChange` path. The pre-flush (Plan 6) makes Publish include it even mid-debounce.

- [ ] **Step 5: Run the tests, tsc, eslint and commit**

Run: `npx vitest run --exclude '.worktrees/**' && npx tsc --noEmit -p .`, plus eslint on the changed files.
Expected: PASS.

```bash
git add lib/playsense-studio/auto-place.ts lib/playsense-studio/__tests__/auto-place.test.ts components/playsense-studio/studio/sync-panel.tsx
git commit -m "Auto-place bars from the hits, with a tween and one-step undo"
```

---

### Task 7: Roadmap and browser checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1:** Under "Plan 4", add "### Plan 4a — done <date>": what shipped, the rulings, and the follow-ups. Note that Plan 4b (Flex) still waits for the spike results. Commit: `git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md && git commit -m "Mark Studio rework Plan 4a done in the roadmap"`.
- [ ] **Step 2: Browser checklist for the user** (Chrome, dev server):
  1. **Hits.** Open a Watch section and press **Re-analyze audio** once, because older cached waveforms have no hits. Afterwards the Auto-place chip is enabled.
  2. **Snapping.** Drag a bar chip near a note attack: it snaps within ~8 px. Hold ⌘ and it moves freely. Hold ⌥ and ripple/single swaps for that drag.
  3. **Section drag.** Drag the section block in the sections lane: its first note snaps onto a hit.
  4. **Auto-place.** Press **Auto-place bars**. The bars glide into place and land on the playing. **Undo auto-place** puts them back. On a talking-only stretch, the notice appears and nothing moves.
  5. **Flags.** Drag one bar off its note. Its chip gets a red dot, the measure bar info shows the reason, and Sync status says "1 bar looks off".
  6. **Draft.** Publish afterwards. Students see the new sync only after publishing.
