# PlaySense Studio Layout Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live PlaySense Studio look and navigate like mockup v6: it opens on the section, has no stray tool rows, the zoom is readable (white staff, docked note toolbar, compact drum strokes), the selected bars look like the mockup, and there is one transport row.

**Architecture:** This is a layout and styling pass over the existing Studio components; no data model changes. The pieces the mockup shows mostly exist already (the measure bar, the repeat lane, the gap "+", the zoom, the shortcuts "?"). This plan moves them to where the mockup puts them and restyles them with the mockup's CSS values.

The only new logic is:
- a small pure module for timeline view math (fit to a range, zoom around a point, follow the playhead)
- a stroke picker for drum tracks

The student player is untouched. The one shared component, `TransportBar`, gains an opt-in `layout="row"` prop, and its default stays byte-for-byte the same.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind + `app/globals.css`, VexFlow 5, vitest + jsdom (`createRoot` + `act`, no testing-library).

**Spec:**
- The visual spec is `docs/superpowers/specs/assets/studio-mockup-v6.html`, the mockup the user approved.
  - Open it in Chrome.
  - To screenshot it headlessly: `node docs/superpowers/specs/assets/studio-mockup-shot.mjs "file://$PWD/docs/superpowers/specs/assets/studio-mockup-v6.html" /tmp/mock.png`.
  - Its CSS is the source for every size, colour and radius below.
- The behavioural spec is `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md`.

## What the user asked for, and where it lands

The user compared the live Studio with the mockup on 2026-09-26 and listed these items:

| # | The user's item | Task |
|---|---|---|
| U1 | "The staff color is always black when in dark mode it should be white" (the measure zoom) | 1 |
| U2 | The zoom's note toolbar ("always in the way"), especially the big drum-stroke grid | 8, 9 |
| U3 | "This row doesnt belong here": Staff/Piano-roll, track name, instrument, Record MIDI, Add measure | 5 |
| U4 | Most of the page still looks like before, compared with the mockup (the context-bar row, the app bar, the transport) | 3, 4, 10 |
| U5 | Mockup waveform tools: Auto-place · magnet · Ripple/Single · flex · notes · zoom · fit, in one floating cluster | 4 |
| U6 | Mockup bar header: number, flag dot and beat count per bar; the repeat lane; the corner tools | 5, 6 |
| U7 | Mockup strip footer: issue chip, hint and "?" floating at the strip's bottom | 7 |
| U8 | The selected measure should look like the mockup (outlined bar, tinted header, tinted waveform span, labelled measure bar) | 6, 7 |
| U9 | The mockup zoom ("look how great this looks") vs the live zoom: big white staff, header with title and meta, toolbar in the header | 8 |
| — | Found in the live review: it opens zoomed out to the whole video (bars under 46 px draw empty), the view doesn't follow the playhead, and zoom anchors at 0:00 | 2 |

## Global Constraints

- **Git:**
  - Never run `git stash` in any form.
  - Stage your files by path.
  - Commit messages are imperative with no prefix, followed by a blank line and `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Commands:**
  - Tests: `npx vitest run --exclude '.worktrees/**' --exclude '.claude/worktrees/**'`
  - Typecheck: `npx tsc --noEmit -p .`
  - Lint: `npx eslint --no-cache <files>`, with no new errors against the base (compare with `git show BASE:<file> | npx eslint --stdin --stdin-filename <file>`).
- Component tests start with `// @vitest-environment jsdom` and use `createRoot` + `act`, with `globalThis.IS_REACT_ACT_ENVIRONMENT = true`.
- **React Compiler lint:**
  - No ref writes during render; mirror refs in effects.
  - No `setState` synchronously in an effect body unless the file already does it and the lint base count is unchanged.
- **Student surfaces must not change:**
  - `TransportBar` without `layout` renders exactly as today.
  - The lesson player, exercise game and highway are out of scope.
- **Colours** come from the Studio stage tokens: `.st-stage` already sets the dark island. Use `hsl(var(--primary))`, `hsl(var(--gold-highlight))`, `hsl(var(--destructive))`, `hsl(var(--teal))` and `hsl(var(--border))`. Never hard-code a light-theme colour inside the stage.
- **Copy** is sentence case and plain English, and it follows the mockup's strings where the mockup has one.
- **No new npm dependencies.**
- **Mockup values:** when a step says "mockup `.x`", copy that rule's values from the `<style>` block of `docs/superpowers/specs/assets/studio-mockup-v6.html`, renaming the class with the `st-` prefix given in the step.

## Review Focus

1. **A light page theme.** The Studio stage is a dark island (`.st-stage`) even when the page is light. The zoom staff, the corner tools, the footer and the toolbars must stay readable (white ink on the dark stage). Test: Task 1 checks the zoom root carries the notation class, which resolves to the stage's light ink.
2. **Students keep their transport.** `TransportBar` with no `layout` prop keeps the two-row markup. Test: Task 3 renders it without `layout` and checks the scrubber is not inside the controls row.
3. **Graded parts (Exercise, Jam)** lose the context bar in Task 4. Count-in, Pre-roll, Auto-align, the on-hit readout and Student preview must stay reachable. Test: Task 4 renders the graded SyncPanel and finds each control in its new home.
4. **Keyboard focus in the zoom.** Moving the note toolbar into the header must keep every button's `onMouseDown={preventDefault}`, so the zoom's window keydown listener still gets the keys after a click. Test: Task 8 clicks a docked toolbar button, then dispatches `3` on window, and the value changes.
5. **A narrow window (1280 × 800).** The app bar must not wrap its labels onto two lines, and the zoom header must drop the toolbar to a second line instead of overlapping V1/V2. Test: Task 8 renders the zoom with a 700 px header and asserts the dock wraps (`flex-wrap: wrap` on the head, and the dock is its own flex item). Task 10 asserts the app bar's Score menu is one chip.

---

### Task 1: The zoom staff draws with the stage's ink (white in dark mode)

The strip's staff is white because its wrapper has `playsense-studio-notation`, which forces `currentColor` on VexFlow's paths and text (`app/globals.css:246-266`). The zoom overlay (`components/playsense-studio/studio/zoom/measure-zoom.tsx:384-390`) doesn't have that class. So VexFlow's default black survives, including on the neighbour slivers.

**Files:**
- Modify: `components/playsense-studio/studio/zoom/measure-zoom.tsx:386`
- Test: `components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx`

**Interfaces:**
- Produces: the zoom root's class list is `playsense-studio-notation st-zoom-overlay`.

- [ ] **Step 1: Write the failing test**

Add this at the end of the first `describe` in `measure-zoom.test.tsx`. The file already mounts a zoom through a helper; use the same helper the neighbouring tests use (search for `data-testid="measure-zoom"` or `querySelector('[data-testid="measure-zoom"]')`).

```tsx
it('draws its staff with the notation ink, not VexFlow black', () => {
  // mount as the neighbouring tests do
  const root = host.querySelector('[data-testid="measure-zoom"]')!;
  expect(root.classList.contains('playsense-studio-notation')).toBe(true);
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx`
Expected: FAIL, because the root lacks the class.

- [ ] **Step 3: Implement**

In `measure-zoom.tsx`, change the root `className`:

```tsx
      className="playsense-studio-notation st-zoom-overlay"
```

The slivers and center are children of the root, so they inherit it.

- [ ] **Step 4: Run it and check that it passes**, plus the whole zoom folder: `npx vitest run components/playsense-studio/studio/zoom`

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/zoom/measure-zoom.tsx components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx
git commit -m "Draw the measure zoom's staff in the stage's ink instead of black"
```

---

### Task 2: Open on the section, fit to the section, follow the playhead

Three live problems are fixed here:
- **It opens zoomed out to the whole video.** A 17 s section in a 7:20 video gets 9 bars in 200 px. Bars under 46 px (`MIN_RENDER_WIDTH`) render as empty placeholders, so the staff looks blank.
- **"Fit" fits the whole video.**
- **The view never follows the playhead**, and zoom +/- anchors on the view centre.

**Files:**
- Create: `lib/playsense-studio/timeline-view.ts`
- Create: `lib/playsense-studio/__tests__/timeline-view.test.ts`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - the fit effect (~:708-716)
  - `zoomBy` (~:1399)
  - `fitZoom` (~:1408)
  - the `ZoomSlider` usages (~:2098, :2149)
  - `seekClamped`

**Interfaces:**
- Produces (`lib/playsense-studio/timeline-view.ts`):
  - `interface TimelineBounds { minPps: number; maxPps: number; contentSeconds: number }`
  - `clampScrollLeft(scrollLeft: number, pps: number, viewportWidth: number, contentSeconds: number): number`
  - `fitRangeView(startSeconds: number, endSeconds: number, viewportWidth: number, b: TimelineBounds, padFrac?: number): { pps: number; scrollLeft: number } | null`
  - `followScroll(tSeconds: number, pps: number, scrollLeft: number, viewportWidth: number, b: TimelineBounds, opts?: { edge?: number; land?: number }): number | null`: the new scrollLeft, or null when `t` is already inside the comfortable band.
  - `anchorPxFor(tSeconds: number, pps: number, scrollLeft: number, viewportWidth: number): number`: t's x when it's on screen, else the viewport centre.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/playsense-studio/__tests__/timeline-view.test.ts
import { describe, expect, it } from 'vitest';
import { anchorPxFor, clampScrollLeft, fitRangeView, followScroll } from '../timeline-view';

const B = { minPps: 8, maxPps: 600, contentSeconds: 440 };

describe('clampScrollLeft', () => {
  it('keeps the view inside the content', () => {
    expect(clampScrollLeft(-50, 10, 1000, 440)).toBe(0);
    expect(clampScrollLeft(9999, 10, 1000, 440)).toBe(3400); // 440*10 - 1000
    expect(clampScrollLeft(500, 1, 1000, 440)).toBe(0);      // content narrower than the view
  });
});

describe('fitRangeView', () => {
  it('fits a 17 s section in a 7:20 video into the viewport with a 4% pad each side', () => {
    const v = fitRangeView(80, 97, 1360, B)!;
    // span 17 s + 2 * 0.68 s pad = 18.36 s over 1360 px
    expect(v.pps).toBeCloseTo(1360 / 18.36, 3);
    expect(v.scrollLeft).toBeCloseTo((80 - 0.68) * v.pps, 3);
  });
  it('clamps pps to the bounds', () => {
    expect(fitRangeView(0, 0.5, 1360, B)!.pps).toBe(600);
    expect(fitRangeView(0, 10000, 1360, { ...B, contentSeconds: 10000 })!.pps).toBe(8);
  });
  it('returns null without a viewport or with an empty range', () => {
    expect(fitRangeView(10, 20, 0, B)).toBeNull();
    expect(fitRangeView(20, 20, 1000, B)).toBeNull();
  });
});

describe('followScroll', () => {
  it('leaves the view alone while t is comfortably inside it', () => {
    expect(followScroll(15, 100, 1000, 1000, B)).toBeNull(); // x = 500
  });
  it('pages so t lands at 25% when it nears the right edge', () => {
    // x = 19.5*100 - 1000 = 950 > 90% of 1000
    expect(followScroll(19.5, 100, 1000, 1000, B)).toBeCloseTo(1950 - 250, 6);
  });
  it('jumps back to t when it is off to the left (a loop wrap or a seek)', () => {
    expect(followScroll(2, 100, 1000, 1000, B)).toBe(0); // 200 - 250 clamps to 0
  });
});

describe('anchorPxFor', () => {
  it('anchors on t when it is on screen, else on the centre', () => {
    expect(anchorPxFor(12, 100, 1000, 800)).toBe(200);
    expect(anchorPxFor(60, 100, 1000, 800)).toBe(400);
  });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx vitest run lib/playsense-studio/__tests__/timeline-view.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement the module**

```ts
// lib/playsense-studio/timeline-view.ts
// PlaySense Studio — timeline view math shared by the waveform and the staff:
// fit a time range into the viewport, keep the playhead in view while it
// plays, and pick the point a zoom button should anchor on. Pure: SyncPanel
// owns the pps/scrollLeft state and calls these.

export interface TimelineBounds {
  minPps: number;
  maxPps: number;
  /** The whole timeline's length in seconds. */
  contentSeconds: number;
}

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampScrollLeft(scrollLeft: number, pps: number, viewportWidth: number, contentSeconds: number): number {
  return clampNum(scrollLeft, 0, Math.max(0, contentSeconds * pps - viewportWidth));
}

/** pps and scrollLeft that show [start, end] with `padFrac` of its span either side. */
export function fitRangeView(
  startSeconds: number,
  endSeconds: number,
  viewportWidth: number,
  b: TimelineBounds,
  padFrac = 0.04,
): { pps: number; scrollLeft: number } | null {
  if (!(viewportWidth > 0) || !(endSeconds > startSeconds)) return null;
  const span = endSeconds - startSeconds;
  const pad = span * padFrac;
  const pps = clampNum(viewportWidth / (span + 2 * pad), b.minPps, b.maxPps);
  return { pps, scrollLeft: clampScrollLeft((startSeconds - pad) * pps, pps, viewportWidth, b.contentSeconds) };
}

/**
 * While playing (or after a seek): when t leaves the band [edge, 1 - edge] of
 * the viewport, page so it lands at `land` of the width. Null = no change.
 */
export function followScroll(
  tSeconds: number,
  pps: number,
  scrollLeft: number,
  viewportWidth: number,
  b: TimelineBounds,
  opts: { edge?: number; land?: number } = {},
): number | null {
  if (!(viewportWidth > 0)) return null;
  const edge = opts.edge ?? 0.1;
  const land = opts.land ?? 0.25;
  const x = tSeconds * pps - scrollLeft;
  if (x >= viewportWidth * edge && x <= viewportWidth * (1 - edge)) return null;
  const next = clampScrollLeft(tSeconds * pps - viewportWidth * land, pps, viewportWidth, b.contentSeconds);
  return Math.abs(next - scrollLeft) < 0.5 ? null : next;
}

/** A zoom button's anchor: the playhead when it's on screen, else the centre. */
export function anchorPxFor(tSeconds: number, pps: number, scrollLeft: number, viewportWidth: number): number {
  const x = tSeconds * pps - scrollLeft;
  return x >= 0 && x <= viewportWidth ? x : viewportWidth / 2;
}
```

- [ ] **Step 4: Run them and check that they pass**

- [ ] **Step 5: Wire SyncPanel**

In `components/playsense-studio/studio/sync-panel.tsx`:

1. Import the helpers: `import { anchorPxFor, fitRangeView, followScroll } from '@/lib/playsense-studio/timeline-view';`.
2. Add a helper next to `fitZoom` that returns the range to fit. On the sync path that's the section: `markerSpan(markers)`, the same span `liveSpan` uses; `markerSpan` is already imported. Otherwise it's the whole timeline.

   ```tsx
   const fitTarget = (): [number, number] => {
     if (showSync) {
       const span = markerSpan(markers);
       if (span.endSeconds > span.startSeconds) return [span.startSeconds, span.endSeconds];
     }
     return [0, timelineDuration];
   };
   const viewBounds = { minPps: MIN_PPS, maxPps: MAX_PPS, contentSeconds: timelineDuration };
   ```

3. Replace the body of the "Fit zoom once the viewport width + a duration are known" effect with:

   ```tsx
   if (viewportWidth > 0 && timelineDuration > 0) {
     didFitRef.current = true;
     const [a, b] = fitTarget();
     const v = fitRangeView(a, b, viewportWidth, viewBounds);
     if (v) { setPps(v.pps); setScrollLeft(v.scrollLeft); }
   }
   ```

   Keep the `didFitRef` guard, so it runs once per mount. Add `markers` and `showSync` to the effect's dependency array. The ref still makes it one-shot.

4. Replace `fitZoom` with:

   ```tsx
   const fitZoom = () => {
     const [a, b] = fitTarget();
     const v = fitRangeView(a, b, viewportWidth, viewBounds);
     if (v) { setPps(v.pps); setScrollLeft(v.scrollLeft); }
   };
   ```

5. Both `<ZoomSlider … onZoomBy={zoomBy} …>` usages become `onZoomBy={(f) => zoomBy(f, anchorPxFor(timelineNow, pps, scrollLeft, viewportWidth))}`.
6. Follow the playhead. Add after `timelineNow` is defined:

   ```tsx
   // Keep the playhead in view while playing (a loop wrap or a page turn),
   // the way a DAW pages its arrange view.
   useEffect(() => {
     if (!clock.isPlaying) return;
     const next = followScroll(timelineNow, pps, scrollLeft, viewportWidth, viewBounds);
     if (next !== null) setScrollLeft(next);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [timelineNow, clock.isPlaying]);
   ```

   If the lint base count for `set-state-in-effect` rises, move the check into the clock's rAF tick callback instead. Record which way you went in the report.

7. In `seekClamped`, after the seek, bring an off-screen target into view:

   ```tsx
   const next = followScroll(targetTimelineSeconds, pps, scrollLeft, viewportWidth, viewBounds);
   if (next !== null) setScrollLeft(next);
   ```

   Here `targetTimelineSeconds` is the timeline time `seekClamped` was called with (read the function first and use its parameter name).

- [ ] **Step 6: Verify:** the SyncPanel tests (`npx vitest run components/playsense-studio/studio`), tsc and eslint on both files.

- [ ] **Step 7: Commit**

```bash
git add lib/playsense-studio/timeline-view.ts lib/playsense-studio/__tests__/timeline-view.test.ts components/playsense-studio/studio/sync-panel.tsx
git commit -m "Open the Studio on the section, fit to it, and keep the playhead in view"
```

---

### Task 3: One transport row in the Studio, with Hear and Loop speed in it

This is the mockup's `.st-transport`: play · restart · time · the scrubber inline and flexible · the loop chip · Hear · volume · click/BPM. `TransportBar` is shared with the student player, so the row layout is opt-in.

**Files:**
- Modify: `components/playsense-studio/player/transport/transport-bar.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (the `<TransportBar` portal ~:2316, and the context-bar Hear/Loop speed blocks)
- Modify: `app/globals.css` (add `.st-transport-row`)
- Test: `components/playsense-studio/player/transport/__tests__/transport-bar-layout.test.tsx` (create)

**Interfaces:**
- Produces:
  - `TransportBarProps.layout?: 'stacked' | 'row'` (default `'stacked'`)
  - `TransportBarProps.extra?: ReactNode`, rendered in the row before the volume
  - `components/playsense-studio/studio/hear-control.tsx` exports `HearControl({ hear, onHear })` and `LoopSpeedControl({ rate, onRate })`, which Task 4 relies on

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// components/playsense-studio/player/transport/__tests__/transport-bar-layout.test.tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TransportBar } from '../transport-bar';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const base = {
  currentSeconds: 5, durationSeconds: 100, isPlaying: false, playbackRate: 1,
  onToggle() {}, onRestart() {}, onSeek() {}, onRateChange() {},
  loopA: null, loopB: null, loopEnabled: false, onToggleLoop() {}, onClearLoop() {},
  bpm: 96, beatsPerMeasure: 4,
};

describe('TransportBar layout', () => {
  it('keeps the two-row student layout by default', () => {
    act(() => root.render(<TransportBar {...base} />));
    const play = host.querySelector('[aria-label="Play"]')!;
    expect(host.querySelector('.st-transport-row')).toBeNull();
    // the scrubber is a sibling row above the controls, not inside them
    expect(play.parentElement!.querySelector('[class*="touch-none"]')).toBeNull();
  });

  it('puts the scrubber and the extras in one row with layout="row"', () => {
    act(() => root.render(<TransportBar {...base} layout="row" extra={<span data-testid="hear">Hear</span>} />));
    const row = host.querySelector('.st-transport-row')!;
    expect(row.contains(host.querySelector('[aria-label="Play"]'))).toBe(true);
    expect(row.querySelector('[class*="touch-none"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="hear"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it and check that it fails** (`layout` and `extra` don't exist yet).

- [ ] **Step 3: Implement it in `transport-bar.tsx`**

1. Add the props `layout?: 'stacked' | 'row'` and `extra?: ReactNode` (import `type ReactNode` from 'react'), and destructure them with `layout = 'stacked'`.
2. Hoist the scrubber JSX, the `<div ref={trackRef} …>…</div>` block at ~:143-238, into a `const scrubber = (…)` before `return`.
3. Hoist the controls into `const controls = (<>…</>)`: every child of today's `<div className="flex items-center gap-2 sm:gap-3 flex-wrap">`. Insert `{extra}` immediately before the `{onVideoMutedChange && (` volume block.
4. Return:

   ```tsx
   if (layout === 'row') {
     return (
       <div className="st-transport-row">
         {controls /* play, restart, time come first inside it */}
       </div>
     );
   }
   return (
     <div className="space-y-2">
       {scrubber}
       <div className="flex items-center gap-2 sm:gap-3 flex-wrap">{controls}</div>
     </div>
   );
   ```

   For the row, the scrubber sits right after the time readout. Split `controls` into `lead` (play, restart, time) and `rest` (loop cluster, subtitles, extra, volume, divider, chronometer). The row renders `{lead}<div className="st-transport-scrub">{scrubber}</div>{rest}`, and the stacked return renders `{lead}{rest}` in its controls row. The stacked output stays identical.

5. CSS (`app/globals.css`, after `.st-stage-bottombar`). This is the mockup `.st-transport`:

   ```css
   /* The Studio's one-row transport (mockup .st-transport). The student player
      keeps TransportBar's stacked layout. */
   .st-transport-row { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 14px;
     border-top: 1px solid hsl(var(--border)); background: hsl(var(--card)); }
   .st-transport-scrub { flex: 1; min-width: 80px; }
   .st-transport-row .st-transport-scrub > div { height: 28px; }
   ```

- [ ] **Step 4: Create `components/playsense-studio/studio/hear-control.tsx`**

Move the two segmented controls out of SyncPanel's context bar: the `role="radiogroup" aria-label="Hear"` block and the `aria-label="Loop speed"` block at ~:1884-1935. Keep their markup and handlers.

```tsx
'use client';
// PlaySense Studio — the transport's Hear and Loop speed controls (moved from
// the context bar into the one-row transport, mockup .st-transport).
import { HEAR_OPTIONS, type Hear } from '@/lib/playsense-studio/hear';
import { LOOP_SPEEDS } from '@/lib/playsense-studio/studio-rate';

export function HearControl({ hear, onHear }: { hear: Hear; onHear: (h: Hear) => void }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label="Hear" title="What you hear while playing">
      {HEAR_OPTIONS.map(({ value, label }) => (
        <button key={value} type="button" role="radio" aria-checked={hear === value}
          className={hear === value ? 'is-on' : ''} onClick={() => onHear(value)}>{label}</button>
      ))}
    </div>
  );
}

export function LoopSpeedControl({ rate, onRate }: { rate: number; onRate: (r: number) => void }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label="Loop speed" title="Loop speed — the recording keeps its pitch">
      {LOOP_SPEEDS.map((speed) => {
        const on = Math.abs(rate - speed) < 1e-3;
        return (
          <button key={speed} type="button" role="radio" aria-checked={on} className={on ? 'is-on' : ''}
            onClick={() => onRate(speed)}>{Math.round(speed * 100)}%</button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Wire it in SyncPanel.** On the `<TransportBar` in the transport portal:
  - add `layout="row"`
  - add `extra={<>{(loopEnabled || Math.abs(displayedRate - 1) > 1e-3) && <LoopSpeedControl rate={displayedRate} onRate={onDisplayedRateChange} />}{showSync && <HearControl hear={hear} onHear={handleHearChange} />}</>}`
  - delete the Hear and Loop speed blocks from the context bar

  The loop icon button in the context bar (`onClick={loopSelectedMeasure}`) is also deleted. The measure bar's Loop and the `L` key cover it, and the transport already has a loop toggle.

- [ ] **Step 6: Verify:** the test passes; then the Studio and player folders (`npx vitest run components/playsense-studio`), tsc, eslint.

- [ ] **Step 7: Commit**

```bash
git add components/playsense-studio/player/transport/transport-bar.tsx components/playsense-studio/player/transport/__tests__/transport-bar-layout.test.tsx components/playsense-studio/studio/hear-control.tsx components/playsense-studio/studio/sync-panel.tsx app/globals.css
git commit -m "Give the Studio a one-row transport with Hear and Loop speed in it"
```

---

### Task 4: The waveform tool cluster replaces the context-bar row

This is the mockup's `.wtools`, one floating cluster at the waveform's top right:
- video: Auto-place · snap magnet · Ripple/Single · Flex · notes overlay · zoom slider · fit
- graded: Student preview (when the host gives one) · Auto-align · magnet · notes · zoom · fit

The rest of today's context bar moves into the left panel's **Sync status** group, which SyncPanel already fills through `inspectorEl`:
- Place score at playhead
- Anchor at playhead
- Re-analyze (with the decode progress)
- Undo auto-place
- Count-in and Pre-roll
- the k/n on-hit readout
- the notices

After this task, the `{showSync && (<div className="flex flex-shrink-0 flex-wrap …">…</div>)}` context bar is gone.

**Files:**
- Create: `components/playsense-studio/studio/wave-tools.tsx`
- Create: `components/playsense-studio/studio/sync-actions.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - the context bar ~:1764-1965
  - `.st-zoom-float` ~:2074-2099
  - the inspector portal ~:2200
- Modify: `app/globals.css` (`.st-wtools`)
- Test: `components/playsense-studio/studio/__tests__/wave-tools.test.tsx` (create)
- Update: `components/playsense-studio/studio/__tests__/sync-panel-graded.test.tsx`. It queries Count-in, Pre-roll and Auto-align in the context bar. Give its SyncPanel render an `inspectorEl` (a detached `div` appended to `document.body`), and query the moved controls there.

**Interfaces:**
- Consumes: `ZoomSlider` (`components/playsense-studio/sync/zoom-slider.tsx`: `{ pps, onZoomTo, onZoomBy, onFit }`)
- Produces:
  - `WaveTools(props: WaveToolsProps)`
  - `SyncActions(props: SyncActionsProps)`, the Sync status block

```ts
export interface WaveToolsProps {
  graded: boolean;
  /** Video: Auto-place bars. */
  onAutoPlace?: () => void;
  autoPlaceDisabled?: boolean;
  autoPlaceTitle?: string;
  /** Graded: Auto-align the media to the tempo grid. */
  onAutoAlign?: () => void;
  autoAlignDisabled?: boolean;
  onStudentPreview?: () => void;
  dragAll: boolean;
  onDragAll: (ripple: boolean) => void;
  flexMode?: boolean;
  onFlex?: () => void;
  showNotes: boolean;
  onShowNotes: () => void;
  zoom: { pps: number; onZoomTo: (pps: number) => void; onZoomBy: (f: number) => void; onFit: () => void };
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// components/playsense-studio/studio/__tests__/wave-tools.test.tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaveTools } from '../wave-tools';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const zoom = { pps: 40, onZoomTo: vi.fn(), onZoomBy: vi.fn(), onFit: vi.fn() };
const byLabel = (l: string) => host.querySelector(`[aria-label="${l}"]`) as HTMLButtonElement | null;

describe('WaveTools', () => {
  it('shows the video tools in one cluster', () => {
    const onAutoPlace = vi.fn();
    act(() => root.render(<WaveTools graded={false} onAutoPlace={onAutoPlace} dragAll onDragAll={() => {}} flexMode={false} onFlex={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    const cluster = host.querySelector('.st-wtools')!;
    for (const l of ['Auto-place bars', 'Ripple', 'Single', 'Flex', 'Notes on the waveform', 'Fit the section']) {
      expect(cluster.querySelector(`[aria-label="${l}"]`), l).not.toBeNull();
    }
    act(() => byLabel('Auto-place bars')!.click());
    expect(onAutoPlace).toHaveBeenCalled();
  });

  it('shows Auto-align and Student preview for a graded part, without Ripple or Flex', () => {
    act(() => root.render(<WaveTools graded onAutoAlign={() => {}} onStudentPreview={() => {}} dragAll onDragAll={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    expect(byLabel('Auto-align')).not.toBeNull();
    expect(byLabel('Student preview')).not.toBeNull();
    expect(byLabel('Ripple')).toBeNull();
    expect(byLabel('Flex')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and check that it fails.**

- [ ] **Step 3: Implement `wave-tools.tsx`**

Use lucide icons: `Wand2`, `ChevronsLeftRight`, `Move`, `Spline`, `Music2`, `Play`. The zoom slider is the existing `ZoomSlider`, and its fit button gets the accessible name "Fit the section". Read `zoom-slider.tsx`. If its fit button's label is fixed, add an optional `fitLabel` prop defaulting to its current text, and pass `"Fit the section"` from here.

```tsx
'use client';
// PlaySense Studio — the waveform's floating tool cluster (mockup .wtools):
// everything that acts on the waveform lane, top-right over it, dimmed until
// hovered. Replaces the old context-bar row.
import { ChevronsLeftRight, Move, Music2, Play, Spline, Wand2 } from 'lucide-react';
import { ZoomSlider } from '@/components/playsense-studio/sync/zoom-slider';

export interface WaveToolsProps { /* as in the plan's Interfaces block */ }

export function WaveTools(p: WaveToolsProps) {
  return (
    <div className="st-wtools" role="toolbar" aria-label="Waveform tools">
      {p.graded ? (
        <>
          {p.onStudentPreview && (
            <button type="button" className="st-wtools-auto" aria-label="Student preview" title="Play it the way a student gets it" onClick={p.onStudentPreview}>
              <Play className="h-3.5 w-3.5" />Student preview
            </button>
          )}
          <button type="button" className="st-wtools-auto is-quiet" aria-label="Auto-align" disabled={p.autoAlignDisabled}
            title="Line the play-along up with the tempo grid" onClick={p.onAutoAlign}>
            <Wand2 className="h-3.5 w-3.5" />Auto-align
          </button>
        </>
      ) : (
        <button type="button" className="st-wtools-auto" aria-label="Auto-place bars" disabled={p.autoPlaceDisabled}
          title={p.autoPlaceTitle ?? 'Fit every bar line to the recording'} onClick={p.onAutoPlace}>
          <Wand2 className="h-3.5 w-3.5" />Auto-place
        </button>
      )}
      <span className="st-divline" />
      {!p.graded && (
        <div className="st-seg" role="radiogroup" aria-label="Drag mode">
          <button type="button" aria-label="Ripple" className={p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(true)}
            title="Ripple — dragging a measure moves it and everything after it (hold Option to move just one)">
            <ChevronsLeftRight className="h-3.5 w-3.5" />Ripple
          </button>
          <button type="button" aria-label="Single" className={!p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(false)}
            title="Single — dragging moves only that measure or marker (hold Option to ripple)">
            <Move className="h-3.5 w-3.5" />Single
          </button>
        </div>
      )}
      {!p.graded && p.onFlex && (
        <button type="button" aria-label="Flex" aria-pressed={!!p.flexMode} className={`st-iconbtn${p.flexMode ? ' is-on amber' : ''}`}
          title="Flex — click a hit to add a point, drag it onto the written note, double-click to remove (F)" onClick={p.onFlex}>
          <Spline className="h-4 w-4" />
        </button>
      )}
      <button type="button" aria-label="Notes on the waveform" aria-pressed={p.showNotes}
        className={`st-iconbtn${p.showNotes ? ' amber' : ''}`} title={p.showNotes ? 'Hide notes on the waveform' : 'Show notes on the waveform'} onClick={p.onShowNotes}>
        <Music2 className="h-4 w-4" />
      </button>
      <span className="st-divline" />
      <ZoomSlider pps={p.zoom.pps} onZoomTo={p.zoom.onZoomTo} onZoomBy={p.zoom.onZoomBy} onFit={p.zoom.onFit} fitLabel="Fit the section" />
    </div>
  );
}
```

The snap magnet in the mockup is not a live feature: live snapping always happens within 8 px, with ⌘ to skip. Don't add it. (Ruling: no toggle without a feature behind it.)

CSS (`app/globals.css`), from mockup `.wtools` and `.wtools .auto`. Replace the old `.st-zoom-float` rule; search for it and remove it once SyncPanel no longer uses it:

```css
/* The waveform's floating tool cluster (mockup .wtools). */
.st-wtools { position: absolute; top: 28px; right: 10px; z-index: 6; display: flex; align-items: center; gap: 2px;
  height: 32px; padding: 0 4px; border-radius: 10px; border: 1px solid hsl(var(--border));
  background: color-mix(in srgb, hsl(var(--card)) 84%, transparent); backdrop-filter: blur(6px);
  box-shadow: 0 2px 10px rgba(0,0,0,.35); opacity: .72; transition: opacity .15s; }
.st-wtools:hover, .st-wtools:focus-within { opacity: 1; }
.st-wtools .st-seg { padding: 2px; }
.st-wtools .st-seg button { height: 22px; font-size: 11px; padding: 0 7px; }
.st-wtools .st-divline { height: 16px; margin: 0 3px; }
.st-wtools-auto { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 7px;
  font-size: 11.5px; font-weight: 600; background: hsl(var(--primary) / .14); color: hsl(var(--primary)); }
.st-wtools-auto:hover:not(:disabled) { background: hsl(var(--primary) / .24); }
.st-wtools-auto:disabled { opacity: .4; cursor: not-allowed; }
.st-wtools-auto.is-quiet { background: none; color: hsl(var(--foreground)); }
.st-iconbtn.amber { color: hsl(var(--primary)); }
```

- [ ] **Step 4: Implement `sync-actions.tsx`**

This is a plain vertical block for the Sync status panel. It takes the existing handlers and state as props and renders, in order:

1. `PlaceScoreControl`, moved as-is. Keep its import in SyncPanel and pass it through as `placeControl: ReactNode`.
2. "Anchor at playhead" (only when `anchorOwner`), as an `st-chip block` button.
3. Undo auto-place (when `autoPlaceUndo`).
4. Graded only: the Count-in `st-seg` radiogroup (unchanged markup), the Pre-roll chip, and the `{onHit.k}/{onHit.n} notes on a hit` readout.
5. "Re-analyze audio", with the decode progress text when `decodeState === 'loading'`.
6. The notices (`autoPlaceNotice`, `alignNotice`) as `role="status"` text.

Props mirror exactly what the moved JSX reads. Name each prop after the SyncPanel variable it takes, so the move is mechanical:
- `placeControl`
- `anchor?: { onSet: () => void }`
- `autoPlaceUndo?: () => void`
- `graded?: { countInBars: 1 | 2; onCountIn: (n: 1 | 2) => void; preroll: boolean; onPreroll: () => void; onHit: { k: number; n: number } | null }`
- `reanalyze: { onClick: () => void; state: 'idle' | 'loading' | 'ready' | 'error'; progress: number }`
- `notices: string[]`

Use `.st-chip.block` (mockup) for full-width buttons. Add to `globals.css`:
`.st-chip.block { width: 100%; justify-content: flex-start; height: 34px; }`

- [ ] **Step 5: Rewire SyncPanel**
  1. Delete the whole context-bar block: from the comment `{/* Context bar — placement · drag mode · loop/analyze (sync only) */}` through its closing `)}` just before `{/* The unified stage … */}`.
  2. Replace the contents of `<div className="st-zoom-float">…</div>` with `<WaveTools …/>`, wired to:
     - `graded`
     - `onAutoPlace={runAutoPlace}` and `autoPlaceDisabled={!hits.length || tweenActive}`
     - `onAutoAlign={runAutoAlign}` and `autoAlignDisabled={!hits.length}`
     - `onStudentPreview={onStudentPreview}`: a new optional SyncPanel prop that the exercise host passes. `studio-workspace.tsx` currently renders its Student preview button in its own app bar; keep that button and don't pass the prop there, so nothing duplicates. The mockup's cluster placement is for when a host opts in.
     - `dragAll` and `onDragAll={setDragAll}`
     - `flexMode` and `onFlex={() => setFlexMode((v) => !v)}`
     - `showNotes` and `onShowNotes={() => setShowNotes((v) => !v)}`
     - `zoom={{ pps, onZoomTo: zoomTo, onZoomBy: (f) => zoomBy(f, anchorPxFor(timelineNow, pps, scrollLeft, viewportWidth)), onFit: fitZoom }}`

     Remove the wrapping `st-zoom-float` div: `WaveTools` positions itself.
  3. At the top of the inspector portal's fragment (`{inspectorEl && createPortal(<>…`), render `<SyncActions …/>` when `showSync`, with the moved pieces.
- [ ] **Step 6: Update the `sync-panel-graded` test**, as described under Files. Run the Studio tests, tsc and eslint.

- [ ] **Step 7: Commit**

```bash
git add components/playsense-studio/studio/wave-tools.tsx components/playsense-studio/studio/sync-actions.tsx components/playsense-studio/studio/__tests__/wave-tools.test.tsx components/playsense-studio/studio/__tests__/sync-panel-graded.test.tsx components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/sync/zoom-slider.tsx app/globals.css
git commit -m "Float the waveform tools over the waveform and move placement into Sync status"
```

---

### Task 5: The editor row goes (corner tools, Score panel fields, toast)

The mockup has no row between the waveform and the staff. The row's contents move like this:
- **Staff / Piano-roll, Record MIDI and Add measure (at the end)** go into a small `.corner` cluster at the strip's top right (mockup `.corner`, `top: 24px; right: 8px`).
- **Track name and instrument** go into the left panel's **Score** group (`ScoreMetaEditor`, portalled into `metaEl`).
- **`notice` and `flash`** become a toast over the stage bottom (mockup `.toast`).

**Files:**
- Create: `lib/playsense-studio/instrument-options.ts`: move `INSTRUMENT_OPTIONS` out of `integrated-editor.tsx:65-80` and export it.
- Create: `components/playsense-studio/studio/strip-corner.tsx`
- Modify: `components/playsense-studio/studio/midi-record-button.tsx`: add `compact?: boolean`.
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`: delete the editor bar at ~:838-921 and the flash `<p>` at ~:916-921; render `StripCorner` in the staff and piano-roll views, and the toast.
- Modify: `components/playsense-studio/studio/score-meta-editor.tsx`: add the Track name and Instrument fields.
- Modify: `app/globals.css` (`.st-strip-corner`, `.st-toast`)
- Tests:
  - `components/playsense-studio/studio/__tests__/score-meta-editor.test.tsx` (extend)
  - `components/playsense-studio/studio/__tests__/integrated-editor-strip.test.tsx` (extend)

**Interfaces:**
- Produces:
  - `INSTRUMENT_OPTIONS: Array<{ value: Instrument; label: string }>` from `@/lib/playsense-studio/instrument-options`
  - `StripCorner({ tab, onTab, midi, onAddEnd, addEndProblem }: { tab: 'staff' | 'piano-roll'; onTab: (t: 'staff' | 'piano-roll') => void; midi: ReactNode; onAddEnd: () => void; addEndProblem: string | null })`
  - `ScoreMetaEditor` gains optional `trackIndex?: number` (default 0)

- [ ] **Step 1: Write the failing tests**

In `score-meta-editor.test.tsx` (follow its existing mount helper):

```tsx
it('edits the track name and instrument (moved from the editor row)', () => {
  // mount with the file's helper; capture dispatch = vi.fn()
  const name = host.querySelector('input[aria-label="Track name"]') as HTMLInputElement;
  const inst = host.querySelector('select[aria-label="Instrument"]') as HTMLSelectElement;
  expect(name).not.toBeNull();
  expect(inst).not.toBeNull();
  act(() => { inst.value = 'perc-conga'; inst.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(dispatch).toHaveBeenCalledWith({ type: 'set-track-instrument', trackIndex: 0, instrument: 'perc-conga' });
});
```

In `integrated-editor-strip.test.tsx`:

```tsx
it('has no editor row: the tools sit in the strip corner', () => {
  // mount as the file's other tests do
  expect(host.querySelector('input[aria-label="Track name"]')).toBeNull();
  const corner = host.querySelector('.st-strip-corner')!;
  expect(corner.querySelector('[aria-label="Staff"]')).not.toBeNull();
  expect(corner.querySelector('[aria-label="Piano-roll"]')).not.toBeNull();
  expect(corner.querySelector('[aria-label="Record MIDI"]')).not.toBeNull();
  expect(corner.querySelector('[aria-label="Add a measure at the end"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run them and check that they fail.**

- [ ] **Step 3: Implement**

1. Create `lib/playsense-studio/instrument-options.ts` with the same 14 entries, `import type { Instrument } from '@/components/playsense-studio/shared/score-model/types'`, and change `integrated-editor.tsx` to import from it.
2. `midi-record-button.tsx`: when `props.compact`, the trigger is:

   ```tsx
   <button type="button" className="st-iconbtn" aria-label="Record MIDI" title="Record MIDI notes with your performance timing">
     <Circle className="h-4 w-4 text-primary" />
   </button>
   ```

   Otherwise it stays as today. Add `compact?: boolean` to `Props`.

3. `strip-corner.tsx`:

   ```tsx
   'use client';
   // PlaySense Studio — the strip's corner tools (mockup .corner): the staff /
   // piano-roll switch, Record MIDI and "add a measure at the end". They used
   // to fill a whole row above the staff.
   import { Music, Piano, Plus } from 'lucide-react';
   import type { ReactNode } from 'react';

   export function StripCorner({ tab, onTab, midi, onAddEnd, addEndProblem }: {
     tab: 'staff' | 'piano-roll'; onTab: (t: 'staff' | 'piano-roll') => void;
     midi: ReactNode; onAddEnd: () => void; addEndProblem: string | null;
   }) {
     return (
       <div className="st-strip-corner">
         <div className="st-seg" role="radiogroup" aria-label="View">
           <button type="button" role="radio" aria-label="Staff" aria-checked={tab === 'staff'} className={tab === 'staff' ? 'is-on' : ''} onClick={() => onTab('staff')} title="Staff"><Music className="h-3.5 w-3.5" /></button>
           <button type="button" role="radio" aria-label="Piano-roll" aria-checked={tab === 'piano-roll'} className={tab === 'piano-roll' ? 'is-on' : ''} onClick={() => onTab('piano-roll')} title="Piano-roll"><Piano className="h-3.5 w-3.5" /></button>
         </div>
         {midi}
         <button type="button" className="st-iconbtn" aria-label="Add a measure at the end" disabled={!!addEndProblem}
           title={addEndProblem ?? 'Add a measure at the end'} onClick={onAddEnd}><Plus className="h-4 w-4" /></button>
       </div>
     );
   }
   ```

   (If lucide has no `Piano` icon in this version, use `KeyboardMusic`. Check with `grep -o '"Piano"\|KeyboardMusic' node_modules/lucide-react/dist/lucide-react.d.ts | head -2`.)

4. In `integrated-editor.tsx`:
   - Delete the editor bar `<div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">…</div>`.
   - Delete the `{flash && (<p … className="st-flash …">)}` block.
   - Inside `staffWrapRef`'s div (after `EditableMeasureStrip`), and at the top of the piano-roll view's container (give it `className="relative"`), render:

     ```tsx
     <StripCorner
       tab={editorTab}
       onTab={(t) => { setEditorTab(t); if (t !== 'staff' && zoom) finishZoomClose(); }}
       midi={activeTrack ? <MidiRecordButton compact score={score} trackIndex={activeTrackIndex} targetMeasure={targetMeasureIndex} dispatch={dispatch} getCurrentSeconds={getCurrentSeconds} recordingSource={recordingSource} /> : null}
       onAddEnd={() => insertMeasureAt(measureCount)}
       addEndProblem={gapProblems[measureCount] ?? null}
     />
     ```

     "Add after the selection" stays reachable through the gap "+" and the measure bar's duplicate. (Ruling: the mockup's corner adds at the end only.)

   - Toast: at the end of the component's root fragment, render `{(notice || flash) && <p role="status" className="st-toast">{notice ?? flash}</p>}`. The root must be `relative`; it is `flex h-full min-h-0 flex-col gap-3`, so add `relative`.

5. `score-meta-editor.tsx`: after the Title field, add two fields in the same label style:
   - "Track name": `<input aria-label="Track name" …>` dispatching `{ type: 'set-track-name', trackIndex, name }`
   - "Instrument": `<select aria-label="Instrument">` over `INSTRUMENT_OPTIONS`, dispatching `{ type: 'set-track-instrument', trackIndex, instrument }`

   Read `score.tracks[trackIndex]`, and render nothing for them when the track is missing.

6. CSS:

   ```css
   /* The strip's corner tools (mockup .corner). */
   .st-strip-corner { position: absolute; right: 8px; top: 24px; z-index: 16; display: flex; gap: 2px; align-items: center;
     padding: 2px; border-radius: 9px; background: hsl(var(--card) / .85); backdrop-filter: blur(4px); }
   .st-strip-corner .st-seg { padding: 2px; }
   .st-strip-corner .st-seg button { height: 22px; }
   /* Short-lived editor notices, over the stage (mockup .toast). */
   .st-toast { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 60; max-width: calc(100% - 32px);
     padding: 9px 14px; border-radius: 10px; font-size: 12.5px; background: hsl(22 14% 12%);
     border: 1px solid hsl(0 0% 100% / .14); box-shadow: 0 10px 30px rgba(0,0,0,.55); animation: st-pop .18s cubic-bezier(.2,.8,.2,1); }
   ```

- [ ] **Step 4: Verify:** the tests pass, then the Studio tests, tsc and eslint. `studio-workspace.tsx` (the exercise) also renders `IntegratedEditor` through SyncPanel, and its Score tab uses `ScoreMetaEditor`, so it picks up the fields too.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/instrument-options.ts components/playsense-studio/studio/strip-corner.tsx components/playsense-studio/studio/midi-record-button.tsx components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/score-meta-editor.tsx components/playsense-studio/studio/__tests__/score-meta-editor.test.tsx components/playsense-studio/studio/__tests__/integrated-editor-strip.test.tsx app/globals.css
git commit -m "Drop the editor row: tools in the strip corner, track fields in the Score panel"
```

---

### Task 6: The bar header, flag dots, and how a selected bar looks

Mockup `.mbox .hb` / `.cap` / `.flagdot` / `.mbox.sel`:
- **The header band** is transparent with a bottom border. It shows the number, a flag dot and the beat-count chip on the right. There's no repeat-pass text: the repeat lane already says it, and the text is what truncates to "pass 1…" today.
- **Hovering** a bar tints its header.
- **A selected bar** gets `background: primary/.07`, an inset 1.5 px `primary/.8` outline and a `primary/.2` header.
- **The waveform** tints the selected bars' time span too.

**Files:**
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx`: the measure block (~:497-540), the narrow placeholder (~:480-495), and `MeasureStripItem` (add `flag`)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`: build `flag` into `stripItems` from `measureTimings[i]?.flag`; add the `onMeasureRangeChange` prop and effect
- Modify: `components/playsense-studio/sync/waveform-canvas.tsx`: add the `selection` prop, drawn like `loop` (Plan 7)
- Modify: `components/playsense-studio/studio/sync-panel.tsx`: keep the selected range, convert it to timeline seconds, pass `selection`
- Modify: `app/globals.css`
- Tests:
  - `components/playsense-studio/studio/__tests__/editable-measure-strip.test.tsx` (extend)
  - `components/playsense-studio/sync/__tests__/waveform-canvas-loop.test.tsx` (extend with a `selection` case)

**Interfaces:**
- Produces:
  - `MeasureStripItem.flag?: string | null`
  - `IntegratedEditorProps.onMeasureRangeChange?: (range: [number, number] | null) => void`
  - `WaveformCanvasProps.selection?: { a: number; b: number } | null` (timeline seconds)

- [ ] **Step 1: Write the failing tests**

In `editable-measure-strip.test.tsx` (use its mount helper and item factory; add `flag: 'no hit near its first note'` to one item):

```tsx
it('draws the mockup header: number, flag dot, beat count; no pass text', () => {
  const block = host.querySelector('[data-measure-index="0"]')!;
  const hb = block.querySelector('.st-hb')!;
  expect(hb.textContent).toContain('1');
  expect(hb.querySelector('.st-flagdot')?.getAttribute('title')).toBe('Timing: no hit near its first note');
  expect(hb.textContent).not.toMatch(/pass/);
});

it('marks a selected bar with is-sel instead of a ring', () => {
  // render with selectedMeasures={[0, 0]}
  const block = host.querySelector('[data-measure-index="0"]')!;
  expect(block.classList.contains('is-sel')).toBe(true);
  expect(block.className).not.toMatch(/ring-2/);
});
```

In `waveform-canvas-loop.test.tsx`, add:

```tsx
it('tints the selected bars at 7% with no edges', () => {
  rects = [];
  // render as draw() does, with loop={null} and selection={{ a: 4, b: 9 }}
  expect(rects).toContainEqual({ x: 40, w: 50, alpha: 0.07 });
});
```

(Extend the file's `draw` helper to accept `selection`.)

- [ ] **Step 2: Run them and check that they fail.**

- [ ] **Step 3: Implement**

1. `MeasureStripItem`: add `flag?: string | null;` with the doc comment "Timing flag for this bar (Sync status), shown as a dot in its header."
2. `integrated-editor.tsx`, where `stripItems` is built: add `flag: measureTimings[index]?.flag ?? null`. Read how the items are mapped and use its index variable.
3. The strip's full-width block: replace the class expression with

   ```tsx
   className={`st-mbox absolute${inRange(item.measureIndex) ? ' is-sel' : ''}${isFocus(item.measureIndex) ? ' st-measure-focus' : ''}${newBars?.has(item.measureIndex) ? ' is-new' : ''}${item.fill.kind === 'over' ? ' is-over' : ''}`}
   ```

   Replace the header band `<div … bg-muted/70 …>` with

   ```tsx
   <div className="st-hb" style={{ height: HANDLE_BAND_PX }}>
     <span className="tabular-nums leading-none">{item.measureNumber}</span>
     {item.flag && <span className="st-flagdot" title={`Timing: ${item.flag}`} />}
     {width >= 60 && (
       <span className={`st-cap is-${item.fill.kind} ml-auto shrink-0 tabular-nums leading-none`} title={fillTitle(item.measureNumber, item.fill)}>
         {item.fill.kind === 'empty' ? `0/${beatsText(item.fill.totalBeats)}` : `${beatsText(item.fill.usedBeats)}/${beatsText(item.fill.totalBeats)}`}
       </span>
     )}
   </div>
   ```

   The narrow placeholder uses `className={`st-mbox is-narrow absolute …${inRange(...) ? ' is-sel' : ''}`}` instead of the ring classes, and keeps its number label.

4. CSS (the mockup's `.mbox` rules with the `st-` prefix; `.st-cap` exists and gets the mockup's mono look):

   ```css
   .st-mbox { border-left: 1px solid transparent; }
   .st-mbox .st-hb { position: absolute; inset: 0 0 auto 0; z-index: 10; display: flex; align-items: center; gap: 6px; padding: 0 7px;
     font-size: 11px; color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border)); white-space: nowrap; overflow: hidden;
     transition: background .12s, color .12s; }
   .st-mbox:hover .st-hb { background: hsl(var(--primary) / .1); color: hsl(var(--foreground)); }
   .st-mbox.is-sel { background: hsl(var(--primary) / .07); box-shadow: inset 0 0 0 1.5px hsl(var(--primary) / .8); }
   .st-mbox.is-sel .st-hb { background: hsl(var(--primary) / .2); color: hsl(var(--foreground)); }
   .st-mbox.is-over { background: hsl(var(--destructive) / .06); }
   .st-mbox.is-narrow { display: grid; place-items: start center; padding-top: 4px; font-size: 10px; color: hsl(var(--muted-foreground)); }
   .st-flagdot { width: 6px; height: 6px; border-radius: 50%; flex: none; background: hsl(var(--gold-highlight)); }
   .st-cap { font: 600 10.5px var(--font-mono, ui-monospace, monospace); padding: 1px 6px; border-radius: 5px; background: hsl(0 0% 100% / .04); }
   ```

   Keep the existing `.st-cap.is-*` colour rules.

5. `integrated-editor.tsx`: add the prop `onMeasureRangeChange`, and an effect after `bounds` is computed:

   ```tsx
   const boundsKey = bounds ? `${bounds[0]}:${bounds[1]}` : '';
   useEffect(() => { onMeasureRangeChange?.(bounds ? [bounds[0], bounds[1]] : null); }, [boundsKey]); // eslint-disable-line react-hooks/exhaustive-deps
   ```

6. `waveform-canvas.tsx`: add the `selection` prop, mirrored into a `selectionRef` in the same effect as `loopRef`. Draw it right before the loop bracket:

   ```ts
   const sel = selectionRef.current;
   if (sel && sel.b > sel.a) {
     const x0 = videoTimeToX(sel.a), x1 = videoTimeToX(sel.b);
     if (x1 >= 0 && x0 <= w) { ctx.fillStyle = theme.measureFill; ctx.globalAlpha = 0.07; ctx.fillRect(x0, waveTop, x1 - x0, waveH); ctx.globalAlpha = 1; }
   }
   ```

   Add `selection` to the redraw deps. SyncPanel passes a memoised object so it doesn't redraw every frame (the Plan 7 lesson).

7. SyncPanel: `const [barRange, setBarRange] = useState<[number, number] | null>(null);`, pass `onMeasureRangeChange={setBarRange}` to `IntegratedEditor`, then

   ```tsx
   const waveSelection = useMemo(() => {
     if (!barRange) return null;
     const a = markers.measures[barRange[0]]?.beats[0]?.videoTimeSeconds;
     const b = markers.measures[barRange[1] + 1]?.beats[0]?.videoTimeSeconds ?? markers.tailVideoTimeSeconds;
     return a !== undefined && b > a ? { a, b } : null;
   }, [barRange, markers]);
   ```

   and `selection={waveSelection}` on `WaveformCanvas`.

- [ ] **Step 4: Verify:** the tests pass, then the Studio, sync and zoom tests, tsc and eslint (the waveform-canvas lint base is 22 errors, unchanged).

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/editable-measure-strip.tsx components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/sync/waveform-canvas.tsx components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/studio/__tests__/editable-measure-strip.test.tsx components/playsense-studio/sync/__tests__/waveform-canvas-loop.test.tsx app/globals.css
git commit -m "Draw bar headers and selected bars the way the mockup does"
```

---

### Task 7: The measure bar and the strip footer, as in the mockup

**The measure bar** (mockup `.fbar` in `renderMeasureBar`):
- The info reads `m.6  0:10.6  ≈96.0 ●`: mono spaced spans, no "BPM", and the flag as a small pip with its reason in the title.
- The labelled buttons are `Edit ⏎`, `Loop`, `Quantize` (Watch only) and `Repeat` (or `×2` when the bars are in a repeat).
- The icon buttons are duplicate, copy, paste and bar properties, then a separator, then clear and delete.
- The surface is the mockup's darker glass.

**The footer** (mockup `.strip-foot`) floats over the strip's bottom edge instead of taking a row below it:
- the issue chip, with a chevron icon
- a hint with `kbd` keys
- a round "?" help button

**Files:**
- Modify: `components/playsense-studio/studio/measure/measure-bar.tsx`: add the `repeatCount?: number | null` prop.
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`:
  - pass `repeatCount` from `repeatGroupAtRange?.count ?? null` (it exists, ~:1060)
  - move the footer inside `staffWrapRef`'s div
- Modify: `app/globals.css`: `.st-fbar` values, `.st-strip-foot`, `.st-issue-chip`, `.st-help-btn`, `.st-strip-foot kbd`
- Tests:
  - `components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx` (extend)
  - `components/playsense-studio/studio/__tests__/integrated-editor-measure-bar.test.tsx` (extend)

- [ ] **Step 1: Write the failing tests**

`measure-bar.test.tsx` (use its render helper):

```tsx
it('labels Edit, Loop and Repeat with text, and shows ×n inside a repeat', () => {
  // render with repeatCount={2}
  const text = host.querySelector('[role="toolbar"]')!.textContent!;
  expect(text).toContain('Edit');
  expect(text).toContain('Loop');
  expect(text).toContain('×2');
  expect(text).not.toContain('BPM');
});
it('shows the flag as a pip, with the reason in its title', () => {
  // render with flag="no hit near its first note"
  const pip = host.querySelector('.st-fbar-info .st-pip')!;
  expect(pip.getAttribute('title')).toBe('no hit near its first note');
});
```

`integrated-editor-measure-bar.test.tsx`:

```tsx
it('floats the footer over the strip and changes the hint when bars are selected', () => {
  // mount; the footer is inside the staff wrapper, not after it
  const foot = host.querySelector('.st-strip-foot')!;
  expect(foot.parentElement!.querySelector('[data-measure-index]') || foot.closest('.relative')).toBeTruthy();
  expect(foot.textContent).toContain('Drag across bars to select');
  // select bar 0 the way the file's other tests do, then:
  expect(host.querySelector('.st-strip-foot')!.textContent).toContain('edit notes');
});
```

- [ ] **Step 2: Run them and check that they fail.**

- [ ] **Step 3: Implement the measure bar**

Rewrite the info and the three labelled buttons:

```tsx
<span className="st-fbar-info">
  <span>{props.label}</span>
  <span>{formatBarTime(props.startSeconds)}</span>
  {props.bpm !== null && <span title="Tempo these bars play at">≈{props.bpm.toFixed(1)}</span>}
  {props.flag && <span className="st-pip warn" title={props.flag} style={{ width: 7, height: 7 }} />}
  {props.flexInfo && <span className="st-fbar-flex" title="This range has flex applied">{props.flexInfo}</span>}
</span>
<span className="st-fbar-sep" aria-hidden />
{btn('Edit', 'Zoom in to edit notes (⏎)', <Maximize2 className={icon} />, props.onEdit, { text: 'Edit', kbd: '⏎' })}
{btn('Loop', 'Loop these bars while you work (L)', <Repeat1 className={icon} />, props.onLoop, { text: 'Loop', problem: props.canLoop ? null : 'Play the video to loop', pressed: props.looping })}
{props.onQuantize && btn('Quantize', 'Pull the recording onto the written notes (Flex Time)', <Magnet className={icon} />, () => props.onQuantize!(menuAnchor), { text: 'Quantize', problem: props.quantizeProblem })}
{btn('Repeat', 'Play these bars more than once', <Repeat className={icon} />, () => props.onRepeat(menuAnchor), { text: props.repeatCount ? `×${props.repeatCount}` : 'Repeat' })}
```

The duplicate, copy, paste and bar-properties buttons keep their icons and lose their text (`Bar ▾` becomes icon-only). The clear and delete buttons come after a separator. Extend `btn`'s options with `kbd?: string`, rendered as `<span className="st-fbar-kbd">{kbd}</span>` after the text. Delete is marked `danger` (`className="is-danger"`).

CSS (the mockup `.fbar` values; replace the existing `.st-fbar` background, border and shadow lines):

```css
.st-fbar { background: hsl(22 14% 11% / .97); border: 1px solid hsl(0 0% 100% / .14); box-shadow: 0 12px 32px rgba(0,0,0,.55); backdrop-filter: blur(8px); }
.st-fbar button { height: 30px; min-width: 30px; font-weight: 600; justify-content: center; gap: 6px; }
.st-fbar .st-fbar-info { display: inline-flex; gap: 8px; align-items: center; }
.st-fbar-kbd { font: 10px var(--font-mono, ui-monospace, monospace); opacity: .55; }
.st-fbar button.is-danger:hover:not(:disabled) { background: hsl(var(--destructive) / .15); color: hsl(var(--destructive)); }
```

- [ ] **Step 4: Implement the footer**

Move the `{!zoom && <div className="st-strip-foot">…</div>}` block inside the `<div ref={staffWrapRef} className="relative min-h-0 flex-1">`, after `EditableMeasureStrip`. Then:
- The issue chip ends with `<ChevronRight className="h-3.5 w-3.5" />` instead of `▾`.
- The hint, with bars selected, is `<><kbd>⏎</kbd> edit notes · <kbd>⌘D</kbd> duplicate · <kbd>⌫</kbd> delete · <kbd>esc</kbd> deselect</>`.
- The help button gets `className="st-help-btn"`.

CSS (mockup `.strip-foot`, `.hint`, `.issue-chip`, `.help-btn`):

```css
.st-strip-foot { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 17; display: flex; align-items: center; gap: 8px;
  pointer-events: none; min-height: 0; padding: 0; font-size: 11px; color: hsl(var(--muted-foreground) / .85); }
.st-strip-foot > * { pointer-events: auto; }
.st-strip-foot > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-strip-foot kbd { font: 10px var(--font-mono, ui-monospace, monospace); background: hsl(var(--muted)); border: 1px solid hsl(var(--border));
  border-radius: 4px; padding: 0 5px; color: hsl(var(--foreground) / .85); }
.st-issue-chip { height: 24px; padding: 0 9px; border: 1px solid hsl(var(--gold-highlight) / .4); background: hsl(var(--gold-highlight) / .12); font-size: 11.5px; }
.st-issue-chip.is-bad { border-color: hsl(var(--destructive) / .45); background: hsl(var(--destructive) / .12); }
.st-help-btn { margin-left: auto; width: 24px; height: 24px; border-radius: 999px; border: 1px solid hsl(var(--border));
  background: hsl(var(--card)); color: hsl(var(--muted-foreground)); font-size: 12px; font-weight: 700; }
.st-help-btn:hover { color: hsl(var(--foreground)); }
```

The floating video sits over the strip's bottom-right. The footer's `?` must stay clickable, so give the footer `right: 250px` when a monitor is present. The Studio always has one on the sync path: use `right: 250px` unconditionally, and note this in the report.

- [ ] **Step 5: Verify, then commit**

```bash
git add components/playsense-studio/studio/measure/measure-bar.tsx components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx components/playsense-studio/studio/__tests__/integrated-editor-measure-bar.test.tsx app/globals.css
git commit -m "Restyle the measure bar and float the strip footer as in the mockup"
```

---

### Task 8: The zoom's header, docked note toolbar and staff scale

This is the mockup's `renderFocus` and `renderNoteBar`:
- **The header** reads `‹ | Measure 6 · pass 1 of 2` over the meta line `3/4 · adds up · 0:10.6 · ≈96.0 · <flag>`, then a spacer, the **note toolbar**, V1/V2, Keys, Pencil, `Done` and `›`.
- **The note toolbar** is docked in the header row. It never floats over the notes. When the header is too narrow, it wraps to its own line under the title.
- **The staff scale** fits the height: `scale = clamp((bodyH - 26) / 118, 1, 2)`. Today it's a fixed `CENTER_SCALE = 1.5`.

**Files:**
- Modify: `components/playsense-studio/studio/zoom/measure-zoom.tsx`:
  - the header ~:391-410
  - `HEAD_H` and the grid rows
  - `CENTER_SCALE`
  - new props: `toolbar`, `onToggleKeys`, `onTogglePencil`, `fill`/`startSeconds`/`flag`/`repeatPass` for the meta line
- Modify: `components/playsense-studio/studio/zoom/note-toolbar.tsx`:
  - it renders static (no `left`/`top`/`maxWidth`)
  - Pencil moves to the header
  - `clampNoteToolbarPosition` and `NOTE_TOOLBAR_WIDTH_FALLBACK` are deleted once unused
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (~:982-1045): pass the toolbar through the new `toolbar` prop, and anchor More ▾ to the docked toolbar
- Modify: `app/globals.css`: `.st-zoom-overlay` rows, `.st-zoom-head`, `.st-zoom-title`, `.st-zoom-dock`, `.st-fbar.is-docked`
- Tests:
  - `components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx`
  - `components/playsense-studio/studio/zoom/__tests__/note-toolbar.test.tsx`
  - `components/playsense-studio/studio/__tests__/integrated-editor-strip.test.tsx`

**Interfaces:**
- Produces:
  - `export function zoomStaffScale(bodyH: number): number` from `measure-zoom.tsx`
  - `MeasureZoomProps.toolbar?: ReactNode`
  - `MeasureZoomProps.onToggleKeys?: () => void`
  - `MeasureZoomProps.onTogglePencil?: () => void`
  - `MeasureZoomProps.meta?: { startSeconds: number; flag: string | null; repeatPass: { pass: number; count: number } | null }`

- [ ] **Step 1: Write the failing tests**

In `measure-zoom.test.tsx`:

```tsx
import { zoomStaffScale } from '../measure-zoom';

it('scales the staff to the available height, between 1 and 2', () => {
  expect(zoomStaffScale(100)).toBe(1);
  expect(zoomStaffScale(26 + 118 * 1.5)).toBeCloseTo(1.5, 6);
  expect(zoomStaffScale(2000)).toBe(2);
});

it('titles the header "Measure n" with a meta line, and docks the toolbar in it', () => {
  // mount with toolbar={<div data-testid="tb" />} and meta={{ startSeconds: 10.6, flag: null, repeatPass: null }}
  const head = host.querySelector('.st-zoom-head')!;
  expect(head.querySelector('.st-zoom-title b')!.textContent).toMatch(/^Measure \d+/);
  expect(head.querySelector('.st-zoom-dock [data-testid="tb"]')).not.toBeNull();
  expect(head.querySelector('[aria-label="Done"]')).not.toBeNull();
});
```

In `integrated-editor-strip.test.tsx` (the zoom opens with a double-click or Enter, as the file's other zoom tests do):

```tsx
it('keeps the zoom keys working after a docked toolbar button is clicked', () => {
  // open the zoom on bar 0 with a note selected
  const quarter = host.querySelector('.st-zoom-dock [aria-label="Quarter"]') as HTMLButtonElement;
  act(() => { quarter.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); quarter.click(); });
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })); });
  expect(host.querySelector('.st-zoom-dock [aria-label="Half"]')!.getAttribute('aria-pressed')).toBe('true');
});
```

(Check `KEY_VALUE` in `lib/playsense-studio/rhythm.ts` for which digit is Half, and which `VALUE_NAME` labels the buttons use. Adjust the key and labels to the real ones.)

- [ ] **Step 2: Run them and check that they fail.**

- [ ] **Step 3: Implement it in `measure-zoom.tsx`**

1. `export function zoomStaffScale(bodyH: number) { return Math.max(1, Math.min(2, (bodyH - 26) / 118)); }`. Replace every `CENTER_SCALE` use with `const centerScale = zoomStaffScale(bodyH);`, computed after `bodyH`, and delete the constant.
2. The header becomes:

   ```tsx
   <div className="st-zoom-head" ref={headRef}>
     <button type="button" className="st-iconbtn" aria-label="Previous bar" title="Previous bar (⌘←)" disabled={!prev} onMouseDown={keepFocus} onClick={() => onNav(-1)}><ChevronLeft className="h-4 w-4" /></button>
     <div className="st-zoom-title">
       <b>Measure {item.measureNumber}{meta?.repeatPass && <span className="st-zoom-pass"> · pass {meta.repeatPass.pass + 1} of {meta.repeatPass.count}</span>}</b>
       <span>{item.timeSignature.join('/')} · <FillWord fill={fill} /> {meta && <>· {formatBarTime(meta.startSeconds)} </>}{bpm !== null && <>· ≈{bpm.toFixed(1)}</>}{meta?.flag && <> · <span className="text-[hsl(var(--gold-highlight))]">{meta.flag}</span></>}</span>
     </div>
     <div className="st-zoom-dock">{toolbar}</div>
     {showVoices && (/* the existing V1/V2 st-seg, unchanged */)}
     {onToggleKeys && <button type="button" className={`st-iconbtn${zoom.keysOpen ? ' is-on amber' : ''}`} aria-label="Keys" aria-pressed={!!zoom.keysOpen} title="Enter notes from a MIDI keyboard or the on-screen keys (K)" onMouseDown={keepFocus} onClick={onToggleKeys}><Piano className="h-4 w-4" /></button>}
     {onTogglePencil && <button type="button" className={`st-iconbtn${zoom.pencil ? ' is-on amber' : ''}`} aria-label="Pencil" aria-pressed={zoom.pencil} title="Click the staff to add notes (N)" onMouseDown={keepFocus} onClick={onTogglePencil}><Pencil className="h-4 w-4" /></button>}
     <button type="button" className="st-chip" aria-label="Done" title="Back to all bars (Esc)" onMouseDown={keepFocus} onClick={exit}><Minimize2 className="h-4 w-4" />Done</button>
     <button type="button" className="st-iconbtn" aria-label="Next bar" title="Next bar (⌘→)" disabled={!next} onMouseDown={keepFocus} onClick={() => onNav(1)}><ChevronRight className="h-4 w-4" /></button>
   </div>
   ```

   - `FillWord`, local to the file, renders `adds up` (ok colour), `N beats missing` (gold), `N too many` (destructive) or `empty`, using `fill.kind`, `fill.missingBeats` and `fill.usedBeats`/`totalBeats` the way the strip's `fillTitle` does. Read `MeasureFill` in `lib/playsense-studio/measure-fill.ts`.
   - `formatBarTime` is in `measure/measure-bar.tsx`. Export it from there if it isn't exported yet.
   - The old `X` close button is replaced by `Done`, which has the same `exit` handler.
   - **Keys** replaces the `K`-only toggle: `onToggleKeys` sets `keysOpen`, as the K key does.

3. The head height becomes dynamic. Measure it with a `ResizeObserver` on `headRef` into state `headH`, starting at 46, and compute `bodyH = Math.max(0, height - headH - METER_ROW_H)`. Mirror the ref in an effect, not during render.
4. CSS:

   ```css
   .st-zoom-overlay { grid-template-rows: auto 1fr 18px; background: hsl(22 14% 8%); }
   .st-zoom-head { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 46px; padding: 0 8px;
     border-bottom: 1px solid hsl(var(--border)); font-size: 12px; }
   .st-zoom-title { display: flex; flex-direction: column; line-height: 1.2; white-space: nowrap; }
   .st-zoom-title b { font-size: 13px; }
   .st-zoom-title > span { font: 10.5px var(--font-mono, ui-monospace, monospace); color: hsl(var(--muted-foreground)); }
   .st-zoom-pass { color: hsl(var(--teal)); font: 600 10.5px inherit; }
   /* The note toolbar docks here; when the head is too narrow it wraps onto
      its own line under the title instead of covering the notes. */
   .st-zoom-dock { flex: 1 1 auto; min-width: 0; display: flex; justify-content: center; padding: 4px 0; }
   .st-fbar.is-docked { position: static; transform: none; animation: none; box-shadow: none; }
   ```

- [ ] **Step 4: Implement the toolbar and the editor side**

`note-toolbar.tsx`:
- Remove the `left`, `top` and `maxWidth` props and the inline style. The root is `className="st-fbar is-docked"`.
- Remove the Pencil button and the `pencil`/`onPencil` props. It moves to the header.
- Keep every `onMouseDown={(e) => e.preventDefault()}`.
- Delete `clampNoteToolbarPosition` and `NOTE_TOOLBAR_WIDTH_FALLBACK`, and their tests in `note-toolbar.test.tsx`.

`integrated-editor.tsx`: the `MeasureZoom` children render function goes away. Pass:

```tsx
toolbar={<NoteToolbar ref={noteToolbarRef} info={zoomInfo} value={zoomValue} dots={zoomDots} isRest={zoomCurrentEvent?.kind === 'rest'}
  tie={!!zoomCurrentEvent && zoomCurrentEvent.kind !== 'rest' && !!zoomCurrentEvent.tieToNext}
  tripletOn={!!zoomTupletHere && zoomTupletHere.n === 3 && zoomTupletHere.m === 2}
  hasSelection={zoomHasSelection} percussion={zoomToolbarPercussion} editing={zoomEditing} onMore={() => setMorePop(true)} />}
onToggleKeys={() => setZoom({ ...zoom, keysOpen: !zoom.keysOpen })}
onTogglePencil={() => setZoom({ ...zoom, pencil: !zoom.pencil })}
meta={{ startSeconds: measureTimings[zoom.measureIndex]?.startVideoTimeSeconds ?? 0, flag: measureTimings[zoom.measureIndex]?.flag ?? null,
  repeatPass: stripItems[zoom.measureIndex].repeatPass ? { pass: stripItems[zoom.measureIndex].repeatPass!.pass, count: stripItems[zoom.measureIndex].repeatPass!.count } : null }}
```

`MorePopover` then renders as a sibling of `MeasureZoom`, inside `staffWrapRef`. Its anchor comes from the docked toolbar's rect relative to `staffWrapRef`:

```tsx
const tb = noteToolbarRef.current?.getBoundingClientRect(); const wrap = staffWrapRef.current?.getBoundingClientRect();
anchor={{ left: tb && wrap ? Math.max(8, tb.right - wrap.left - 320) : 8, top: tb && wrap ? tb.bottom - wrap.top + 6 : 52 }}
```

Read these rects in an effect or at the click, into state. Don't read refs during render. Remove `noteToolbarAnchor`, `noteToolbarSize` and their measuring effect once they're unused.

- [ ] **Step 5: Verify:** the zoom and Studio tests, tsc and eslint (no new errors).

- [ ] **Step 6: Commit**

```bash
git add components/playsense-studio/studio/zoom/measure-zoom.tsx components/playsense-studio/studio/zoom/note-toolbar.tsx components/playsense-studio/studio/integrated-editor.tsx components/playsense-studio/studio/measure/measure-bar.tsx components/playsense-studio/studio/zoom/__tests__/measure-zoom.test.tsx components/playsense-studio/studio/zoom/__tests__/note-toolbar.test.tsx components/playsense-studio/studio/__tests__/integrated-editor-strip.test.tsx app/globals.css
git commit -m "Dock the note toolbar in the zoom header and scale the staff to fit"
```

---

### Task 9: Drum strokes in one chip instead of a grid

On a drum track the note toolbar currently lists every stroke as a button, which is up to 14 buttons (the user's screenshot). The toolbar becomes one row again:
- One **Stroke** chip shows the current stroke's name (for example `Cáscara · high ▾`).
- Clicking it opens a list (mockup `.pop .pal.list`).
- Picking a stroke enters it and closes the list.
- Escape and an outside click also close it.

**Files:**
- Create: `components/playsense-studio/studio/zoom/stroke-menu.tsx`
- Modify: `components/playsense-studio/studio/zoom/note-toolbar.tsx`: the `percussion ? strokes.map(...)` branch
- Modify: `app/globals.css` (`.st-stroke-list`)
- Test: `components/playsense-studio/studio/zoom/__tests__/stroke-menu.test.tsx` (create)

**Interfaces:**
- Consumes: `NoteToolbarPercussion { strokes: { midi: number; label: string }[]; current: number | null }`
- Produces: `StrokeMenu({ strokes, current, onPick }: { strokes: { midi: number; label: string }[]; current: number | null; onPick: (midi: number) => void })`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrokeMenu } from '../stroke-menu';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const strokes = [{ midi: 60, label: 'High timbal' }, { midi: 61, label: 'Cáscara · high' }, { midi: 62, label: 'Cymbal' }];

describe('StrokeMenu', () => {
  it('is one chip naming the current stroke', () => {
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={() => {}} />));
    expect(host.querySelectorAll('button')).toHaveLength(1);
    expect(host.textContent).toContain('Cáscara · high');
  });

  it('opens a list, enters the picked stroke and closes', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={61} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    const opts = host.querySelectorAll('[role="option"]');
    expect(opts).toHaveLength(3);
    act(() => (opts[2] as HTMLButtonElement).click());
    expect(onPick).toHaveBeenCalledWith(62);
    expect(host.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes on Escape without picking', () => {
    const onPick = vi.fn();
    act(() => root.render(<StrokeMenu strokes={strokes} current={null} onPick={onPick} />));
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Stroke');
  });
});
```

- [ ] **Step 2: Run it and check that it fails.**

- [ ] **Step 3: Implement**

```tsx
'use client';
// PlaySense Studio — the drum track's stroke picker in the note toolbar: one
// chip naming the current stroke, opening a list. Replaces a button per stroke,
// which wrapped the toolbar into a grid over the notes.
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function StrokeMenu({ strokes, current, onPick }: {
  strokes: { midi: number; label: string }[]; current: number | null; onPick: (midi: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [open]);
  const label = strokes.find((s) => s.midi === current)?.label ?? 'Stroke';
  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} title="Which stroke new notes use"
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)}>
        {label}<ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="listbox" aria-label="Strokes" className="st-stroke-list">
          {strokes.map((s) => (
            <button key={s.midi} type="button" role="option" aria-selected={s.midi === current}
              className={s.midi === current ? 'is-on' : ''} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(s.midi); setOpen(false); }}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Escape is captured, and propagation stopped, while the list is open, so the zoom doesn't also close. Check that the zoom's Escape handler listens on window in the bubble phase (`use-zoom-editing.ts` ~:561). A capture listener plus `stopPropagation` keeps it from firing.

In `note-toolbar.tsx`, replace the `percussion.strokes.map(...)` branch with:

```tsx
<StrokeMenu strokes={percussion.strokes} current={percussion.current} onPick={(m) => editing.enterStroke(m)} />
```

CSS (the mockup `.pal.list` look):

```css
.st-stroke-list { position: absolute; top: calc(100% + 6px); left: 0; z-index: 60; width: 220px; max-height: 320px; overflow-y: auto;
  display: grid; gap: 4px; padding: 8px; border-radius: 12px; background: hsl(22 14% 10% / .98);
  border: 1px solid hsl(0 0% 100% / .14); box-shadow: 0 18px 44px rgba(0,0,0,.6); }
.st-stroke-list button { justify-content: flex-start; height: 34px; padding: 0 10px; border-radius: 8px; font-size: 12.5px; font-weight: 500;
  background: hsl(24 12% 13%); border: 1px solid hsl(0 0% 100% / .08); }
.st-stroke-list button.is-on { border-color: hsl(var(--primary)); background: hsl(var(--primary) / .14); color: hsl(var(--primary)); }
```

- [ ] **Step 4: Verify.** Update `note-toolbar.test.tsx` wherever it expected a button per stroke: it now opens the chip and picks from the list. Run the zoom tests, tsc and eslint.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/zoom/stroke-menu.tsx components/playsense-studio/studio/zoom/note-toolbar.tsx components/playsense-studio/studio/zoom/__tests__/stroke-menu.test.tsx components/playsense-studio/studio/zoom/__tests__/note-toolbar.test.tsx app/globals.css
git commit -m "Pick drum strokes from one chip instead of a grid of buttons"
```

---

### Task 10: The app bar: a Score menu and a quiet save status

Mockup app bar: `Admin / title [PlaySense Studio]` … `Preview · Score ▾ | ↶ ↷ · ● Saved · Publish`.

Live, it has these as separate chips, whose labels wrap at 1280 px:
- Add score
- Replace score
- History
- Export
- Autosave
- a "Save now" button

**Changes:**
- **A Score ▾ menu** holds Add measures from a file, Replace this section's score, and Export.
- **History** stays as an icon button (`st-iconbtn`), because it's used often.
- **"Save now" goes.** Autosave already runs, and ⌘S still flushes. The status is a pip plus text:
  - `Saved` (ok pip)
  - `Saving…` (warn pip)
  - `Save failed · Retry` (bad pip, where Retry is a button calling `draft.flush()`)

**Files:**
- Create: `components/playsense-studio/studio/score-menu.tsx`
- Modify: `components/playsense-studio/studio/score-section-editor.tsx`: the app-bar portal ~:171-240
- Modify: `components/playsense-studio/studio/sync-panel.tsx`: the "Add score" trigger's `className` becomes `st-mpop-item`, and its label is always visible as "Add measures from a file"
- Modify: `components/playsense-studio/history/history-panel.tsx` or wherever `HistoryPanel` renders its trigger (check with `grep -rn "export function HistoryPanel" components`): add an `iconOnly?: boolean` prop that renders the trigger as `st-iconbtn` with `aria-label="History"`
- Test: `components/playsense-studio/studio/__tests__/score-menu.test.tsx` (create)

**Interfaces:**
- Produces: `ScoreMenu({ children }: { children: ReactNode })`: a `Score ▾` chip whose panel holds `children` (the dialog triggers). The panel stays **mounted** and toggles `hidden`, so a Radix dialog opened from an item survives the menu closing.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScoreMenu } from '../score-menu';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('ScoreMenu', () => {
  it('is one Score chip whose items stay mounted while hidden', () => {
    act(() => root.render(<ScoreMenu><button className="st-mpop-item">Export…</button></ScoreMenu>));
    const chip = host.querySelector('[aria-label="Score"]') as HTMLButtonElement;
    const panel = host.querySelector('[role="menu"]') as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(panel.textContent).toContain('Export…'); // mounted while hidden
    act(() => chip.click());
    expect(panel.hidden).toBe(false);
    act(() => (panel.querySelector('button') as HTMLButtonElement).click());
    expect(panel.hidden).toBe(true); // choosing an item closes the menu
  });
});
```

- [ ] **Step 2: Run it and check that it fails.**

- [ ] **Step 3: Implement**

```tsx
'use client';
// PlaySense Studio — the app bar's Score ▾ menu (mockup #scoreMenu): add
// measures from a file, replace the score, export. The items are dialog
// triggers, so the panel stays mounted and only hides — unmounting it would
// unmount a dialog the item just opened.
import { ChevronDown, FileUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="st-chip" aria-label="Score" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <FileUp className="h-4 w-4" />Score<ChevronDown className="h-3.5 w-3.5" />
      </button>
      <div role="menu" hidden={!open} className="st-mpop right-0 top-[calc(100%+6px)]" onClickCapture={() => setOpen(false)}>
        {children}
      </div>
    </div>
  );
}
```

In `score-section-editor.tsx`, the portal becomes:
1. `<ScoreMenu>` containing:
   - the `scoreActionsEl` span (SyncPanel's Add score item portals into it)
   - the Replace `ScoreImportDialog`, with trigger `<button type="button" className="st-mpop-item">Replace this section's score…</button>`
   - the `ExportDialog`, with trigger `<button type="button" className="st-mpop-item">Export PDF, MusicXML or MIDI…</button>`
2. `<HistoryPanel owner={…} iconOnly />`
3. `<span className="st-divline" />`
4. undo and redo, with `className="st-iconbtn"`
5. the status:

   ```tsx
   <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
     <span className={`st-pip${draft.saveState === 'error' ? ' bad' : draft.pending || draft.saveState === 'saving' ? ' warn' : ''}`} style={{ width: 6, height: 6 }} />
     {draft.saveState === 'error' ? <>Save failed · <button type="button" className="underline" onClick={() => void draft.flush()}>Retry</button></>
       : draft.pending || draft.saveState === 'saving' ? 'Saving…' : 'Saved'}
   </span>
   ```

6. Delete the "Save now" button.

- [ ] **Step 4: Verify:** the Studio tests (update any test that clicked "Save now" or looked up "Replace score"/"Export" chips; search `grep -rn "Save now\|Replace score\|'Export'" components/playsense-studio --include=*.test.tsx`), then tsc and eslint.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/studio/score-menu.tsx components/playsense-studio/studio/__tests__/score-menu.test.tsx components/playsense-studio/studio/score-section-editor.tsx components/playsense-studio/studio/sync-panel.tsx <history-panel file>
git commit -m "Fold the score actions into a Score menu and show a quiet save status"
```

---

### Task 11: Roadmap, and a side-by-side check against the mockup

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1: Screenshot the mockup** in its three lesson types (the mockup's banner switches Video / Exercise / Jam):

`node docs/superpowers/specs/assets/studio-mockup-shot.mjs "file://$PWD/docs/superpowers/specs/assets/studio-mockup-v6.html" /tmp/mock-video.png`

- [ ] **Step 2: Add "### Studio layout pass — done <date>"** to the roadmap. Record:
  - what moved where (the table at the top of this plan)
  - the rulings:
    - no magnet toggle
    - Add at end only in the corner
    - History stays an icon
    - Save now is removed (⌘S remains)
    - the footer clears the floating video
  - the browser checklist:
    1. Open a 7-minute video lesson's section. It opens fitted to the section, with notes drawn.
    2. Play. The view pages along. Seek from the bottom bar, and the view jumps there.
    3. There's no row between the waveform and the staff. The tools float at the waveform's top right. Placement is in Sync status.
    4. Select a bar. It's outlined, its header is tinted, its waveform span is tinted, and the labelled measure bar shows. The footer hint changes.
    5. Open the zoom on a drum part. The staff is white and fills the height. The toolbar sits in the header. Strokes are one chip.
    6. Check it at 1280 × 800. Nothing wraps in the app bar, and the zoom header wraps its toolbar under the title.
    7. The student lesson player's transport is unchanged.
- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md
git commit -m "Record the Studio layout pass in the roadmap"
```
