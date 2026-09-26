# Studio rework P3a — shell and measure strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the PlaySense Studio's frame and its measure strip for every lesson type, following the approved v6 prototype. This covers:
- a hover side rail and a floating video
- a resizable waveform
- measure selection that never changes notes
- beat counts per bar
- a floating measure bar with repeat, gap-insert and bar-property menus
- section dragging
- event-id integrity
- a continuous staff

**Architecture:** The Studio keeps its architecture: `StudioWorkspace` / `VideoSectionsWorkspace` wrap `SyncPanel`, which wraps `IntegratedEditor` and `EditableMeasureStrip`, and `useEditor` holds the reducer. This plan changes the pieces in place, in five parts:
- **Shell components.** The new ones (`HoverRail`, `FloatingVideo`, `StageSplitter`) live under `components/playsense-studio/studio/shell/` and take over from the fixed side columns.
- **Pure logic.** Selection, fill and clamp rules live in small `lib/playsense-studio/*.ts` modules with unit tests.
- **Measure menus.** These are components under `components/playsense-studio/studio/measure/`. Their actions go through the existing reducer and `studioDispatch`, so timing and repeat propagation keep working.
- **Measure zoom and note editing.** These come in Plan 3b. The existing note toolbar stays in place until then.
- **Draft and publish.** This is Plan 6, so the app-bar Publish button is not built here.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 3 with the `.st-*` classes in `app/globals.css`, lucide-react, VexFlow 5, and vitest with jsdom. There's no testing-library: tests use `createRoot` + `act` from `react`.

**Spec:** `docs/superpowers/specs/2026-09-23-playsense-studio-rework-design.md` (§6 Studio UX, §2 decisions). The prototype of record is v6: https://claude.ai/artifact/Nr2Mc37Kv1oMYxxUZvYd11. The roadmap is `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md` (Plan 3).

## Global Constraints

- **Hover rail** (spec §6):
  - 52 px when collapsed, 340 px when open (a 52 px icon column plus a 288 px body).
  - Opens on `mouseenter` straight away, animating width over 120 ms with `cubic-bezier(.2,.8,.2,1)`. Closes 180 ms after `mouseleave`, but stays open while a non-button field inside it has focus.
  - Floats over the stage; the stage never moves.
- **Floating video:** 236 px wide at 16:9, dragged by its top bar, and shrinks to a pill. The default position is 26 px from the right, bottom-anchored. Its top edge is clamped to ≥ 8 px.
- **Splitter:** the waveform height ranges from 110 to 360 px, with a default of 180 px. Double-click resets it.
- **Wheel:** vertical scrolling zooms around the pointer; horizontal scrolling or ⇧ pans. `pps` is clamped to [8, 600]. The existing wheel code already does this, so keep it.
- **Clicks in the strip never add, remove or change notes** (spec §6). Selecting a note is allowed. Pitch drag on a note stays until Plan 3b moves it into the measure zoom.
- Only voice 1 is hit-tested, selected or graded. Voice 2 is for display only.
- **Timing drags** (moving a bar in time) live on the waveform's amber number chips. The strip's grab-band time drag and its edge drags are removed, because a drag across bars in the strip now selects them.
- **Per-viewer UI settings** go in `localStorage`: the PiP position and pill state, and the splitter height. Wrap every read and write in `try/catch`, and render correctly without them. Server render uses the defaults, and stored values are applied in an effect, which avoids hydration mismatches.
- `prefers-reduced-motion: reduce` makes every new transition and animation instant.
- Every lesson shell is covered:
  - `StudioWorkspace`: video, exercise and song modes
  - `VideoSectionsWorkspace`, via `ScoreSectionEditor`: video lessons and the exercise Watch part
- **Component tests:**
  - add `// @vitest-environment jsdom` at the top
  - `globalThis.IS_REACT_ACT_ENVIRONMENT = true`
  - mount with `createRoot` inside `act`
  - fake pointer events as `new MouseEvent(type, {bubbles:true, clientX, clientY})` with `Object.defineProperty(e, 'pointerId', {value: 1})`
  - stub `ResizeObserver` and `Element.prototype.setPointerCapture/releasePointerCapture`
  - stub `HTMLElement.prototype.clientWidth` where layout matters
  - for VexFlow, reuse the canvas `measureText` stub from `lib/playsense-studio/__tests__/notation-build-measure.test.ts`
- **Running tests:** use `npx vitest run <path> --exclude '.worktrees/**'`. Type-check with `npx tsc --noEmit -p .`.
- **Commits:** an imperative sentence with no prefix, followed by a blank line and `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never use `git stash`, because the stash stack is shared with other sessions.
- **Copy:** use the exact strings given in each task. Use the curly apostrophe (’) in user-facing text where the surrounding code already does.

## Review Focus

1. **Opening an old score must not save it by itself.** `ensureEventIds` runs when the score opens, but the document must stay clean: `isDirty` false, and no autosave. Task 13 pins this.
2. **A selection that points past the end after a delete or undo is clamped, never left dangling.** For example, select m.5–6, delete m.4–6, then undo. Task 5 pins this.
3. **Keys pressed while typing in a rail field** (the Score title or the tempo) never trigger measure shortcuts. Deleting text in the title must not delete measures. Task 11 pins this.
4. **Clearing or editing one pass of a repeat reaches every pass, and never splits the group.** Task 7 pins this.
5. **Dragging a section into a neighbouring section stops at the neighbour's edge.** It must also never drag before 0 s or past the end of the video. Task 12 pins this.

---

## File map

| File | Responsibility |
|---|---|
| `components/playsense-studio/sync/reference-monitor.tsx`, `sync/scroll-bar.tsx`, `sync/zoom-slider.tsx`, `studio/note-details.tsx` | helpers moved out of `sync-panel.tsx` (Task 1) |
| `components/playsense-studio/studio/shell/hover-rail.tsx` | the 52↔340 px hover rail (Task 2) |
| `components/playsense-studio/studio/shell/floating-video.tsx` | the draggable PiP that hosts the reference monitor (Task 3) |
| `components/playsense-studio/studio/shell/stage-splitter.tsx` | the waveform/strip splitter (Task 4) |
| `lib/playsense-studio/measure-selection.ts` | pure bar-selection rules (Task 5) |
| `lib/playsense-studio/measure-fill.ts` | beats used per bar, and the issue list (Task 6) |
| `lib/playsense-studio/editor-state.ts` | new actions: `clear-measures`, `set-measure-props`, `duplicate-measures`, `set-tempo-marks-confirmed` (Tasks 7 and 10) |
| `components/playsense-studio/studio/measure/repeat-lane.tsx`, `repeat-popover.tsx` | the repeat lane and its menu (Task 8) |
| `components/playsense-studio/studio/measure/gap-menu.tsx` | the "+" menu (Task 9) |
| `components/playsense-studio/studio/measure/bar-popover.tsx`, `lib/playsense-studio/tempo-marks.ts` | the Bar ▾ menu and tempo marks (Task 10) |
| `components/playsense-studio/studio/measure/measure-bar.tsx`, `use-measure-keys.ts` | the floating measure bar and bar-level keys (Task 11) |
| `lib/playsense-studio/section-drag.ts` | the section shift clamp (Task 12) |
| `lib/playsense-studio/event-ids.ts` | id integrity: new ids, re-id on copy, span pruning (Task 13) |
| `components/playsense-studio/studio/continuous-staff.tsx`, `lib/playsense-studio/render-window.ts` | one SVG staff over the visible range (Task 14) |

---

### Task 1: Move sync-panel's helper components into their own files

`sync-panel.tsx` is 1,809 lines. Later tasks edit it, so its self-contained helpers move out first. This is a pure move: no behaviour changes.

**Files:**
- Create: `components/playsense-studio/sync/reference-monitor.tsx`, `components/playsense-studio/sync/scroll-bar.tsx`, `components/playsense-studio/sync/zoom-slider.tsx`, `components/playsense-studio/studio/note-details.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (the helper section at the bottom, from `function ReferenceMonitor` to the end of the file)

**Interfaces — Produces:**
- `ReferenceMonitor`, `ScrollBar`, `ZoomSlider` and `NoteDetails` are exported under their current names, with unchanged props.
- If a small helper (`clamp`, `formatTime`, the format helpers) is used both by a moved component and by `SyncPanel`, export it from the new file that needs it most and import it in the other. Never duplicate it.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**' 2>&1 | tail -3`, and note the pass count.

- [ ] **Step 2: Move the code**
  - Cut each helper from `sync-panel.tsx` verbatim into its new file, with its imports: `ReferenceMonitor`, then `formatTime`/`NoteTimingProps`/`NoteDetails` plus the format helpers only they use, then `ScrollBar`, then `ZoomSlider`.
  - Add `'use client';` at the top of each new file, and a one-line header comment in the style of the file it came from.
  - Export each component, and import them back into `sync-panel.tsx`.
  - Don't change any JSX, class names or logic.

- [ ] **Step 3: Verify**

Run:
- `npx tsc --noEmit -p .` must be clean.
- The Step 1 command must give the same pass count.
- `wc -l components/playsense-studio/studio/sync-panel.tsx` should be about 330 lines shorter.
- `grep -n "^function \(ReferenceMonitor\|ScrollBar\|ZoomSlider\|NoteDetails\)" components/playsense-studio/studio/sync-panel.tsx` must print nothing.

- [ ] **Step 4: Commit**

```bash
git add components/playsense-studio/sync components/playsense-studio/studio/sync-panel.tsx components/playsense-studio/studio/note-details.tsx
git commit -m "Move the sync panel's monitor, scrollbar, zoom slider and note details into their own files"
```

---

### Task 2: Hover rail replaces the fixed side columns

**Files:**
- Create: `components/playsense-studio/studio/shell/hover-rail.tsx`
- Test: `components/playsense-studio/studio/shell/__tests__/hover-rail.test.tsx`
- Modify: `app/globals.css` (add the `.st-work`/`.st-hrail*` rules after the `.st-rail-right` rule, about line 346, and change `.st-transport`'s `min-height: 70px` to `min-height: 54px`)
- Modify: `app/admin/playsense-studio/[classItemId]/studio-workspace.tsx` (the body: `<div className="flex min-h-0 flex-1">` plus its `<aside className="st-rail st-rail-left …">`)
- Modify: `app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx` (the body `<div className="flex min-h-0 flex-1">` plus its `<aside className="st-rail st-rail-left hidden w-72 …">`)

**Interfaces — Produces:**

```ts
export type RailBadge = 'ok' | 'warn' | 'bad';
export interface RailSection { id: string; label: string; icon: LucideIcon; badge?: RailBadge | null; content: ReactNode }
export const RAIL_CLOSE_DELAY_MS = 180;
export function HoverRail(props: { sections: RailSection[] }): JSX.Element
```

The section bodies stay mounted while the rail is collapsed. That keeps portal slots inside them working: SyncPanel portals into `inspectorEl`, `metaEl` and `monitorEl`.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Music, Activity } from 'lucide-react';
import { HoverRail, RAIL_CLOSE_DELAY_MS } from '../hover-rail';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <HoverRail
        sections={[
          { id: 'score', label: 'Score', icon: Music, content: <input aria-label="Title" /> },
          { id: 'sync', label: 'Sync status', icon: Activity, badge: 'warn', content: <p>ok</p> },
        ]}
      />
    );
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

const rail = () => host.querySelector('.st-hrail') as HTMLElement;
const enter = () => act(() => { rail().dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })); });
const leave = () => act(() => { rail().dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })); });

describe('HoverRail', () => {
  it('opens as soon as the pointer enters', () => {
    enter();
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('closes only after the close delay', () => {
    enter(); leave();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS - 10); });
    expect(rail().classList.contains('is-open')).toBe(true);
    act(() => { vi.advanceTimersByTime(20); });
    expect(rail().classList.contains('is-open')).toBe(false);
  });
  it('re-entering cancels a pending close', () => {
    enter(); leave(); enter();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS + 50); });
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('stays open while a field inside it has focus', () => {
    enter();
    const input = host.querySelector('input') as HTMLInputElement;
    act(() => { input.focus(); });
    leave();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS + 50); });
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('an icon click opens the rail and scrolls to its section', () => {
    const btn = host.querySelector('button[aria-label="Sync status"]') as HTMLButtonElement;
    act(() => { btn.click(); });
    expect(rail().classList.contains('is-open')).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
  it('shows the badge dot and keeps collapsed bodies mounted', () => {
    expect(host.querySelector('.st-hrail-dot.is-warn')).not.toBeNull();
    expect(host.querySelector('#st-rail-score input')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run components/playsense-studio/studio/shell --exclude '.worktrees/**'`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `hover-rail.tsx`**

```tsx
'use client';

// PlaySense Studio — hover rail. A 52 px icon strip that opens to 340 px over
// the stage the moment the pointer arrives and closes 180 ms after it leaves
// (the stage never moves). Section bodies stay mounted while collapsed so the
// portal slots inside them (inspector, score meta, monitor) keep working.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RailBadge = 'ok' | 'warn' | 'bad';

export interface RailSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: RailBadge | null;
  content: ReactNode;
}

export const RAIL_CLOSE_DELAY_MS = 180;

export function HoverRail({ sections }: { sections: RailSection[] }) {
  const [open, setOpen] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => cancelClose, []);

  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      // Typing in a rail field keeps it open after the pointer leaves.
      const active = document.activeElement;
      if (active && railRef.current?.contains(active) && !(active instanceof HTMLButtonElement)) return;
      setOpen(false);
    }, RAIL_CLOSE_DELAY_MS);
  };
  const goTo = (id: string) => {
    openNow();
    document.getElementById(`st-rail-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside
      ref={railRef}
      className={cn('st-hrail', open && 'is-open')}
      aria-label="Studio panels"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={(e) => {
        if (!railRef.current?.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <nav className="st-hrail-icons">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" className="st-hrail-icon" title={s.label} aria-label={s.label} onClick={() => goTo(s.id)}>
              <Icon className="h-[18px] w-[18px]" />
              {s.badge && <span className={cn('st-hrail-dot', `is-${s.badge}`)} aria-hidden />}
            </button>
          );
        })}
      </nav>
      <div className="st-hrail-body">
        {sections.map((s) => (
          <section key={s.id} id={`st-rail-${s.id}`} className="st-hrail-sec">
            <span className="st-sec-label">{s.label}</span>
            <div className="mt-3">{s.content}</div>
          </section>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Add the CSS** (in `app/globals.css`, after `.st-rail-right`)

```css
/* Studio work area: reserves the collapsed rail's 52 px; the open rail floats over the stage. */
.st-work { position: relative; display: flex; flex: 1 1 0%; min-height: 0; padding-left: 52px; }
.st-hrail {
  position: absolute; left: 0; top: 0; bottom: 0; z-index: 40;
  display: flex; width: 52px; overflow: hidden;
  background: color-mix(in srgb, hsl(var(--card)) 92%, hsl(var(--background)));
  border-right: 1px solid hsl(var(--border));
  transition: width .12s cubic-bezier(.2,.8,.2,1), box-shadow .12s;
}
.st-hrail.is-open { width: 340px; box-shadow: 24px 0 60px rgba(0,0,0,.55); }
.st-hrail-icons { flex: 0 0 52px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; }
.st-hrail-icon {
  position: relative; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px;
  color: hsl(var(--muted-foreground));
}
.st-hrail-icon:hover, .st-hrail-icon:focus-visible { background: hsl(var(--muted)); color: hsl(var(--foreground)); outline: none; }
.st-hrail-dot { position: absolute; top: 6px; right: 6px; width: 7px; height: 7px; border-radius: 999px; }
.st-hrail-dot.is-ok { background: hsl(var(--success)); }
.st-hrail-dot.is-warn { background: hsl(var(--gold-highlight)); }
.st-hrail-dot.is-bad { background: hsl(var(--destructive)); }
.st-hrail-body {
  flex: 0 0 288px; width: 288px; overflow-y: auto; padding: 14px 16px 24px;
  opacity: 0; transform: translateX(-8px);
  transition: opacity .1s, transform .12s cubic-bezier(.2,.8,.2,1);
}
.st-hrail.is-open .st-hrail-body { opacity: 1; transform: none; }
.st-hrail-sec + .st-hrail-sec { margin-top: 16px; padding-top: 16px; border-top: 1px solid hsl(var(--border)); }
@media (prefers-reduced-motion: reduce) { .st-hrail, .st-hrail-body { transition: none; } }
```

Also in `.st-transport`, change `min-height: 70px;` to `min-height: 54px;` and `padding: 10px 18px;` to `padding: 8px 18px;`. The spec calls for a one-row transport of 54 px.

- [ ] **Step 5: Use the rail in `StudioWorkspace`**

Replace the body wrapper and its `<aside …>…</aside>` with:

```tsx
<div className="st-work">
  <HoverRail
    sections={[
      { id: 'score', label: 'Score', icon: Music, content: <ScoreMetaEditor score={state.score} dispatch={dispatch} /> },
      ...(isExercise && exerciseMedia && owner.kind === 'classItem'
        ? [{
            id: 'media', label: 'Play-along media', icon: MonitorPlay,
            content: (
              <ExerciseMediaPanel
                classItemId={owner.classItemId}
                scoreLengthSeconds={scoreLengthSeconds}
                initialMedia={exerciseMedia}
                hasTimeMap={!!exerciseTimeMap}
                onVideoChange={handleExerciseVideoChange}
              />
            ),
          }]
        : []),
      { id: 'sync', label: 'Sync status', icon: Activity, content: <div ref={setInspectorEl} className="flex flex-col gap-3" /> },
    ]}
  />
  <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
    {/* …the existing <main> children, unchanged… */}
  </main>
</div>
```

Import `HoverRail` from `@/components/playsense-studio/studio/shell/hover-rail`. Import `Music`, `MonitorPlay` and `Activity` from `lucide-react`, merging them into the existing lucide import.

- [ ] **Step 6: Use the rail in `VideoSectionsWorkspace`**

Replace the body wrapper and its `<aside>` in the same way, with these sections, in order:
1. `{ id: 'video', label: 'Reference video', icon: MonitorPlay, content: <div ref={setMonitorEl} /> }`. This is temporary: Task 3 moves the monitor into the floating video and deletes this section.
2. `{ id: 'sections', label: 'Scored sections', icon: Rows3, content: <>…the existing sections block, from the "New section" button through the list…</> }`. Keep that block's JSX as it is, but drop its own `st-sec-label` header row, since the rail adds the label. Keep the count: render `<span className="font-mono text-xs text-muted-foreground">{sections.length}</span>` at the top of the content.
3. When `selected`: `{ id: 'score', label: 'Score', icon: Music, content: <div ref={setMetaEl} /> }`.
4. When `selected`: `{ id: 'sync', label: 'Sync status', icon: Activity, content: <div ref={setInspectorEl} className="flex flex-col gap-3" /> }`.

The `<main>` follows unchanged inside `<div className="st-work">`.

- [ ] **Step 7: Run the tests, type-check and commit**

Run:
- `npx vitest run components/playsense-studio/studio/shell --exclude '.worktrees/**'`: PASS
- `npx tsc --noEmit -p .`: clean
- `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**'`: PASS

```bash
git add components/playsense-studio/studio/shell app/globals.css "app/admin/playsense-studio/[classItemId]/studio-workspace.tsx" "app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx"
git commit -m "Replace the Studio's fixed side columns with a hover rail over the stage"
```

---

### Task 3: Floating video

**Files:**
- Create: `components/playsense-studio/studio/shell/floating-video.tsx`
- Test: `components/playsense-studio/studio/shell/__tests__/floating-video.test.tsx`
- Modify: `app/globals.css` (add the `.st-pip*` rules after the `.st-hrail` rules)
- Modify: `video-sections-workspace.tsx` (delete the temporary `video` rail section; render `FloatingVideo` inside `.st-work`)
- Modify: `studio-workspace.tsx` (render `FloatingVideo` when there's a video, and pass `monitorEl` to both `SyncPanel` calls)

**Interfaces — Produces:**

```ts
export interface PipPlacement { right: number; top: number; minimized: boolean }
export const PIP_WIDTH = 236;
export function clampPip(p: PipPlacement, box: { width: number; height: number }): PipPlacement
export function FloatingVideo(props: { label: string; onBodyEl: (el: HTMLDivElement | null) => void }): JSX.Element
```

SyncPanel already renders `ReferenceMonitor` into `monitorEl` when it's given one: see the `ReferenceMonitor` portal, and the inspector fallback that is used only when `monitorEl` is absent. The PiP body is that slot.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingVideo, clampPip, PIP_WIDTH } from '../floating-video';

describe('clampPip', () => {
  const box = { width: 1000, height: 600 };
  it('keeps the top at least 8 px from the top edge', () => {
    expect(clampPip({ right: 26, top: -40, minimized: false }, box).top).toBe(8);
  });
  it('keeps the whole video inside the box', () => {
    const p = clampPip({ right: -50, top: 900, minimized: false }, box);
    expect(p.right).toBe(8);
    expect(p.top).toBe(600 - 170);
    expect(clampPip({ right: 5000, top: 20, minimized: false }, box).right).toBe(1000 - PIP_WIDTH - 8);
  });
  it('a pill can sit lower than the full video', () => {
    expect(clampPip({ right: 26, top: 900, minimized: true }, box).top).toBe(600 - 60);
  });
});

describe('FloatingVideo', () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 600 });
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<FloatingVideo label="Reference" onBodyEl={() => {}} />); });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });
  const pip = () => host.querySelector('.st-pip') as HTMLElement;
  const ptr = (el: Element, type: string, x: number, y: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    act(() => { el.dispatchEvent(e); });
  };

  it('starts bottom-right', () => {
    expect(pip().style.right).toBe('26px');
    expect(pip().style.top).toBe(`${600 - 170}px`);
  });
  it('drags by its bar', () => {
    const bar = host.querySelector('.st-pip-bar') as HTMLElement;
    ptr(bar, 'pointerdown', 500, 450);
    ptr(bar, 'pointermove', 460, 400);
    ptr(bar, 'pointerup', 460, 400);
    expect(pip().style.right).toBe('66px');
    expect(pip().style.top).toBe(`${600 - 170 - 50}px`);
  });
  it('shrinks to a pill and keeps the video mounted', () => {
    act(() => { (host.querySelector('button[title="Shrink to a pill"]') as HTMLButtonElement).click(); });
    expect(pip().classList.contains('is-min')).toBe(true);
    expect(host.querySelector('.st-pip-body')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run components/playsense-studio/studio/shell --exclude '.worktrees/**'`. Expected: FAIL.

- [ ] **Step 3: Implement `floating-video.tsx`**

```tsx
'use client';

// PlaySense Studio — floating reference video. Dragged by its top bar, shrinks
// to a pill, and remembers where this viewer left it. Its body is the portal
// slot SyncPanel renders the reference monitor into (monitorEl); the video stays
// mounted as a pill because it is the playback clock.

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipPlacement { right: number; top: number; minimized: boolean }

export const PIP_WIDTH = 236;
const FULL_H = 170;
const PILL_H = 60;
const STORAGE_KEY = 'playsense-studio:pip';

export function clampPip(p: PipPlacement, box: { width: number; height: number }): PipPlacement {
  const h = p.minimized ? PILL_H : FULL_H;
  return {
    minimized: p.minimized,
    right: Math.max(8, Math.min(p.right, box.width - PIP_WIDTH - 8)),
    top: Math.max(8, Math.min(p.top, box.height - h)),
  };
}

export function FloatingVideo({ label, onBodyEl }: { label: string; onBodyEl: (el: HTMLDivElement | null) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<PipPlacement | null>(null);
  const drag = useRef<{ x: number; y: number; start: PipPlacement } | null>(null);

  const box = () => {
    const parent = ref.current?.parentElement;
    return { width: parent?.clientWidth ?? 1000, height: parent?.clientHeight ?? 600 };
  };

  // Default bottom-right, then any stored placement (client only).
  useEffect(() => {
    const b = box();
    let next: PipPlacement = { right: 26, top: b.height - FULL_H, minimized: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) next = { ...next, ...(JSON.parse(raw) as Partial<PipPlacement>) };
    } catch { /* storage unavailable */ }
    setPlace(clampPip(next, b));
  }, []);

  const save = (p: PipPlacement) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
  };

  const onDown = (e: React.PointerEvent) => {
    if (!place || (e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: place };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPlace(clampPip({ ...d.start, right: d.start.right - (e.clientX - d.x), top: d.start.top + (e.clientY - d.y) }, box()));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (place) save(place);
  };
  const toggle = () => {
    if (!place) return;
    const next = clampPip({ ...place, minimized: !place.minimized }, box());
    setPlace(next);
    save(next);
  };

  return (
    <div
      ref={ref}
      className={cn('st-pip', place?.minimized && 'is-min')}
      style={place ? { right: place.right, top: place.top } : { right: 26, bottom: 26 }}
    >
      <div className="st-pip-bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="st-pip-rec" aria-hidden />
        <span className="truncate">{label}</span>
        <button
          type="button"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
          title={place?.minimized ? 'Show video' : 'Shrink to a pill'}
          aria-label={place?.minimized ? 'Show video' : 'Shrink to a pill'}
          onClick={toggle}
        >
          {place?.minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div ref={onBodyEl} className="st-pip-body" />
    </div>
  );
}
```

- [ ] **Step 4: Add the CSS**

```css
.st-pip {
  position: absolute; z-index: 30; width: 236px; overflow: hidden; border-radius: 12px;
  background: #000; border: 1px solid hsl(0 0% 100% / .14); box-shadow: 0 16px 40px rgba(0,0,0,.6);
  transition: width .2s cubic-bezier(.2,.8,.2,1);
}
.st-pip.is-min { width: auto; min-width: 150px; }
.st-pip-bar {
  position: absolute; inset: 0 0 auto 0; z-index: 2; display: flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 6px 0 10px; font-size: 11px; color: #fff; cursor: grab; touch-action: none;
  background: linear-gradient(rgba(0,0,0,.65), transparent); opacity: 0; transition: opacity .15s;
}
.st-pip:hover .st-pip-bar, .st-pip.is-min .st-pip-bar { opacity: 1; }
.st-pip.is-min .st-pip-bar { position: static; background: hsl(var(--card)); }
.st-pip-rec { width: 7px; height: 7px; border-radius: 999px; background: hsl(0 72% 60%); }
.st-pip-body { aspect-ratio: 16 / 9; }
.st-pip-body video { display: block; width: 100%; height: 100%; }
.st-pip.is-min .st-pip-body { height: 0; aspect-ratio: auto; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .st-pip, .st-pip-bar { transition: none; } }
```

Check that `ReferenceMonitor`'s markup (now in `sync/reference-monitor.tsx`) fills the body. If it wraps the `<video>` in a card with its own padding or border, drop that wrapper's padding/border classes only when it's rendered into the PiP. Add a `bare` prop to `ReferenceMonitor`, and have SyncPanel pass `bare` whenever it portals into `monitorEl`.

- [ ] **Step 5: Wire the workspaces**
  - **`VideoSectionsWorkspace`:**
    - Remove the temporary `video` rail section.
    - Inside `.st-work`, after `<main>`, render `{videoUrl && <FloatingVideo label="Reference" onBodyEl={setMonitorEl} />}`.
    - Keep the `setMonitorEl` state that already exists.
  - **`StudioWorkspace`:**
    - Add `const [monitorEl, setMonitorEl] = useState<HTMLDivElement | null>(null);`.
    - Inside `.st-work`, render `{(showExerciseSync ? exerciseVideoUrl : videoUrl) && <FloatingVideo label={isExercise ? 'Play-along' : 'Reference'} onBodyEl={setMonitorEl} />}`.
    - Pass `monitorEl={monitorEl}` to both `SyncPanel` calls.
  - Songs, which have no video, get no PiP.

- [ ] **Step 6: Test, type-check and commit**

Run the shell tests, `npx tsc --noEmit -p .`, and `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**'`: all PASS.

```bash
git add components/playsense-studio app/globals.css "app/admin/playsense-studio/[classItemId]"
git commit -m "Float the reference video over the stage and let it shrink to a pill"
```

---

### Task 4: Resizable waveform

**Files:**
- Create: `components/playsense-studio/studio/shell/stage-splitter.tsx`
- Test: `components/playsense-studio/studio/shell/__tests__/stage-splitter.test.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`:
  - `const WAVE_H = 240` (line 106)
  - its two uses (`height={WAVE_H}` on `WaveformCanvas`, and `style={{ height: WAVE_H }}` on `.st-wave-empty`)
  - the stage JSX between the `.st-wave-lane` div and the notation (`IntegratedEditor`) block
- Modify: `app/globals.css` (add the `.st-splitter` rules)

**Interfaces — Produces:**

```ts
export const WAVE_MIN = 110, WAVE_MAX = 360, WAVE_DEFAULT = 180;
export function clampWaveHeight(h: number): number
export function StageSplitter(props: { height: number; onChange: (h: number) => void }): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StageSplitter, clampWaveHeight, WAVE_DEFAULT, WAVE_MAX, WAVE_MIN } from '../stage-splitter';

describe('clampWaveHeight', () => {
  it('clamps to 110–360', () => {
    expect(clampWaveHeight(20)).toBe(WAVE_MIN);
    expect(clampWaveHeight(999)).toBe(WAVE_MAX);
    expect(clampWaveHeight(200)).toBe(200);
  });
});

describe('StageSplitter', () => {
  let host: HTMLDivElement; let root: Root; const onChange = vi.fn();
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    onChange.mockReset();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    act(() => { root.render(<StageSplitter height={180} onChange={onChange} />); });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const ptr = (type: string, y: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    act(() => { host.querySelector('.st-splitter')!.dispatchEvent(e); });
  };
  it('drags the waveform taller, clamped', () => {
    ptr('pointerdown', 300); ptr('pointermove', 340);
    expect(onChange).toHaveBeenLastCalledWith(220);
    ptr('pointermove', 900);
    expect(onChange).toHaveBeenLastCalledWith(WAVE_MAX);
    ptr('pointerup', 900);
  });
  it('double-click resets', () => {
    act(() => { host.querySelector('.st-splitter')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(onChange).toHaveBeenLastCalledWith(WAVE_DEFAULT);
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `stage-splitter.tsx`**

```tsx
'use client';

// PlaySense Studio — the splitter between the waveform and the measure strip.
// Drag to trade height between them; double-click resets.

import { useRef } from 'react';

export const WAVE_MIN = 110;
export const WAVE_MAX = 360;
export const WAVE_DEFAULT = 180;

export function clampWaveHeight(h: number): number {
  return Math.max(WAVE_MIN, Math.min(WAVE_MAX, Math.round(h)));
}

export function StageSplitter({ height, onChange }: { height: number; onChange: (h: number) => void }) {
  const drag = useRef<{ y: number; h: number } | null>(null);
  return (
    <div
      className="st-splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-valuemin={WAVE_MIN}
      aria-valuemax={WAVE_MAX}
      aria-valuenow={height}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, h: height };
      }}
      onPointerMove={(e) => {
        if (drag.current) onChange(clampWaveHeight(drag.current.h + e.clientY - drag.current.y));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }}
      onDoubleClick={() => onChange(WAVE_DEFAULT)}
    >
      <span className="st-splitter-grip" />
    </div>
  );
}
```

CSS:

```css
.st-splitter { position: relative; flex: 0 0 9px; cursor: row-resize; touch-action: none; }
.st-splitter-grip {
  position: absolute; left: 50%; top: 3px; width: 36px; height: 3px; margin-left: -18px; border-radius: 999px;
  background: hsl(var(--border)); transition: width .12s, margin-left .12s, background .12s;
}
.st-splitter:hover .st-splitter-grip { width: 56px; margin-left: -28px; background: hsl(var(--primary)); }
```

- [ ] **Step 4: Wire it into SyncPanel**
  - Delete `const WAVE_H = 240;`.
  - Inside the component, add:
    ```ts
    const [waveH, setWaveH] = useState(WAVE_DEFAULT);
    useEffect(() => {
      try {
        const raw = localStorage.getItem('playsense-studio:wave-height');
        if (raw) setWaveH(clampWaveHeight(Number(raw)));
      } catch { /* storage unavailable */ }
    }, []);
    const changeWaveH = useCallback((h: number) => {
      setWaveH(h);
      try { localStorage.setItem('playsense-studio:wave-height', String(h)); } catch { /* storage unavailable */ }
    }, []);
    ```
  - Replace both `WAVE_H` uses with `waveH`.
  - Render `<StageSplitter height={waveH} onChange={changeWaveH} />` directly after the closing tag of the `.st-wave-lane` div, before the notation block. The strip already measures its own wrapper (`staffWrapRef` in `IntegratedEditor`), so it grows and shrinks on its own.
  - When `showSync` is false (songs), there's no waveform. Render the splitter only when `showSync`.

- [ ] **Step 5: Test, type-check and commit**

```bash
git add components/playsense-studio app/globals.css
git commit -m "Let the admin trade height between the waveform and the measure strip"
```


---

### Task 5: Bar selection that never touches notes

**Files:**
- Create: `lib/playsense-studio/measure-selection.ts`
- Test: `lib/playsense-studio/__tests__/measure-selection.test.ts`, `components/playsense-studio/studio/__tests__/strip-selection.test.tsx`
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (the `IntegratedEditor` props; the Ripple/Single toggle moves into `.st-zoom-float`)

**Interfaces — Produces:**

```ts
// lib/playsense-studio/measure-selection.ts
export interface MeasureSelection { anchor: number; focus: number }
export function selectionBounds(sel: MeasureSelection | null): [number, number] | null
export function clickSelect(sel: MeasureSelection | null, index: number, extend: boolean): MeasureSelection
export function dragSelect(anchor: number, index: number): MeasureSelection
export function stepSelection(sel: MeasureSelection | null, delta: number, extend: boolean, count: number): MeasureSelection | null
export function clampSelection(sel: MeasureSelection | null, count: number): MeasureSelection | null
export function isInSelection(sel: MeasureSelection | null, index: number): boolean
export function measureAtX(x: number, bars: Array<{ left: number; right: number }>): number | null
```

The `EditableMeasureStrip` props change:
- **Removed:** `onClickMeasureEmpty`, `insertOnClick`, `previewMidi`, `dragAll`, `onMeasureDragStart`, `onMeasureDrag`, `onMeasureDragEnd`, `onTailDrag`, `resizable`.
- **Added:** `onSelectMeasureRange: (anchor: number, focus: number) => void` and `onOpenMeasure: (index: number) => void`.
- **Kept:** `onSelectMeasure(index, extend)`, `onSelectEvent`, `onSetPitch`, `onRequestZoomTo`, `onScrollByPx`, `onWheelZoom` and the rest.

The `IntegratedEditor` props change:
- **Removed:** `dragAll`, `showDragMode`, `onSetDragAll`, `onMeasureDrag`, `onMeasureDragEnd`, `onTailDrag`.
- **Kept:** everything else.

`MeasureStripItem` itself is unchanged. Each measure `<div>` carries `data-measure-index={item.measureIndex}`.

- [ ] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  clampSelection, clickSelect, dragSelect, isInSelection, measureAtX, selectionBounds, stepSelection,
} from '../measure-selection';

describe('measure selection', () => {
  it('a click selects one bar; ⇧-click extends from the anchor', () => {
    const one = clickSelect(null, 3, false);
    expect(one).toEqual({ anchor: 3, focus: 3 });
    expect(clickSelect(one, 6, true)).toEqual({ anchor: 3, focus: 6 });
    expect(clickSelect(null, 6, true)).toEqual({ anchor: 6, focus: 6 });
  });
  it('bounds are ordered whichever way the drag went', () => {
    expect(selectionBounds(dragSelect(5, 2))).toEqual([2, 5]);
    expect(selectionBounds(null)).toBeNull();
    expect(isInSelection(dragSelect(5, 2), 4)).toBe(true);
    expect(isInSelection(dragSelect(5, 2), 6)).toBe(false);
  });
  it('arrows move or extend, staying inside the score', () => {
    expect(stepSelection(null, 1, false, 8)).toEqual({ anchor: 0, focus: 0 });
    expect(stepSelection({ anchor: 2, focus: 2 }, 1, false, 8)).toEqual({ anchor: 3, focus: 3 });
    expect(stepSelection({ anchor: 2, focus: 2 }, 1, true, 8)).toEqual({ anchor: 2, focus: 3 });
    expect(stepSelection({ anchor: 7, focus: 7 }, 1, false, 8)).toEqual({ anchor: 7, focus: 7 });
    expect(stepSelection({ anchor: 0, focus: 0 }, -1, true, 8)).toEqual({ anchor: 0, focus: 0 });
    expect(stepSelection({ anchor: 0, focus: 0 }, 1, false, 0)).toBeNull();
  });
  it('a selection past the end after a delete or undo is clamped (Review Focus 2)', () => {
    const sel = { anchor: 4, focus: 5 };
    expect(clampSelection(sel, 4)).toEqual({ anchor: 3, focus: 3 });
    expect(clampSelection(sel, 6)).toBe(sel);
    expect(clampSelection(sel, 0)).toBeNull();
  });
  it('finds the bar under x, clamping past either end', () => {
    const bars = [{ left: 0, right: 100 }, { left: 100, right: 180 }, { left: 180, right: 300 }];
    expect(measureAtX(50, bars)).toBe(0);
    expect(measureAtX(100, bars)).toBe(1);
    expect(measureAtX(-40, bars)).toBe(0);
    expect(measureAtX(900, bars)).toBe(2);
    expect(measureAtX(10, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/measure-selection.test.ts --exclude '.worktrees/**'`.

- [ ] **Step 3: Implement `measure-selection.ts`**

```ts
// PlaySense Studio — which bars are selected in the measure strip. An anchor
// (where the selection started) and a focus (the end being moved by ⇧-click,
// drag or ⇧-arrows). Pure, so the rules are tested apart from the UI.

export interface MeasureSelection { anchor: number; focus: number }

export function selectionBounds(sel: MeasureSelection | null): [number, number] | null {
  return sel ? [Math.min(sel.anchor, sel.focus), Math.max(sel.anchor, sel.focus)] : null;
}

export function clickSelect(sel: MeasureSelection | null, index: number, extend: boolean): MeasureSelection {
  return extend && sel ? { anchor: sel.anchor, focus: index } : { anchor: index, focus: index };
}

export function dragSelect(anchor: number, index: number): MeasureSelection {
  return { anchor, focus: index };
}

export function stepSelection(
  sel: MeasureSelection | null,
  delta: number,
  extend: boolean,
  count: number
): MeasureSelection | null {
  if (count <= 0) return null;
  if (!sel) return { anchor: 0, focus: 0 };
  const focus = Math.max(0, Math.min(count - 1, sel.focus + delta));
  return extend ? { anchor: sel.anchor, focus } : { anchor: focus, focus };
}

export function clampSelection(sel: MeasureSelection | null, count: number): MeasureSelection | null {
  if (!sel || count <= 0) return null;
  const anchor = Math.min(sel.anchor, count - 1);
  const focus = Math.min(sel.focus, count - 1);
  return anchor === sel.anchor && focus === sel.focus ? sel : { anchor: Math.min(anchor, focus), focus: Math.min(anchor, focus) };
}

export function isInSelection(sel: MeasureSelection | null, index: number): boolean {
  const b = selectionBounds(sel);
  return !!b && index >= b[0] && index <= b[1];
}

export function measureAtX(x: number, bars: Array<{ left: number; right: number }>): number | null {
  if (bars.length === 0) return null;
  if (x < bars[0].left) return 0;
  for (let i = 0; i < bars.length; i++) if (x >= bars[i].left && x < bars[i].right) return i;
  return bars.length - 1;
}
```

A clamped selection collapses to one bar at the new end. A range that half-survived a delete would otherwise point at unrelated bars.

- [ ] **Step 4: Change the strip's gestures** (`editable-measure-strip.tsx`)
  - **Remove the click-to-insert path.** That is `PendingEmptyInsert`, `pendingEmptyRef`, the empty-space branch in `handlePointerDown`/`handlePointerUp`, the `ghost` state and its cursor-preview JSX, and the `previewMidi` and `insertOnClick` props.
  - **Remove the time drags.** Remove the grab-band time drag (`TimeDragState`, `timeDrag`, `handleHandleDown/Move/Up/Cancel`) and the edge drags (`EdgeDragState`, `edgeDrag`, `EDGE_PX`, `handleEdgeDown/Move/Up/Cancel`, the `resizable` JSX). Also remove their props.
    - The header band stays as a plain header. Keep the measure number, the repeat text and the capacity chip, which Task 6 replaces. Drop `GripHorizontal` and the grab cursor.
  - **Drag-selection.** Add a ref `selDrag = useRef<{ pointerId: number; anchor: number; x: number } | null>(null)`.
    - A `pointerdown` on the header band, or on staff space where `hitAt` finds no note, does four things:
      1. Calls `onSelectMeasure(index, e.shiftKey)`.
      2. If not ⇧, sets `selDrag = { pointerId, anchor: index, x }`.
      3. Captures the pointer on the container.
      4. Starts a rAF loop.
    - `pointermove` updates `selDrag.x`.
    - Each frame, the loop does two things:
      - **(a) Edge auto-scroll:** if `x < 30`, call `onScrollByPx?.(-12)`; if `x > viewportWidth - 30`, call `onScrollByPx?.(12)`.
      - **(b) Track the bar under the pointer:** `const i = measureAtX(x, bars)`, where `bars = measures.map(m => ({ left: videoTimeToX(m.startVideoTimeSeconds), right: videoTimeToX(m.endVideoTimeSeconds) }))`. Keep the latest props in refs so the loop reads fresh values. When `i` changes, call `onSelectMeasureRange(anchor, i)`.
    - `pointerup` or `pointercancel` stops the loop, releases capture and clears `selDrag`.
  - **Double-click.** `onDoubleClick` on a measure `<div>` (header or staff) calls `onOpenMeasure(item.measureIndex)`. On the narrow placeholder `<button>`, a click selects (`onSelectMeasure(i, e.shiftKey)`) and a double-click calls `onOpenMeasure(i)`. It no longer zooms on a single click.
  - **Keep as they are:** note hit selection (`onSelectEvent`), the pitch drag on a note (`onSetPitch`), the playhead, the wheel, the "+" gap buttons and the repeat brackets. Task 8 replaces the brackets.
  - Add `data-measure-index` to each measure `<div>`.
  - Update the header comment at the top of the file so it describes the new model: a click selects a bar, a drag selects several, a double-click opens, and clicks never change notes.

- [ ] **Step 5: Wire the editor and panel**
  - **`IntegratedEditor`:**
    - Drop the `insertOnClick` state and the Select/Insert segmented control.
    - Drop the Ripple/Single block (`showDragMode && onSetDragAll && …`) and the removed props.
    - Build the selection from the new helpers: `selectMeasure = (i, extend) => { setSelected(null); setMeasureRange(prev => clickSelect(prev, i, extend)); }` and `selectMeasureRange = (a, f) => { setSelected(null); setMeasureRange(dragSelect(a, f)); }`.
    - Make `rangeStart`/`rangeEnd` come from `selectionBounds`.
    - The clamp effect uses `clampSelection(prev, measureCount)`.
  - **Opening a bar** (until Plan 3b adds the measure zoom) zooms the timeline so the bar fills 56% of the viewport:
    ```ts
    const openMeasure = useCallback((index: number) => {
      const t = measureTimings[index];
      if (!t || viewportWidth <= 0) return;
      const span = Math.max(0.05, t.endVideoTimeSeconds - t.startVideoTimeSeconds);
      const pps = Math.min(600, Math.max(8, (viewportWidth * 0.56) / span));
      const scroll = Math.max(0, t.startVideoTimeSeconds * pps - (viewportWidth - span * pps) / 2);
      setSelected(null);
      setMeasureRange({ anchor: index, focus: index });
      onRequestZoom(pps, scroll);
    }, [measureTimings, viewportWidth, onRequestZoom]);
    ```
    Pass `onSelectMeasureRange={selectMeasureRange}` and `onOpenMeasure={openMeasure}` to the strip.
  - **`SyncPanel`:**
    - Stop passing the removed props to `IntegratedEditor`.
    - Move the Ripple/Single control into the `.st-zoom-float` cluster beside `ZoomSlider`, as a `.st-seg` with the same two buttons, titles and `dragAll`/`setDragAll` wiring. The waveform's number chips still use `dragAll`. Render it only when `showSync`.
    - The `onMeasureDrag`/`onMeasureDragEnd`/`onTailDrag` handlers in SyncPanel lose their strip caller. Keep them if `WaveformCanvas` uses them (its `onMarkerDrag`/`onTailDrag` props), and delete any that are now unused (`tsc` and eslint flag them).

- [ ] **Step 6: Write the strip test** (`components/playsense-studio/studio/__tests__/strip-selection.test.tsx`)
  - Mount `EditableMeasureStrip` with four empty bars: `events: []`, `voice2Events: []`, times `[i, i+1]` s, `pixelsPerSecond: 100`, `scrollLeftPx: 0`, `timeSignature: [4,4]`, `clef: 'treble'`, `keyFifths: 0`, `previousKeyFifths: 0`, `keyChanged/clefChanged: false`, and `isFirst: i === 0`. Fill any other required `MeasureStripItem` fields with neutral values.
  - Stub `HTMLElement.prototype.clientWidth` to 800, `ResizeObserver`, `setPointerCapture`/`releasePointerCapture`, and `requestAnimationFrame` (run the callback via `setTimeout(cb, 0)`, and use fake timers).
  - Assert:
    1. A `pointerdown` at `clientX: 50` on `[data-measure-index="0"]`, then `pointermove` to 250, a timer advance, and `pointerup`, calls `onSelectMeasure(0, false)` then `onSelectMeasureRange(0, 2)`.
    2. A `dblclick` on `[data-measure-index="1"]` calls `onOpenMeasure(1)`.
    3. A `pointerdown`/`pointerup` at the same point on empty staff calls only `onSelectMeasure`, and no other callback prop is called. Pass every callback as a `vi.fn()` and assert that `onSelectEvent` and `onSetPitch` were not called.

- [ ] **Step 7: Run everything and commit**

Run: `npx vitest run lib/playsense-studio/__tests__/measure-selection.test.ts components/playsense-studio --exclude '.worktrees/**'`, then `npx tsc --noEmit -p .`.

```bash
git add lib/playsense-studio/measure-selection.ts lib/playsense-studio/__tests__/measure-selection.test.ts components/playsense-studio
git commit -m "Select bars by click, drag or shift-click and never add notes from a strip click"
```

---

### Task 6: Beat counts per bar and the issue chip

**Files:**
- Create: `lib/playsense-studio/measure-fill.ts`
- Test: `lib/playsense-studio/__tests__/measure-fill.test.ts`
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx` (`MeasureStripItem` gains `fill`; the header chip; the hatched gap; the narrow rule)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (compute `fill` in the track-extraction memo; add the footer under the strip)
- Modify: `app/globals.css` (add the `.st-cap`, `.st-gapfill`, `.st-strip-foot` and `.st-issue-chip` rules)

**Interfaces — Produces:**

```ts
export type FillKind = 'empty' | 'short' | 'ok' | 'over';
export interface MeasureFill { kind: FillKind; usedBeats: number; totalBeats: number; missingBeats: number; overBeats: number }
export function measureFill(voice1: MusicalEvent[], voice2: MusicalEvent[] | undefined, ts: [number, number]): MeasureFill
export function beatsText(beats: number): string
export function fillTitle(measureNumber: number, fill: MeasureFill): string
export function fillIssues(fills: MeasureFill[]): number[]   // indices of short or over bars
```

Beats are counted in the time signature's own unit, its denominator. So a 6/8 bar holds 6 and a 2/2 bar holds 2, matching the prototype's "2½/3". Voice 2 counts only when it has at least one pitched event; a voice 2 that holds only rests is a layout artefact. A filler rest counts as empty.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { beatsText, fillIssues, fillTitle, measureFill } from '../measure-fill';

const n = (q: number): MusicalEvent => ({ kind: 'note', midi: 60, durationQN: q });
const r = (q: number): MusicalEvent => ({ kind: 'rest', durationQN: q });

describe('measureFill', () => {
  it('counts a full 4/4 bar as ok', () => {
    expect(measureFill([n(1), n(1), n(2)], undefined, [4, 4])).toMatchObject({ kind: 'ok', usedBeats: 4, totalBeats: 4 });
  });
  it('a short bar reports what is missing', () => {
    expect(measureFill([n(1), n(1.5)], undefined, [3, 4])).toMatchObject({ kind: 'short', usedBeats: 2.5, missingBeats: 0.5 });
  });
  it('an over-full bar reports the excess', () => {
    expect(measureFill([n(2), n(2), n(1)], undefined, [4, 4])).toMatchObject({ kind: 'over', overBeats: 1 });
  });
  it('counts 6/8 in eighths', () => {
    expect(measureFill([n(1.5), n(1.5)], undefined, [6, 8])).toMatchObject({ kind: 'ok', usedBeats: 6, totalBeats: 6 });
  });
  it('an empty bar or a lone filler rest is empty', () => {
    expect(measureFill([], undefined, [4, 4]).kind).toBe('empty');
    expect(measureFill([r(4)], undefined, [4, 4]).kind).toBe('empty');
  });
  it('a real rest counts as filled time', () => {
    expect(measureFill([n(2), r(2)], undefined, [4, 4]).kind).toBe('ok');
  });
  it('voice 2 is checked only when it has notes', () => {
    expect(measureFill([n(4)], [r(1)], [4, 4]).kind).toBe('ok');
    expect(measureFill([n(4)], [n(1)], [4, 4]).kind).toBe('short');
  });
});

describe('beatsText / fillTitle / fillIssues', () => {
  it('renders fractions as glyphs', () => {
    expect(beatsText(2.5)).toBe('2½');
    expect(beatsText(0.5)).toBe('½');
    expect(beatsText(3)).toBe('3');
    expect(beatsText(1 + 1 / 3)).toBe('1⅓');
    expect(beatsText(2.1)).toBe('2+');
  });
  it('titles say what is wrong', () => {
    expect(fillTitle(2, measureFill([n(1), n(1.5)], undefined, [3, 4]))).toBe('m.2: ½ beat missing');
    expect(fillTitle(3, measureFill([n(2), n(2), n(2)], undefined, [4, 4]))).toBe('m.3: 2 beats too many');
    expect(fillTitle(4, measureFill([], undefined, [4, 4]))).toBe('m.4 is empty');
    expect(fillTitle(5, measureFill([n(4)], undefined, [4, 4]))).toBe('m.5: 4 of 4 beats');
  });
  it('lists short and over bars only', () => {
    const fills = [measureFill([n(4)], undefined, [4, 4]), measureFill([n(1)], undefined, [4, 4]), measureFill([], undefined, [4, 4]), measureFill([n(5)], undefined, [4, 4])];
    expect(fillIssues(fills)).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `measure-fill.ts`**

```ts
// PlaySense Studio — how full each bar is, in the time signature's own beats
// (a 6/8 bar holds 6). Drives the strip's beat chip, the hatched missing time
// and the footer's "bars don't add up" chip.

import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { QN_EPS, isFillerRest, measureLengthInQN, occupiedQN } from './time-mapping';

export type FillKind = 'empty' | 'short' | 'ok' | 'over';

export interface MeasureFill {
  kind: FillKind;
  usedBeats: number;
  totalBeats: number;
  missingBeats: number;
  overBeats: number;
}

export function measureFill(voice1: MusicalEvent[], voice2: MusicalEvent[] | undefined, ts: [number, number]): MeasureFill {
  const unitQN = 4 / ts[1];
  const needQN = measureLengthInQN(ts);
  const totalBeats = needQN / unitQN;
  const v1 = isFillerRest(voice1, ts) ? [] : voice1;
  const v2 = voice2 && voice2.some((e) => e.kind !== 'rest') ? voice2 : [];
  if (v1.length === 0 && v2.length === 0) {
    return { kind: 'empty', usedBeats: 0, totalBeats, missingBeats: totalBeats, overBeats: 0 };
  }
  const used = occupiedQN(v1);
  const used2 = v2.length ? occupiedQN(v2) : needQN;
  const over = Math.max(used - needQN, used2 - needQN);
  const short = Math.max(needQN - used, needQN - used2);
  const kind: FillKind = over > QN_EPS ? 'over' : short > QN_EPS ? 'short' : 'ok';
  return {
    kind,
    usedBeats: used / unitQN,
    totalBeats,
    missingBeats: kind === 'short' ? short / unitQN : 0,
    overBeats: kind === 'over' ? over / unitQN : 0,
  };
}

const FRACTIONS: Array<[number, string]> = [
  [1 / 2, '½'], [1 / 4, '¼'], [3 / 4, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔'], [1 / 8, '⅛'],
  [3 / 8, '⅜'], [5 / 8, '⅝'], [7 / 8, '⅞'], [1 / 6, '⅙'], [5 / 6, '⅚'],
];

export function beatsText(beats: number): string {
  const whole = Math.floor(beats + 1e-6);
  const frac = beats - whole;
  if (frac < 1e-3) return String(whole);
  const glyph = FRACTIONS.find(([v]) => Math.abs(v - frac) < 1e-3)?.[1] ?? '+';
  return whole === 0 && glyph !== '+' ? glyph : `${whole}${glyph}`;
}

export function fillTitle(measureNumber: number, fill: MeasureFill): string {
  const beats = (b: number) => `${beatsText(b)} beat${Math.abs(b - 1) < 1e-6 || b < 1 ? '' : 's'}`;
  switch (fill.kind) {
    case 'empty': return `m.${measureNumber} is empty`;
    case 'short': return `m.${measureNumber}: ${beats(fill.missingBeats)} missing`;
    case 'over': return `m.${measureNumber}: ${beats(fill.overBeats)} too many`;
    default: return `m.${measureNumber}: ${beatsText(fill.usedBeats)} of ${beatsText(fill.totalBeats)} beats`;
  }
}

export function fillIssues(fills: MeasureFill[]): number[] {
  return fills.flatMap((f, i) => (f.kind === 'short' || f.kind === 'over' ? [i] : []));
}
```

- [ ] **Step 4: Show it in the strip**
  - **`MeasureStripItem` gains `fill: MeasureFill`.**
    - In `IntegratedEditor`, compute it inside the memo that runs `extractTrackEvents` (which depends only on the track):
      `measureFill(m.voices[0]?.events ?? [], m.voices[1]?.events, tracked[i].timeSignature)` for each `m` of `activeTrack.measures`.
    - Copy it into each strip item.
  - **Header chip.** Replace the old capacity chip (the `usedBeats`/`totalBeats`/`capLabel`/`showCap` block) with:
    ```tsx
    {width >= 60 && (
      <span className={`st-cap is-${item.fill.kind} ml-auto shrink-0 tabular-nums leading-none`} title={fillTitle(item.measureNumber, item.fill)}>
        {item.fill.kind === 'empty' ? `0/${beatsText(item.fill.totalBeats)}` : `${beatsText(item.fill.usedBeats)}/${beatsText(item.fill.totalBeats)}`}
      </span>
    )}
    ```
    Remove the now-unused `formatBeatsShort` helper if nothing else uses it.
  - **Missing time.** When `item.fill.kind === 'short'` and the bar is wide enough to draw its staff:
    - Draw `<div className="st-gapfill" style={{ left: gapLeft, width: width - gapLeft, top: HANDLE_BAND_PX + 6, bottom: 6 }}>`.
    - Compute `gapLeft` from the bar's hits: `const hits = hitsByMeasure.current.get(item.measureIndex); const last = hits?.at(-1); const gapLeft = last ? Math.min(width - 8, last.x + last.w + 4) : width * (item.fill.usedBeats / item.fill.totalBeats);`.
    - When `width - gapLeft > 60`, put the text `−${beatsText(item.fill.missingBeats)} beat${item.fill.missingBeats === 1 ? '' : 's'} missing` inside it, as a `<span>`.
    - The div sits behind the staff (`z-index: 0`) with `pointer-events: none`.
  - **CSS:**
    ```css
    .st-cap { font-size: 10.5px; padding: 1px 5px; border-radius: 999px; color: hsl(var(--muted-foreground)); }
    .st-cap.is-ok { color: hsl(var(--foreground) / .75); }
    .st-cap.is-short { background: hsl(var(--gold-highlight) / .18); color: hsl(var(--gold-highlight)); }
    .st-cap.is-over { background: hsl(var(--destructive) / .18); color: hsl(var(--destructive)); }
    .st-cap.is-empty { border: 1px dashed hsl(var(--border)); }
    .st-gapfill {
      position: absolute; z-index: 0; pointer-events: none; display: flex; align-items: flex-end; justify-content: center;
      padding-bottom: 4px; border: 1px dashed hsl(var(--gold-highlight) / .55); border-radius: 6px;
      font-size: 10px; color: hsl(var(--gold-highlight));
      background: repeating-linear-gradient(135deg, hsl(var(--gold-highlight) / .14) 0 6px, transparent 6px 12px);
    }
    .st-strip-foot { display: flex; align-items: center; gap: 12px; min-height: 28px; padding: 4px 2px 0; font-size: 11px; color: hsl(var(--muted-foreground)); }
    .st-issue-chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px;
      background: hsl(var(--gold-highlight) / .16); color: hsl(var(--gold-highlight)); font-weight: 600;
    }
    .st-issue-chip.is-bad { background: hsl(var(--destructive) / .16); color: hsl(var(--destructive)); }
    ```

- [ ] **Step 5: Add the footer under the strip** (in `IntegratedEditor`, directly after the strip's wrapper)

```tsx
const fills = stripItems.map((it) => it.fill);
const issues = fillIssues(fills);
const anyOver = issues.some((i) => fills[i].kind === 'over');
const nextIssue = () => {
  if (!issues.length) return;
  const from = measureRange ? Math.max(measureRange.anchor, measureRange.focus) : -1;
  const target = issues.find((i) => i > from) ?? issues[0];
  setSelected(null);
  setMeasureRange({ anchor: target, focus: target });
  const t = measureTimings[target];
  if (t) {
    const left = t.startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    const right = t.endVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    if (left < 0 || right > viewportWidth) {
      onRequestZoom(pixelsPerSecond, Math.max(0, t.startVideoTimeSeconds * pixelsPerSecond - viewportWidth / 2 + (right - left) / 2));
    }
  }
};
```

```tsx
<div className="st-strip-foot">
  {issues.length > 0 && (
    <button type="button" className={`st-issue-chip${anyOver ? ' is-bad' : ''}`} onClick={nextIssue} title="Jump to the next bar that doesn’t add up">
      {issues.length === 1 ? '1 bar doesn’t add up' : `${issues.length} bars don’t add up`} · {issues.slice(0, 3).map((i) => `m.${stripItems[i].measureNumber}`).join(', ')}{issues.length > 3 ? '…' : ''} ▾
    </button>
  )}
  <span className="truncate">
    {measureRange
      ? '⏎ zoom in · ⌘D duplicate · ⌫ delete · esc deselect'
      : 'Drag across bars to select · double-click a bar to zoom in · scroll to zoom'}
  </span>
</div>
```

Task 11 wires ⏎, ⌘D and ⌫ into one key handler. The hint describes them now because Task 11 lands before this branch merges.

- [ ] **Step 6: Test, type-check and commit**

Run the fill tests, then `npx vitest run components/playsense-studio lib/playsense-studio --exclude '.worktrees/**'`, then `npx tsc --noEmit -p .`.

```bash
git add lib/playsense-studio/measure-fill.ts lib/playsense-studio/__tests__/measure-fill.test.ts components/playsense-studio app/globals.css
git commit -m "Show each bar's beat count, hatch missing time and jump between bars that don't add up"
```

---

### Task 7: Clear, duplicate, bar properties and repeat counts in the reducer

**Files:**
- Create: `lib/playsense-studio/event-ids.ts` (only `pruneSpans` here; Task 13 adds the rest)
- Modify: `lib/playsense-studio/editor-state.ts` (the `EditorAction` union and the reducer switch)
- Modify: `lib/playsense-studio/measure-edits.ts` (a new structural action `set-repeat-count`: its guard and its edit)
- Modify: `components/playsense-studio/sync/structural-timing.ts` (timing for `set-repeat-count`)
- Modify: `lib/playsense-studio/measure-clipboard.ts` (export `stripCopyTags`)
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (`studioDispatch` handles `duplicate-measures`)
- Test: `lib/playsense-studio/__tests__/measure-edits.test.ts` and `components/playsense-studio/sync/__tests__/structural-timing.test.ts` (append to both)

**Interfaces — Produces:**

```ts
// editor-state.ts
export interface MeasurePropsPatch {
  timeSignature?: [number, number];
  keyFifths?: number;
  clef?: 'treble' | 'bass' | 'alto' | 'tenor';
  tempo?: number;
  repeatStart?: boolean;
  repeatEnd?: boolean;
  endBarline?: 'double' | null;   // 'final' stays with set-measure-final-bar
  volta?: '1.' | '2.' | null;
}
// new EditorAction members:
| { type: 'clear-measures'; trackIndex: number; start: number; count: number }
| { type: 'set-measure-props'; trackIndex: number; measureIndex: number; props: MeasurePropsPatch }
| { type: 'duplicate-measures'; trackIndex: number; start: number; count: number }

// measure-edits.ts — new StructuralAction member (also an EditorAction, since EditorAction already includes the structural ones by name; add it to the union the same way as 'repeat-measures'):
| { type: 'set-repeat-count'; trackIndex: number; id: string; count: number }

// event-ids.ts
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans']

// measure-clipboard.ts
export function stripCopyTags(m: Measure): Measure   // drops repeat and endBarline
```

The rules:
- **`clear-measures`** empties voice 1, drops voice 2, and keeps the bar, its time signature, key, clef, tempo and barlines, so its timing stays. It goes through `withHistory`, so clearing one pass of a repeat clears the same bar in every pass.
- **`set-measure-props`:**
  - A time signature, key or tempo equal to what the bar already inherits removes that bar's override. On bar 0 it writes the score's `initialTimeSignature` / `initialKeyFifths` / `initialTempo` instead of an override.
  - Tempo is rounded and clamped to 20–400.
  - It goes through `withHistory`, so it reaches every pass.
- **`duplicate-measures`** inserts copies of `[start, start+count)` right after them, with repeat tags and end-barline overrides stripped. In the reducer this is a plain `paste-measures` of those bars. `studioDispatch` intercepts it first, so the copies carry the bars' own timing.
- **`set-repeat-count`** changes how many passes a repeat group plays. Extra passes are copies of pass 1 appended after the last pass, and later bars move to make room. Fewer passes delete the trailing passes, and later bars slide back. Every pass's `repeat.count` is updated.

- [ ] **Step 1: Write the failing tests**

Append these to `lib/playsense-studio/__tests__/measure-edits.test.ts`. That file already has `bar`, `score`, `three`, `repeated` (bars 1–2 ×2 then bar 3, so midis `[60, 62, 60, 62, 64]`), `numbers`, `midis`, `ok`, `editorReducer` and `repeatGroups`. Add `type MeasurePropsPatch` to its `../editor-state` import.

```ts
const st = (s: ScoreDocument) => ({ score: s, past: [], future: [], isDirty: false });
const ev = (s: ScoreDocument, i: number) => s.tracks[0].measures[i].voices[0].events;

describe('clear-measures', () => {
  it('empties the bars but keeps their meter and count', () => {
    const s0 = score([bar(1), bar(2, 62, { timeSignature: [3, 4] }), bar(3)]);
    const s1 = editorReducer(st(s0), { type: 'clear-measures', trackIndex: 0, start: 1, count: 2 }).score;
    expect(numbers(s1)).toEqual([1, 2, 3]);
    expect(s1.tracks[0].measures[1].voices).toEqual([{ number: 1, events: [] }]);
    expect(s1.tracks[0].measures[1].timeSignature).toEqual([3, 4]);
    expect(ev(s1, 0)).toHaveLength(1);
  });
  it('clearing one pass of a repeat clears that bar in every pass and keeps the group (Review Focus 4)', () => {
    const s1 = editorReducer(st(repeated()), { type: 'clear-measures', trackIndex: 0, start: 2, count: 1 }).score;
    expect(ev(s1, 0)).toEqual([]);
    expect(ev(s1, 2)).toEqual([]);
    expect(ev(s1, 1)).toHaveLength(1);
    expect(ev(s1, 3)).toHaveLength(1);
    expect(repeatGroups(s1.tracks[0])).toEqual([expect.objectContaining({ id: 'g', count: 2 })]);
  });
  it('drops slurs whose notes were cleared', () => {
    const s0 = score([{ number: 1, voices: [{ number: 1, events: [
      { kind: 'note', id: 'a', midi: 60, durationQN: 2 }, { kind: 'note', id: 'b', midi: 62, durationQN: 2 }] }] }, bar(2)]);
    s0.spans = [{ id: 's', type: 'slur', from: 'a', to: 'b' }];
    expect(editorReducer(st(s0), { type: 'clear-measures', trackIndex: 0, start: 0, count: 1 }).score.spans).toEqual([]);
  });
});

describe('set-measure-props', () => {
  const set = (s: ScoreDocument, measureIndex: number, props: MeasurePropsPatch) =>
    editorReducer(st(s), { type: 'set-measure-props', trackIndex: 0, measureIndex, props }).score;
  it('a time signature on a later bar is an override; the inherited one removes it', () => {
    const s1 = set(three(), 1, { timeSignature: [3, 4] });
    expect(s1.tracks[0].measures[1].timeSignature).toEqual([3, 4]);
    expect(set(s1, 1, { timeSignature: [4, 4] }).tracks[0].measures[1].timeSignature).toBeUndefined();
  });
  it('bar 0 writes the score defaults', () => {
    const s1 = set(three(), 0, { tempo: 132, keyFifths: -2 });
    expect(s1.initialTempo).toBe(132);
    expect(s1.initialKeyFifths).toBe(-2);
    expect(s1.tracks[0].measures[0].tempoChange).toBeUndefined();
  });
  it('clamps tempo', () => {
    expect(set(three(), 1, { tempo: 999 }).tracks[0].measures[1].tempoChange).toBe(400);
  });
  it('toggles endings and repeat barlines', () => {
    const s1 = set(three(), 1, { volta: '1.', repeatEnd: true });
    expect(s1.tracks[0].measures[1]).toMatchObject({ volta: '1.', repeatEnd: true });
    const s2 = set(s1, 1, { volta: null, repeatEnd: false });
    expect(s2.tracks[0].measures[1].volta).toBeUndefined();
    expect(s2.tracks[0].measures[1].repeatEnd).toBeUndefined();
  });
  it('a no-op change adds no history', () => {
    const s0 = st(three());
    expect(editorReducer(s0, { type: 'set-measure-props', trackIndex: 0, measureIndex: 1, props: { timeSignature: [4, 4] } })).toBe(s0);
  });
});

describe('duplicate-measures', () => {
  it('inserts copies right after the range', () => {
    const s1 = editorReducer(st(three()), { type: 'duplicate-measures', trackIndex: 0, start: 0, count: 2 }).score;
    expect(numbers(s1)).toEqual([1, 2, 3, 4, 5]);
    expect(midis(s1)).toEqual([60, 62, 60, 62, 64]);
  });
});

describe('set-repeat-count', () => {
  it('adds passes as copies of pass 1 after the group', () => {
    const r = ok(applyMeasureEdit(repeated(), { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 }));
    expect(midis(r.score)).toEqual([60, 62, 60, 62, 60, 62, 64]);
    expect(r.score.tracks[0].measures.slice(0, 6).every((m) => m.repeat?.count === 3)).toBe(true);
    expect(r.score.tracks[0].measures[4].repeat?.pass).toBe(2);
    expect(r.splice).toEqual({ index: 4, removeCount: 0, insertCount: 2 });
  });
  it('removes trailing passes', () => {
    const tripled = ok(applyMeasureEdit(repeated(), { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 })).score;
    const r = ok(applyMeasureEdit(tripled, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 2 }));
    expect(midis(r.score)).toEqual([60, 62, 60, 62, 64]);
    expect(r.splice).toEqual({ index: 4, removeCount: 2, insertCount: 0 });
  });
  it('refuses an unknown group, the same count or a count outside 2–8', () => {
    const s = repeated();
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'nope', count: 3 })).toBe('That repeat no longer exists.');
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 2 })).toBe('It already plays that many times.');
    expect(structuralEditProblem(s, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 9 })).toBe('Choose between 2 and 8 times.');
  });
});
```

Append this to `components/playsense-studio/sync/__tests__/structural-timing.test.ts`, inside `describe('prepareStructuralEdit', …)`:

```ts
it('set-repeat-count: new passes take pass 1’s timing and later bars move to make room', () => {
  const s = score(3);
  const markers = seedMarkerState(s.tracks[0], s, buildWaypoints(s, 120, 0));
  const rep = ok(prepareStructuralEdit(markers, s, { type: 'repeat-measures', trackIndex: 0, start: 0, end: 0, count: 2, id: 'g' }));
  const r = ok(prepareStructuralEdit(rep.markers, rep.score, { type: 'set-repeat-count', trackIndex: 0, id: 'g', count: 3 }));
  agree(r);
  expect(starts(r.markers)).toEqual([0, 2, 4, 6, 8].map((t) => expect.closeTo(t, 9)));
  expect(r.markers.tailVideoTimeSeconds).toBeCloseTo(10, 9);
});
```

- [ ] **Step 2: Run and confirm failure.** Run: `npx vitest run lib/playsense-studio/__tests__/measure-edits.test.ts components/playsense-studio/sync/__tests__/structural-timing.test.ts --exclude '.worktrees/**'`.

- [ ] **Step 3: Implement**

`event-ids.ts`:

```ts
// PlaySense Studio — event-id integrity. Slurs and hairpins (score.spans) point
// at events by id, so ids must be unique and spans must never point at an
// event that is gone.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/** The spans whose two ends still exist; undefined stays undefined. */
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans'] {
  if (!score.spans) return score.spans;
  const ids = new Set<string>();
  for (const t of score.tracks) for (const m of t.measures) for (const v of m.voices) for (const e of v.events) if (e.id) ids.add(e.id);
  return score.spans.filter((s) => ids.has(s.from) && ids.has(s.to));
}
```

`measure-clipboard.ts`: extract the existing strip into `export function stripCopyTags(m: Measure): Measure { const { repeat: _r, endBarline: _e, ...rest } = m; return rest; }` and use it inside `writeMeasureClipboard`. Import `Measure` from the score-model types.

`editor-state.ts`: add the three action members and `MeasurePropsPatch`. Then add the reducer cases:

```ts
case 'clear-measures': {
  const next = clone(state.score);
  const track = next.tracks[action.trackIndex];
  if (!track || action.count < 1) return state;
  const end = Math.min(track.measures.length, action.start + action.count);
  let changed = false;
  for (let i = Math.max(0, action.start); i < end; i++) {
    const m = track.measures[i];
    if (m.voices.length === 1 && m.voices[0].events.length === 0) continue;
    m.voices = [{ number: 1, events: [] }];
    changed = true;
  }
  if (!changed) return state;
  const spans = pruneSpans(next);
  if (spans) next.spans = spans;
  return withHistory(state, next);
}
case 'set-measure-props': {
  const next = clone(state.score);
  const track = next.tracks[action.trackIndex];
  const m = track?.measures[action.measureIndex];
  if (!track || !m) return state;
  const first = action.measureIndex === 0;
  const before = inheritedContext(next, track, action.measureIndex);
  const p = action.props;
  if (p.timeSignature) {
    if (first) { next.initialTimeSignature = p.timeSignature; delete m.timeSignature; }
    else if (p.timeSignature[0] === before.timeSignature[0] && p.timeSignature[1] === before.timeSignature[1]) delete m.timeSignature;
    else m.timeSignature = [p.timeSignature[0], p.timeSignature[1]];
  }
  if (p.keyFifths !== undefined) {
    if (first) { next.initialKeyFifths = p.keyFifths; delete m.keyFifths; }
    else if (p.keyFifths === before.keyFifths) delete m.keyFifths;
    else m.keyFifths = p.keyFifths;
  }
  if (p.tempo !== undefined) {
    const bpm = Math.max(20, Math.min(400, Math.round(p.tempo)));
    if (first) { next.initialTempo = bpm; delete m.tempoChange; }
    else if (bpm === before.tempo) delete m.tempoChange;
    else m.tempoChange = bpm;
  }
  if (p.clef) { if (p.clef === before.clef) delete m.clef; else m.clef = p.clef; }
  if (p.repeatStart !== undefined) { if (p.repeatStart) m.repeatStart = true; else delete m.repeatStart; }
  if (p.repeatEnd !== undefined) { if (p.repeatEnd) m.repeatEnd = true; else delete m.repeatEnd; }
  if (p.endBarline !== undefined) { if (p.endBarline) m.endBarline = p.endBarline; else if (m.endBarline === 'double') delete m.endBarline; }
  if (p.volta !== undefined) { if (p.volta) m.volta = p.volta; else delete m.volta; }
  if (JSON.stringify(next) === JSON.stringify(state.score)) return state;
  return withHistory(state, next);
}
case 'duplicate-measures': {
  const track = state.score.tracks[action.trackIndex];
  if (!track || action.count < 1) return state;
  const measures = track.measures.slice(action.start, action.start + action.count).map((m) => stripCopyTags(clone(m)));
  if (!measures.length) return state;
  const result = applyMeasureEdit(state.score, {
    type: 'paste-measures',
    trackIndex: action.trackIndex,
    index: action.start + measures.length,
    clip: { measures, context: contextAt(state.score, track, action.start), instrument: track.instrument },
  });
  return result.ok ? pushHistory(state, result.score) : state;
}
```

Add `set-repeat-count` to the structural cases that call `applyMeasureEdit` and `pushHistory`, next to `repeat-measures`.

Add this helper next to `effectiveTimeSignatureAt`:

```ts
/** Meter, key, tempo and clef in force just before `index`. */
function inheritedContext(score: ScoreDocument, track: Track, index: number) {
  let timeSignature = score.initialTimeSignature;
  let keyFifths = score.initialKeyFifths;
  let tempo = score.initialTempo;
  let clef: NonNullable<Measure['clef']> = 'treble';
  for (let i = 0; i < index && i < track.measures.length; i++) {
    const m = track.measures[i];
    if (m.timeSignature) timeSignature = m.timeSignature;
    if (m.keyFifths !== undefined) keyFifths = m.keyFifths;
    if (m.tempoChange !== undefined) tempo = m.tempoChange;
    if (m.clef) clef = m.clef;
  }
  return { timeSignature, keyFifths, tempo, clef };
}
```

Import `contextAt` from `./measure-edits`, `stripCopyTags` from `./measure-clipboard` and `pruneSpans` from `./event-ids`.

`measure-edits.ts`:
- Add the `set-repeat-count` member to `StructuralAction`.
- In `structuralEditProblem`:
  ```ts
  case 'set-repeat-count': {
    const g = repeatGroups(track).find((x) => x.id === action.id);
    if (!g) return 'That repeat no longer exists.';
    if (!Number.isInteger(action.count) || action.count < 2 || action.count > 8) return 'Choose between 2 and 8 times.';
    if (action.count === g.count) return 'It already plays that many times.';
    if (n + g.length * (action.count - g.count) > MAX_MEASURES) return `Scores are limited to ${MAX_MEASURES} measures.`;
    return null;
  }
  ```
- In `applyMeasureEdit`:
  ```ts
  case 'set-repeat-count': {
    const g = repeatGroups(original).find((x) => x.id === action.id)!;
    const groupEnd = g.start + g.length * g.count;
    for (let i = g.start; i < groupEnd; i++) track.measures[i].repeat!.count = action.count;
    if (action.count > g.count) {
      const pass1 = track.measures.slice(g.start, g.start + g.length);
      const added = Array.from({ length: action.count - g.count }, (_, k) => pass1.map((m) => ({
        ...clone(m), repeat: { ...m.repeat!, pass: g.count + k, count: action.count },
      }))).flat();
      track.measures.splice(groupEnd, 0, ...added);
      renumber(track);
      return { ok: true, score: next, splice: { index: groupEnd, removeCount: 0, insertCount: added.length } };
    }
    const keepEnd = g.start + g.length * action.count;
    const removeCount = groupEnd - keepEnd;
    track.measures.splice(keepEnd, removeCount);
    renumber(track);
    return { ok: true, score: next, splice: { index: keepEnd, removeCount, insertCount: 0 } };
  }
  ```

`structural-timing.ts`: in the `switch` inside `prepareStructuralEdit`, add:

```ts
case 'set-repeat-count': {
  if (splice.insertCount > 0) {
    const g = repeatGroups(score.tracks[action.trackIndex]).find((x) => x.id === action.id)!;
    const source = copyMeasureSpans(markers, g.start, g.length);
    insert = Array.from({ length: splice.insertCount / g.length }, () => source.map((s) => ({ ...s }))).flat();
  }
  break;
}
```

Import `repeatGroups` from `@/lib/playsense-studio/repeats`. With `ripple` left true, later bars move later on an increase and earlier on a decrease.

`sync-panel.tsx`, `studioDispatch`: before the `isStructuralAction` check, add:

```ts
if (action.type === 'duplicate-measures') {
  const current = scoreRef.current;
  if (!current.tracks[action.trackIndex]) return;
  const clip = clipFromMeasures(markersRef.current, current, action.trackIndex, action.start, action.count);
  clip.measures = clip.measures.map((m) => stripCopyTags(JSON.parse(JSON.stringify(m))));
  studioDispatch({ type: 'paste-measures', trackIndex: action.trackIndex, index: action.start + action.count, clip });
  return;
}
```

`studioDispatch` is a `useCallback` that calls itself. Hold it in a ref (`const studioDispatchRef = useRef(studioDispatch); studioDispatchRef.current = studioDispatch;`) and call `studioDispatchRef.current(...)` inside it, so the closure is never stale.

- [ ] **Step 4: Run the tests and the suites, type-check, and commit**

```bash
git add lib/playsense-studio components/playsense-studio
git commit -m "Add clearing, duplicating, bar properties and repeat-count changes to the editor"
```

---

### Task 8: The repeat lane and its menu

**Files:**
- Create: `components/playsense-studio/studio/measure/repeat-popover.tsx`, `components/playsense-studio/studio/measure/repeat-lane.tsx`
- Create: `components/playsense-studio/studio/measure/popover.tsx` (a small positioned shell shared by the Task 8–11 menus)
- Test: `components/playsense-studio/studio/measure/__tests__/repeat-lane.test.tsx`
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx`:
  - reserve the lane
  - replace the repeat-bracket block (`{spans.map((span) => …data-repeat-bracket…)}`) with `<RepeatLane>`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`:
  - own the popover state
  - dispatch `repeat-measures` / `set-repeat-count` / `unlink-repeat`
- Modify: `app/globals.css` (add `.st-replane`, `.st-rband` and the `.st-mpop*` rules)

**Interfaces — Produces:**

```ts
// popover.tsx — every measure menu uses this shell
export interface PopoverAnchor { left: number; top: number }   // strip-container px
export function MeasurePopover(props: { anchor: PopoverAnchor; title: string; hint?: string; onClose: () => void; children: ReactNode }): JSX.Element

// repeat-lane.tsx
export const REP_H = 20;
export interface RepeatBand { id: string; pass: number; count: number; length: number; firstIndex: number; lastIndex: number; left: number; right: number }
export function repeatBands(items: MeasureStripItem[], toX: (t: number) => number): RepeatBand[]
export function bandLabel(b: RepeatBand): string   // width-dependent text
export function RepeatLane(props: { bands: RepeatBand[]; onBandClick: (b: RepeatBand, anchor: PopoverAnchor) => void }): JSX.Element

// repeat-popover.tsx
export function RepeatPopover(props: {
  anchor: PopoverAnchor; range: [number, number]; group: { id: string; count: number } | null;
  problemFor: (count: number) => string | null;
  onPick: (count: number) => void; onRemove: () => void; onSelectPassOne: () => void; onClose: () => void;
}): JSX.Element
```

The label rules (from v6):
- **Pass 1:** width > 150 gives `Repeat ×N · K bars` (singular `1 bar`), width > 60 gives `×N`, and anything narrower is blank.
- **Later passes:** width > 90 gives `pass P of N`, width > 40 gives `P/N`, and anything narrower is blank.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { bandLabel, repeatBands, type RepeatBand } from '../repeat-lane';

const band = (pass: number, w: number, count = 3, length = 2): RepeatBand =>
  ({ id: 'r', pass, count, length, firstIndex: 0, lastIndex: 1, left: 0, right: w });

describe('bandLabel', () => {
  it('pass 1 says how often and how long', () => {
    expect(bandLabel(band(0, 200))).toBe('Repeat ×3 · 2 bars');
    expect(bandLabel(band(0, 200, 2, 1))).toBe('Repeat ×2 · 1 bar');
    expect(bandLabel(band(0, 80))).toBe('×3');
    expect(bandLabel(band(0, 40))).toBe('');
  });
  it('later passes say which pass they are', () => {
    expect(bandLabel(band(1, 120))).toBe('pass 2 of 3');
    expect(bandLabel(band(2, 60))).toBe('3/3');
    expect(bandLabel(band(1, 30))).toBe('');
  });
});

describe('repeatBands', () => {
  it('makes one band per pass', () => {
    const rp = (pass: number, offset: number) => ({ id: 'r', pass, count: 2, offset, length: 2 });
    const items = [0, 1, 2, 3, 4].map((i) => ({
      measureIndex: i, measureNumber: i + 1, startVideoTimeSeconds: i, endVideoTimeSeconds: i + 1,
      repeatPass: i < 4 ? rp(Math.floor(i / 2), i % 2) : undefined,
    })) as unknown as Parameters<typeof repeatBands>[0];
    const bands = repeatBands(items, (t) => t * 100);
    expect(bands.map((b) => [b.pass, b.firstIndex, b.lastIndex, b.left, b.right])).toEqual([[0, 0, 1, 0, 200], [1, 2, 3, 200, 400]]);
  });
});
```

Add a render test: a `RepeatPopover` with `group: null`, `range: [1, 2]` and `problemFor: () => null` shows the title `Play m.2–3 more than once` and five buttons `×2 ×3 ×4 ×6 ×8`, and clicking `×4` calls `onPick(4)`. With `group: { id: 'r', count: 3 }` it shows `m.2–3 play ×3`, marks `×3` with `aria-pressed="true"`, and shows `Remove repeat` and `Select pass 1`.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

`popover.tsx`:

```tsx
'use client';

// A small menu pinned to a point in the strip. Closes on Escape or an outside
// click. Pops in (160 ms) unless the viewer prefers reduced motion.

import { useEffect, useRef, type ReactNode } from 'react';

export interface PopoverAnchor { left: number; top: number }

export function MeasurePopover({ anchor, title, hint, onClose, children }: {
  anchor: PopoverAnchor; title: string; hint?: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); };
  }, [onClose]);
  return (
    <div ref={ref} role="dialog" aria-label={title} className="st-mpop" style={{ left: anchor.left, top: anchor.top }}>
      <div className="st-mpop-title">{title}</div>
      {children}
      {hint && <p className="st-mpop-hint">{hint}</p>}
    </div>
  );
}
```

`role="dialog"` also makes `isTypingTarget` treat keys typed inside the menu as typing, so the measure shortcuts stay out of the way.

`repeat-lane.tsx`:

```tsx
'use client';

// The repeat lane: a 20 px band row over the strip, one band per pass. Pass 1
// says "Repeat ×N · K bars"; later passes are hatched "pass P of N". Clicking a
// band selects that pass and opens the repeat menu.

import { Repeat } from 'lucide-react';
import type { MeasureStripItem } from '../editable-measure-strip';
import type { PopoverAnchor } from './popover';

export const REP_H = 20;

export interface RepeatBand {
  id: string; pass: number; count: number; length: number;
  firstIndex: number; lastIndex: number; left: number; right: number;
}

export function repeatBands(items: MeasureStripItem[], toX: (t: number) => number): RepeatBand[] {
  const bands: RepeatBand[] = [];
  for (const item of items) {
    const r = item.repeatPass;
    if (!r) continue;
    const last = bands.at(-1);
    if (last && last.id === r.id && last.pass === r.pass) {
      last.lastIndex = item.measureIndex;
      last.right = toX(item.endVideoTimeSeconds);
    } else {
      bands.push({
        id: r.id, pass: r.pass, count: r.count, length: r.length,
        firstIndex: item.measureIndex, lastIndex: item.measureIndex,
        left: toX(item.startVideoTimeSeconds), right: toX(item.endVideoTimeSeconds),
      });
    }
  }
  return bands;
}

export function bandLabel(b: RepeatBand): string {
  const w = b.right - b.left;
  if (b.pass === 0) {
    if (w > 150) return `Repeat ×${b.count} · ${b.length} bar${b.length === 1 ? '' : 's'}`;
    return w > 60 ? `×${b.count}` : '';
  }
  if (w > 90) return `pass ${b.pass + 1} of ${b.count}`;
  return w > 40 ? `${b.pass + 1}/${b.count}` : '';
}

export function RepeatLane({ bands, onBandClick }: { bands: RepeatBand[]; onBandClick: (b: RepeatBand, anchor: PopoverAnchor) => void }) {
  return (
    <div className="st-replane" style={{ height: REP_H }}>
      {bands.map((b) => (
        <button
          key={`${b.id}-${b.pass}`}
          type="button"
          className={`st-rband${b.pass > 0 ? ' is-copy' : ''}`}
          style={{ left: b.left, width: Math.max(4, b.right - b.left) }}
          title={b.pass === 0 ? `These ${b.length} bar${b.length === 1 ? '' : 's'} play ${b.count} times` : `Pass ${b.pass + 1} of ${b.count}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onBandClick(b, { left: b.left + 8, top: REP_H + 4 }); }}
        >
          {b.pass === 0 && b.right - b.left > 60 && <Repeat className="h-3 w-3 shrink-0" />}
          <span className="truncate">{bandLabel(b)}</span>
        </button>
      ))}
    </div>
  );
}
```

`repeat-popover.tsx`:

```tsx
'use client';

import { MeasurePopover, type PopoverAnchor } from './popover';

const COUNTS = [2, 3, 4, 6, 8];

export function RepeatPopover({ anchor, range, group, problemFor, onPick, onRemove, onSelectPassOne, onClose }: {
  anchor: PopoverAnchor; range: [number, number]; group: { id: string; count: number } | null;
  problemFor: (count: number) => string | null;
  onPick: (count: number) => void; onRemove: () => void; onSelectPassOne: () => void; onClose: () => void;
}) {
  const label = range[0] === range[1] ? `m.${range[0] + 1}` : `m.${range[0] + 1}–${range[1] + 1}`;
  return (
    <MeasurePopover
      anchor={anchor}
      title={group ? `${label} play ×${group.count}` : `Play ${label} more than once`}
      hint="Each pass is written out, so it lines up with the recording on its own. An edit to any pass reaches every pass. Students see repeat signs."
      onClose={onClose}
    >
      <div className="st-mpop-row">
        {COUNTS.map((n) => {
          const problem = group?.count === n ? null : problemFor(n);
          return (
            <button key={n} type="button" className="st-mpop-chip" aria-pressed={group?.count === n}
              disabled={!!problem} title={problem ?? `Play ${n} times`} onClick={() => onPick(n)}>
              ×{n}
            </button>
          );
        })}
      </div>
      {group && (
        <div className="st-mpop-row">
          <button type="button" className="st-mpop-item" onClick={onRemove}>✕ Remove repeat</button>
          <button type="button" className="st-mpop-item" onClick={onSelectPassOne}>Select pass 1</button>
        </div>
      )}
    </MeasurePopover>
  );
}
```

CSS:

```css
.st-replane { position: absolute; inset: 0 0 auto 0; z-index: 14; pointer-events: none; }
.st-rband {
  position: absolute; top: 2px; bottom: 2px; display: flex; align-items: center; gap: 4px; padding: 0 6px;
  overflow: hidden; pointer-events: auto; border-radius: 5px; font-size: 10.5px; font-weight: 600;
  color: hsl(180 55% 45%); background: hsl(180 55% 45% / .18); border: 1px solid hsl(180 55% 45% / .55);
}
.st-rband:hover { background: hsl(180 55% 45% / .28); }
.st-rband.is-copy {
  border-style: dashed;
  background: repeating-linear-gradient(135deg, hsl(180 55% 45% / .16) 0 5px, transparent 5px 10px);
}
.st-mpop {
  position: absolute; z-index: 50; min-width: 220px; max-width: 320px; padding: 10px; border-radius: 12px;
  background: hsl(var(--card)); border: 1px solid hsl(var(--border)); box-shadow: 0 18px 44px rgba(0,0,0,.5);
  animation: st-pop .16s cubic-bezier(.2,.8,.2,1);
}
@keyframes st-pop { from { opacity: 0; transform: translateY(5px) scale(.97); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .st-mpop { animation: none; } }
.st-mpop-title { margin-bottom: 8px; font-size: 12px; font-weight: 600; }
.st-mpop-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.st-mpop-chip, .st-mpop-item {
  padding: 4px 10px; border-radius: 8px; font-size: 12px; background: hsl(var(--muted)); color: hsl(var(--foreground));
}
.st-mpop-chip[aria-pressed='true'] { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.st-mpop-chip:disabled, .st-mpop-item:disabled { opacity: .4; cursor: not-allowed; }
.st-mpop-item { display: block; width: 100%; text-align: left; }
.st-mpop-hint { margin-top: 6px; font-size: 11px; line-height: 1.4; color: hsl(var(--muted-foreground)); }
```

- [ ] **Step 4: Wire the lane**
  - **Strip:**
    - Reserve the lane. Measure `<div>`s and placeholders start at `top: REP_H` with `height: height - REP_H`, and the `MiniStave`'s `height` becomes `height - REP_H`.
    - Offset hit-test y by `REP_H` wherever staff coordinates are compared with container coordinates (`hitAt` and `highlight`).
    - Replace the bracket block with `<RepeatLane bands={repeatBands(measures, videoTimeToX)} onBandClick={onRepeatBandClick} />`.
    - Add the prop `onRepeatBandClick?: (band: RepeatBand, anchor: PopoverAnchor) => void`.
    - Remove the old `repeatSpans` import if nothing else uses it.
  - **`IntegratedEditor`:**
    - State: `const [repeatPop, setRepeatPop] = useState<{ anchor: PopoverAnchor } | null>(null);`.
    - `onRepeatBandClick = (b, anchor) => { selectMeasureRange(b.firstIndex, b.lastIndex); setRepeatPop({ anchor }); }`.
    - Render `<RepeatPopover>` inside the strip wrapper (which is `position: relative`) when `repeatPop && rangeStart !== null`. Its props:
      - `range={[rangeStart, rangeEnd]}`
      - `group` = the repeat group containing `rangeStart`, found with `repeatGroups(activeTrack)` (the existing `targetRepeatGroup` logic), as `{ id, count }` or `null`
      - `problemFor(n)`:
        - with a group: `structuralEditProblem(score, { type: 'set-repeat-count', trackIndex: 0, id: group.id, count: n })`
        - without a group: `structuralEditProblem(score, { type: 'repeat-measures', trackIndex: 0, start: rangeStart, end: rangeEnd, count: n, id: 'probe' })`
      - `onPick(n)`: with a group, `dispatch({ type: 'set-repeat-count', trackIndex: 0, id: group.id, count: n })`. Without one, `dispatch({ type: 'repeat-measures', trackIndex: 0, start: rangeStart, end: rangeEnd, count: n, id: newRepeatId() })`, where `newRepeatId` follows the id pattern the existing Repeat panel's Apply button already uses. In both cases, close the popover.
      - `onRemove`: `dispatch({ type: 'unlink-repeat', trackIndex: 0, id: group.id })`, then close.
      - `onSelectPassOne`: `selectMeasureRange(group.start, group.start + group.length - 1)`.
      - `onClose`: `() => setRepeatPop(null)`.
  - Leave the old Repeat panel in the editor bar for now. Task 11 removes it.

- [ ] **Step 5: Test, type-check and commit**

```bash
git add components/playsense-studio app/globals.css
git commit -m "Show each repeat as a lane of passes and edit it from a menu"
```

---

### Task 9: The "+" menu between bars

**Files:**
- Create: `components/playsense-studio/studio/measure/gap-menu.tsx`
- Test: `components/playsense-studio/studio/measure/__tests__/gap-menu.test.tsx`
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx` (the gap button opens the menu instead of inserting; the new-bar flash)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (the menu's actions; `newBars` state)
- Modify: `app/globals.css` (add `@keyframes st-grow` and `.is-new`)

**Interfaces — Produces:**

```ts
export function GapMenu(props: {
  anchor: PopoverAnchor; gap: number; measureCount: number;
  clipCount: number | null;                 // bars on the clipboard, or null
  problems: { empty: string | null; copy: string | null; paste: string | null };
  onEmpty: () => void; onCopyLeft: () => void; onPaste: () => void; onClose: () => void;
}): JSX.Element
```

The strip's `onInsertMeasureAt(gap)` prop becomes `onGapClick(gap: number, anchor: PopoverAnchor)`. `gapProblems` is still used to disable a gap button whose every option is refused.

- [ ] **Step 1: Write the failing test**
  - Mount `GapMenu` with `gap: 2`, `measureCount: 4`, `clipCount: 3`, and all problems null. Assert:
    - the title is `Add between m.2 and m.3`
    - the items read `Empty measure`, `Copy of m.2` and `Paste 3 copied bars`
    - clicking each calls its handler
    - the hint is `New bars take the length of the bar to their left. Later bars move to make room.`
  - With `gap: 4` and `measureCount: 4`, the title is `Add at the end`.
  - With `gap: 0`, `Copy of …` is not shown, because there's no bar to the left.
  - With `clipCount: null`, the paste item is not shown.
  - With `problems.copy` set, that item is disabled and its title is the problem text.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement `gap-menu.tsx`**

```tsx
'use client';

import { ClipboardPaste, Copy, Plus } from 'lucide-react';
import { MeasurePopover, type PopoverAnchor } from './popover';

export function GapMenu({ anchor, gap, measureCount, clipCount, problems, onEmpty, onCopyLeft, onPaste, onClose }: {
  anchor: PopoverAnchor; gap: number; measureCount: number; clipCount: number | null;
  problems: { empty: string | null; copy: string | null; paste: string | null };
  onEmpty: () => void; onCopyLeft: () => void; onPaste: () => void; onClose: () => void;
}) {
  const title = gap >= measureCount ? 'Add at the end' : gap === 0 ? 'Add before m.1' : `Add between m.${gap} and m.${gap + 1}`;
  const item = (label: string, Icon: typeof Plus, problem: string | null, run: () => void) => (
    <button type="button" className="st-mpop-item flex items-center gap-2" disabled={!!problem} title={problem ?? label}
      onClick={() => { run(); onClose(); }}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
  return (
    <MeasurePopover anchor={anchor} title={title} onClose={onClose}
      hint="New bars take the length of the bar to their left. Later bars move to make room.">
      <div className="flex flex-col gap-1">
        {item('Empty measure', Plus, problems.empty, onEmpty)}
        {gap > 0 && item(`Copy of m.${gap}`, Copy, problems.copy, onCopyLeft)}
        {clipCount !== null && item(`Paste ${clipCount} copied bar${clipCount === 1 ? '' : 's'}`, ClipboardPaste, problems.paste, onPaste)}
      </div>
    </MeasurePopover>
  );
}
```

- [ ] **Step 4: Wire it**
  - **Strip:** the gap button's `onClick` calls `onGapClick(gap, { left: x - 10, top: REP_H + 26 })`.
  - **`IntegratedEditor`:**
    - State: `gapPop: { gap: number; anchor: PopoverAnchor } | null`.
    - Render `<GapMenu>` when it's set, with:
      - `onEmpty`: `insertMeasureAt(gap)` (existing)
      - `onCopyLeft`: `dispatch({ type: 'duplicate-measures', trackIndex: 0, start: gap - 1, count: 1 })`
      - `onPaste`: `dispatch({ type: 'paste-measures', trackIndex: 0, index: gap, clip: clipboard })`
    - Problems:
      - `empty`: `gapProblems[gap]`
      - `copy`: the problem for pasting bar `gap - 1` at `gap`, computed with `structuralEditProblem(score, { type: 'paste-measures', trackIndex: 0, index: gap, clip: { measures: [stripCopyTags(activeTrack.measures[gap - 1])], context: contextAt(score, activeTrack, gap - 1), instrument: activeTrack.instrument } })`
      - `paste`: the same check with `clip: clipboard`
    - After each action, select the new bars.
  - **The new-bar flash:**
    - `const [newBars, setNewBars] = useState<Set<number>>(new Set())`.
    - Set it to the inserted indices, and clear it after 400 ms with a `setTimeout` that's cleaned up on unmount.
    - Pass it to the strip, which adds `is-new` to those measure `<div>`s.
    - CSS: `@keyframes st-grow { from { transform: scaleX(.6); opacity: .3; } to { transform: none; opacity: 1; } } .is-new { transform-origin: left center; animation: st-grow .35s cubic-bezier(.2,.8,.2,1); } @media (prefers-reduced-motion: reduce) { .is-new { animation: none; } }`.

- [ ] **Step 5: Test, type-check and commit**

```bash
git add components/playsense-studio app/globals.css
git commit -m "Add an empty bar, a copy of the bar before, or copied bars from the + between bars"
```

---

### Task 10: Bar ▾ menu, tempo marks and the stale-tempo prompt

Imports left per-bar `tempoChange` values that disagree with the lesson tempo (spec §8). Plan 1 made graded play ignore every `tempoChange` for that reason. This task lets the admin set tempo marks on purpose. It also asks them to keep or clear imported marks that differ from the lesson tempo, recording the answer as `tempoMarksConfirmed`. Plan 5 honours `tempoChange` only in confirmed scores.

**Files:**
- Create: `lib/playsense-studio/tempo-marks.ts`
- Create: `components/playsense-studio/studio/measure/bar-popover.tsx`
- Create: `components/playsense-studio/studio/tempo-marks-notice.tsx`
- Test: `lib/playsense-studio/__tests__/tempo-marks.test.ts`, `components/playsense-studio/studio/measure/__tests__/bar-popover.test.tsx`
- Modify: `components/playsense-studio/shared/score-model/types.ts` (`ScoreDocument` gains `tempoMarksConfirmed?: boolean`, with a doc comment)
- Modify: `components/playsense-studio/shared/score-model/serialization.ts` (`scoreDocumentSchema` gains `tempoMarksConfirmed: z.boolean().optional()`)
- Modify: `lib/playsense-studio/editor-state.ts` (actions `set-tempo-marks-confirmed` and `clear-tempo-marks`)
- Modify: `components/playsense-studio/studio/score-meta-editor.tsx` (render `<TempoMarksNotice>` under the form)
- Modify: `components/playsense-studio/studio/integrated-editor.tsx` (the Bar ▾ popover state and its actions)

**Interfaces — Produces:**

```ts
// tempo-marks.ts
export interface TempoMark { measureIndex: number; measureNumber: number; bpm: number }
export function tempoMarks(score: ScoreDocument, trackIndex?: number): TempoMark[]
export function tempoAt(score: ScoreDocument, trackIndex: number, measureIndex: number): number
export function unconfirmedTempoMarks(score: ScoreDocument, trackIndex?: number): TempoMark[]

// editor-state.ts
| { type: 'set-tempo-marks-confirmed'; confirmed: boolean }
| { type: 'clear-tempo-marks'; trackIndex: number }

// bar-popover.tsx
export function BarPopover(props: {
  anchor: PopoverAnchor; measureIndex: number; measureNumber: number; percussion: boolean;
  current: { timeSignature: [number, number]; keyFifths: number; clef: 'treble' | 'bass' | 'alto' | 'tenor'; tempo: number;
             repeatStart: boolean; repeatEnd: boolean; double: boolean; final: boolean; volta: '1.' | '2.' | null };
  onPatch: (p: MeasurePropsPatch) => void; onFinal: (final: boolean) => void; onClose: () => void;
}): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { tempoAt, tempoMarks, unconfirmedTempoMarks } from '../tempo-marks';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const doc = (tempos: Array<number | undefined>, confirmed?: boolean): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'musicxml', initialTempo: 96, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tempoMarksConfirmed: confirmed,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'Piano', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: tempos.map((t, i) => ({ number: i + 1, voices: [{ number: 1, events: [] }], ...(t === undefined ? {} : { tempoChange: t }) })) }],
});

describe('tempo marks', () => {
  it('lists bars that carry a mark', () => {
    expect(tempoMarks(doc([undefined, 120, undefined, 100]))).toEqual([
      { measureIndex: 1, measureNumber: 2, bpm: 120 }, { measureIndex: 3, measureNumber: 4, bpm: 100 },
    ]);
  });
  it('the tempo in force walks back to the nearest mark', () => {
    const s = doc([undefined, 120, undefined]);
    expect(tempoAt(s, 0, 0)).toBe(96);
    expect(tempoAt(s, 0, 2)).toBe(120);
  });
  it('unconfirmed marks are the ones that differ from the lesson tempo, until confirmed', () => {
    expect(unconfirmedTempoMarks(doc([undefined, 96, 120]))).toEqual([{ measureIndex: 2, measureNumber: 3, bpm: 120 }]);
    expect(unconfirmedTempoMarks(doc([undefined, 120], true))).toEqual([]);
  });
});
```

Also add these tests:
- **The schema round-trip:** `parseScoreDocument({...valid, tempoMarksConfirmed: true}).tempoMarksConfirmed === true`. Put it in `components/playsense-studio/shared/__tests__/serialization.test.ts`.
- **The reducers** (in `editor-state.test.ts`):
  - `set-tempo-marks-confirmed` sets the flag.
  - `clear-tempo-marks` removes every `tempoChange` on the track and leaves `initialTempo` alone.
- **The `BarPopover` render test:**
  - The title is `Bar m.3`.
  - Clicking `6/8` calls `onPatch({ timeSignature: [6, 8] })`.
  - With `percussion: true`, no key or clef select is rendered.
  - Submitting tempo `132` calls `onPatch({ tempo: 132 })`.
  - The `1st ending` toggle calls `onPatch({ volta: '1.' })`, or `onPatch({ volta: null })` when it's already on.
  - `Final barline` calls `onFinal(true)`.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

`tempo-marks.ts`:

```ts
// PlaySense Studio — per-bar tempo marks (Measure.tempoChange). Imports leave
// marks that disagree with the lesson tempo; graded play ignores tempoChange
// until the admin confirms the marks (score.tempoMarksConfirmed), see spec §8.

import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface TempoMark { measureIndex: number; measureNumber: number; bpm: number }

export function tempoMarks(score: ScoreDocument, trackIndex = 0): TempoMark[] {
  const track = score.tracks[trackIndex];
  if (!track) return [];
  return track.measures.flatMap((m, i) =>
    m.tempoChange === undefined ? [] : [{ measureIndex: i, measureNumber: m.number, bpm: m.tempoChange }]);
}

export function tempoAt(score: ScoreDocument, trackIndex: number, measureIndex: number): number {
  const track = score.tracks[trackIndex];
  let bpm = score.initialTempo;
  for (let i = 0; track && i <= measureIndex && i < track.measures.length; i++) {
    const t = track.measures[i].tempoChange;
    if (t !== undefined) bpm = t;
  }
  return bpm;
}

export function unconfirmedTempoMarks(score: ScoreDocument, trackIndex = 0): TempoMark[] {
  if (score.tempoMarksConfirmed) return [];
  return tempoMarks(score, trackIndex).filter((m) => Math.abs(m.bpm - score.initialTempo) > 0.5);
}
```

Reducer cases:

```ts
case 'set-tempo-marks-confirmed': {
  if (!!state.score.tempoMarksConfirmed === action.confirmed) return state;
  const next = clone(state.score);
  if (action.confirmed) next.tempoMarksConfirmed = true; else delete next.tempoMarksConfirmed;
  return withHistory(state, next);
}
case 'clear-tempo-marks': {
  const next = clone(state.score);
  const track = next.tracks[action.trackIndex];
  if (!track || !track.measures.some((m) => m.tempoChange !== undefined)) return state;
  track.measures.forEach((m) => { delete m.tempoChange; });
  return withHistory(state, next);
}
```

`tempo-marks-notice.tsx`:
- A card shown only when `unconfirmedTempoMarks(score).length > 0`.
- Text: `This score has tempo marks that differ from the lesson tempo (${score.initialTempo} BPM): ${marks.map(m => `m.${m.measureNumber} ♩=${m.bpm}`).join(', ')}. Graded play ignores them until you keep them.`
- Two buttons:
  - `Keep them`: `dispatch({ type: 'set-tempo-marks-confirmed', confirmed: true })`
  - `Clear them`: `dispatch({ type: 'clear-tempo-marks', trackIndex: 0 })`
- Style: `st-icard` plus gold text for the heading `Tempo marks`.
- Render it at the bottom of `ScoreMetaEditor`, which already has `score` and `dispatch`.

`bar-popover.tsx`:
- Build it on `MeasurePopover`. The title is `Bar m.${measureNumber}`, and there's no hint.
- **Time signature from m.N:** chips `2/4 3/4 4/4 5/4 6/8 7/8 12/8 2/2`. The chip matching `current.timeSignature` has `aria-pressed="true"`. A click calls `onPatch({ timeSignature })`.
- **Key & clef** (hidden when `percussion`):
  - A `<select aria-label="Key">` of fifths −7…7, labelled `${keySignatureName(f)} major` (`keySignatureName` from `@/lib/playsense-studio/notation/accidentals`).
  - A `<select aria-label="Clef">` with the options treble, bass, alto, tenor.
  - On change: `onPatch({ keyFifths })` / `onPatch({ clef })`.
- **Barlines & endings** (toggle buttons with `aria-pressed`):
  - `Start repeat`: `repeatStart`
  - `End repeat`: `repeatEnd`
  - `Double barline`: `endBarline: 'double' | null`
  - `Final barline`: `onFinal(!current.final)`
  - `1st ending`: `volta: '1.' | null`
  - `2nd ending`: `volta: '2.' | null`
- **Tempo mark:** a `<form>` with `<input type="number" min={30} max={300} aria-label="Tempo">`, defaulting to `current.tempo`, and a submit button `Set ♩ =`. On submit it calls `onPatch({ tempo: Number(value) })` when the value is 30–300.

`IntegratedEditor`:
- State: `barPop: { anchor: PopoverAnchor } | null`.
- `current` is built for `rangeStart` as follows:
  - `timeSignature`, `keyFifths` and `clef` come from the extracted `tracked[rangeStart]`. Map `clef` to `'treble'` if it's `'percussion'`.
  - `tempo` comes from `tempoAt(score, 0, rangeStart)`.
  - `repeatStart`, `repeatEnd` and `volta` come from the measure.
  - `double` is `measure.endBarline === 'double'`.
  - `final` is `hasFinalBarline(activeTrack.measures, rangeStart)`.
- `onPatch(p)` dispatches `{ type: 'set-measure-props', trackIndex: 0, measureIndex: rangeStart, props: p }`.
- `onFinal(f)` dispatches the existing `set-measure-final-bar`.
- Task 11's measure bar opens it. Until then, nothing opens it, and that's fine inside this branch.

- [ ] **Step 4: Test, type-check and commit**

```bash
git add lib/playsense-studio components/playsense-studio
git commit -m "Edit a bar's meter, key, clef, barlines, endings and tempo, and confirm imported tempo marks"
```

---

### Task 11: The floating measure bar and bar-level keys

**Files:**
- Create: `components/playsense-studio/studio/measure/measure-bar.tsx`, `components/playsense-studio/studio/measure/use-measure-keys.ts`, `components/playsense-studio/studio/measure/shortcuts-popover.tsx`
- Test: `components/playsense-studio/studio/measure/__tests__/measure-bar.test.tsx`, `components/playsense-studio/studio/measure/__tests__/use-measure-keys.test.tsx`
- Modify: `components/playsense-studio/studio/integrated-editor.tsx`:
  - render the bar
  - use the hook
  - remove the old measure buttons, the Repeat panel and their state
  - add the footer "?" button
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx` (report `onSelectionDragChange(dragging)`)
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (pass `onLoopMeasures` and `loopedRange`)
- Modify: `app/globals.css` (add `.st-fbar`)

**Interfaces — Produces:**

```ts
export function MeasureBar(props: {
  left: number; top: number; label: string; startSeconds: number; bpm: number | null; looping: boolean;
  canLoop: boolean; problems: { dup: string | null; paste: string | null; clear: string | null; del: string | null };
  onEdit: () => void; onLoop: () => void; onRepeat: (a: PopoverAnchor) => void; onDup: () => void;
  onCopy: () => void; onPaste: () => void; onBar: (a: PopoverAnchor) => void; onClear: () => void; onDelete: () => void;
}): JSX.Element

export function useMeasureKeys(opts: {
  enabled: boolean; count: number; selection: MeasureSelection | null;
  onSelection: (sel: MeasureSelection | null) => void; onOpen: (index: number) => void;
  onCopy: () => void; onPaste: () => void; onDuplicate: () => void; onDelete: () => void;
}): void

// IntegratedEditor gains props:
onLoopMeasures?: (start: number, end: number) => void;   // loads (or clears, when already looping that range) an A/B loop
loopedRange?: [number, number] | null;                    // which bars the current loop covers, if any
```

- [ ] **Step 1: Write the failing tests**

`use-measure-keys.test.tsx`:
- Mount a tiny component that calls the hook with `vi.fn()` handlers, `count: 6`, `selection: { anchor: 2, focus: 2 }` and `enabled: true`. Also render an `<input>`.
- Dispatch `keydown` on `window` with `new KeyboardEvent('keydown', { key, metaKey, shiftKey, bubbles: true })` and assert:
  1. `ArrowRight` calls `onSelection({ anchor: 3, focus: 3 })`.
  2. ⇧`ArrowRight` calls `onSelection({ anchor: 2, focus: 3 })`.
  3. `Enter` calls `onOpen(2)`.
  4. ⌘`c`, ⌘`v` and ⌘`d` call `onCopy`, `onPaste` and `onDuplicate`, and ⌘`d`'s default is prevented.
  5. `Backspace` calls `onDelete`.
  6. `Escape` calls `onSelection(null)`.
  7. **Review Focus 3:** with the `<input>` focused, a `Backspace` dispatched on the input (`input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))`) does not call `onDelete`, and `ArrowLeft` on it does not call `onSelection`.
  8. With `enabled: false`, nothing fires.
  9. With `selection: null`, `Backspace`, `Enter` and ⌘`c` do nothing, and `ArrowRight` selects bar 0.

`measure-bar.test.tsx`:
- Render with `label: 'm.2–3'`, `startSeconds: 12.34`, `bpm: 96.4` and all problems null.
- Assert the info reads `m.2–3`, `0:12.3` and `≈96.4 BPM`, and that the buttons appear in order with these accessible names: `Edit`, `Loop`, `Repeat`, `Duplicate`, `Copy`, `Paste`, `Bar properties`, `Clear`, `Delete`.
- With `problems.del` set, `Delete` is disabled and its title is the problem.
- With `looping: true`, `Loop` has `aria-pressed="true"`.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

`use-measure-keys.ts`:

```ts
'use client';

// Bar-level keys in the strip: ←/→ move the selection (⇧ extends), ⏎ opens,
// ⌘C/⌘V/⌘D copy, paste after and duplicate, ⌫ deletes, Esc clears. Off while a
// note is selected (note keys own the arrows then) and while typing anywhere.

import { useEffect, useRef } from 'react';
import { isTypingTarget } from '@/lib/playsense-studio/typing-target';
import { selectionBounds, stepSelection, type MeasureSelection } from '@/lib/playsense-studio/measure-selection';

export function useMeasureKeys(opts: {
  enabled: boolean; count: number; selection: MeasureSelection | null;
  onSelection: (sel: MeasureSelection | null) => void; onOpen: (index: number) => void;
  onCopy: () => void; onPaste: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const o = ref.current;
      if (!o.enabled || e.altKey || isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const bounds = selectionBounds(o.selection);
      if (!mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        o.onSelection(stepSelection(o.selection, e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey, o.count));
        return;
      }
      if (e.key === 'Escape' && o.selection) { e.preventDefault(); o.onSelection(null); return; }
      if (!bounds) return;
      if (!mod && e.key === 'Enter') { e.preventDefault(); o.onOpen(bounds[0]); return; }
      if (!mod && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); o.onDelete(); return; }
      if (mod && !e.shiftKey) {
        const k = e.key.toLowerCase();
        if (k === 'c') { e.preventDefault(); o.onCopy(); }
        else if (k === 'v') { e.preventDefault(); o.onPaste(); }
        else if (k === 'd') { e.preventDefault(); o.onDuplicate(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
```

First move `isTypingTarget` out of `integrated-editor.tsx` into `lib/playsense-studio/typing-target.ts`, unchanged, because importing it from the editor would be circular. Re-export it from `integrated-editor.tsx`, so `sync-panel.tsx`'s existing import keeps working.

`measure-bar.tsx`:
- `'use client'`.
- A `<div className="st-fbar" role="toolbar" aria-label="Selected bars" style={{ left, top }}>`, with `transform: translateX(-50%)` in the CSS.
- First an info span (mono, 11 px) containing: `label`; the start time formatted as `m:ss.s`; and, when `bpm !== null`, `≈${bpm.toFixed(1)} BPM` with the title `Tempo these bars play at`.
- Then these buttons, in order, each with an `aria-label`, a `title` and a lucide icon:

  | Button | Icon | Title / label | Notes |
  |---|---|---|---|
  | `Edit` | `Maximize2` | title `Zoom in (⏎)` | |
  | `Loop` | `Repeat1` | `aria-pressed={looping}` | disabled with the title `Play the video to loop` when `!canLoop` |
  | `Repeat` | `Repeat` | visible text `Repeat ▾` | calls `onRepeat({ left, top: top + 40 })` |
  | `Duplicate` | `CopyPlus` | title `Duplicate (⌘D)` | |
  | `Copy` | `Copy` | title `Copy (⌘C)` | |
  | `Paste` | `ClipboardPaste` | title `Paste after (⌘V)` | |
  | `Bar properties` | `SlidersHorizontal` | visible text `Bar ▾`, title `Time, key, clef, tempo, barlines` | |
  | separator | | | |
  | `Clear` | `Eraser` | title `Empty these bars, keep their timing` | |
  | `Delete` | `Trash2` | title `Delete (⌫)` | |

- When a problem is set, its button is disabled and the problem becomes its title.

CSS:

```css
.st-fbar {
  position: absolute; z-index: 45; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 12px;
  transform: translateX(-50%); background: hsl(var(--card)); border: 1px solid hsl(var(--border));
  box-shadow: 0 14px 36px rgba(0,0,0,.5); animation: st-pop .16s cubic-bezier(.2,.8,.2,1); white-space: nowrap;
}
.st-fbar button { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border-radius: 8px; font-size: 12px; }
.st-fbar button:hover:not(:disabled) { background: hsl(var(--muted)); }
.st-fbar button:disabled { opacity: .4; cursor: not-allowed; }
.st-fbar button[aria-pressed='true'] { color: hsl(var(--primary)); }
.st-fbar .st-fbar-info { padding: 0 8px; font: 11px var(--font-mono, ui-monospace, monospace); color: hsl(var(--muted-foreground)); }
@media (prefers-reduced-motion: reduce) { .st-fbar { animation: none; } }
```

`shortcuts-popover.tsx`:
- A `MeasurePopover` with the title `Strip shortcuts` and a two-column list:
  - `Click a bar` → `select it`
  - `Drag across bars` → `select several`
  - `⇧-click` → `extend the selection`
  - `Double-click or ⏎` → `zoom in`
  - `← →` → `move the selection (⇧ extends)`
  - `⌘C ⌘V ⌘D` → `copy, paste after, duplicate`
  - `⌫` → `delete bars`
  - `Esc` → `deselect`
  - `Scroll` → `zoom · ⇧-scroll pans`

- [ ] **Step 4: Wire it into `IntegratedEditor` and `SyncPanel`**
  - **SyncPanel:**
    - Generalise `loopSelectedMeasure` into:
      ```ts
      const loopMeasures = useCallback((start: number, end: number) => {
        const a = markers.measures[start]?.beats[0]?.videoTimeSeconds;
        const b = markers.measures[end + 1]?.beats[0]?.videoTimeSeconds ?? markers.tailVideoTimeSeconds;
        if (a === undefined || b <= a) return;
        if (clock.loopEnabled && clock.loopA !== null && Math.abs(clock.loopA - a) < 1e-3 && clock.loopB !== null && Math.abs(clock.loopB - b) < 1e-3) clock.clearLoop();
        else clock.loadLoop(a, b);
      }, [markers, clock]);
      ```
    - Derive `loopedRange` from `clock.loopEnabled`/`loopA`/`loopB` by finding the bars whose downbeats match. If none match, it's `null`.
    - Pass both to `IntegratedEditor`. Keep the context bar's existing loop button, calling `loopMeasures` for the selected marker's bar.
  - **`IntegratedEditor`:**
    - `const [selDragging, setSelDragging] = useState(false)`, fed by the strip's new `onSelectionDragChange` prop. The strip calls it with `true` when a selection drag starts and `false` when it ends.
    - Compute the bar's position:
      ```ts
      const bounds = selectionBounds(measureRange);
      const barPos = bounds && !selected && !selDragging ? (() => {
        const a = measureTimings[bounds[0]], b = measureTimings[bounds[1]];
        if (!a || !b) return null;
        const l = a.startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
        const r = b.endVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
        if (r < 0 || l > viewportWidth) return null;
        const center = Math.max(170, Math.min(viewportWidth - 170, (l + r) / 2));
        return { left: center, top: Math.min(staffHeight - 44, REP_H + (staffHeight - REP_H) / 2 + 56) };
      })() : null;
      ```
    - For `bpm`, sum `measureLengthInQN(tracked[i].timeSignature)` over the selection, divide by `(end − start)` seconds and multiply by 60. It's `null` when the duration is 0.
    - The handlers:
      - `onEdit`: `openMeasure(bounds[0])`
      - `onLoop`: `onLoopMeasures?.(bounds[0], bounds[1])`
      - `onRepeat`: `setRepeatPop({ anchor })`
      - `onDup`: `dispatch({ type: 'duplicate-measures', trackIndex: 0, start: bounds[0], count })`, then select the copies
      - `onCopy`: the existing `copyRange`, then a notice `Copied m.A–B with its timing.`
      - `onPaste`: the existing `pasteAfterRange`
      - `onBar`: `setBarPop({ anchor })`
      - `onClear`: `dispatch({ type: 'clear-measures', trackIndex: 0, start: bounds[0], count })`, then a notice `Cleared. Timing kept.`
      - `onDelete`: the existing `deleteRange`
    - Notices use the existing `notice` line (the `notice` prop) if it can take local messages. Otherwise add a small local `flash` state that shows under the editor bar and clears after 2.5 s.
    - The problems:
      - `dup`: the `paste-measures` problem for those bars at `bounds[1] + 1`
      - `paste`: the existing `pasteProblem`
      - `clear`: `null`
      - `del`: the existing `deleteProblem`
    - Call `useMeasureKeys({ enabled: selected === null, count: measureCount, selection: measureRange, onSelection: (s) => { setSelected(null); setMeasureRange(s); }, onOpen: openMeasure, onCopy: copyRange, onPaste: pasteAfterRange, onDuplicate: dup, onDelete: deleteRange })`.
  - **Remove the duplicates of the new controls:**
    - the measure-range parts of the Esc/Delete keydown effect. Keep the note parts: Esc clears the selected note, and ⌫ deletes the selected note.
    - the ⌘C/⌘V keydown effect
    - the Shift/range arrow branch inside the main entry keydown effect. Keep note walking.
    - the editor bar's Delete-measures, Copy and Paste buttons
    - the Repeat toggle and the whole Repeat panel, with `repeatOpen`/`repeatStart`/`repeatEnd`/`repeatCount` and its follow-range effect
    - the Double bar toggle
  - Add a `?` button to the footer from Task 6 (`className="ml-auto grid h-6 w-6 place-items-center rounded-full border border-border text-[11px]"`, `aria-label="Keyboard shortcuts"`), which opens `ShortcutsPopover`.

- [ ] **Step 5: Run the tests and suites, type-check, and commit**

```bash
git add lib/playsense-studio components/playsense-studio app/globals.css
git commit -m "Float a measure bar over the selection and move bar-level keys into one place"
```

---

### Task 12: Drag a section along the video

**Files:**
- Create: `lib/playsense-studio/section-drag.ts`
- Test: `lib/playsense-studio/__tests__/section-drag.test.ts`
- Modify: `components/playsense-studio/sync/sections-lane.tsx` (the active block is draggable)
- Modify: `components/playsense-studio/studio/sync-panel.tsx` (shift the markers during the drag)
- Modify: `app/globals.css` (cursor and drag styles on `.st-section-block`)

**Interfaces — Produces:**

```ts
export function clampSectionShift(
  span: { startSeconds: number; endSeconds: number },
  corridor: { lo: number; hi: number },
  videoDurationSeconds: number | null,
  delta: number
): number
// SectionsLaneProps gains:
onDragActive?: (deltaSeconds: number, phase: 'move' | 'end') => void;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { clampSectionShift } from '../section-drag';

const span = { startSeconds: 20, endSeconds: 30 };
describe('clampSectionShift (Review Focus 5)', () => {
  it('moves freely inside open space', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 100, 5)).toBe(5);
  });
  it('stops at the next section', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: 33 }, 100, 10)).toBe(3);
  });
  it('stops at the previous section', () => {
    expect(clampSectionShift(span, { lo: 18, hi: Infinity }, 100, -10)).toBe(-2);
  });
  it('never goes before 0 s or past the end of the video', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 100, -50)).toBe(-20);
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 32, 50)).toBe(2);
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, null, 500)).toBe(500);
  });
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

```ts
// PlaySense Studio — how far a scored section may be dragged along the video:
// never into a neighbouring section, before 0 s, or past the video's end.

export function clampSectionShift(
  span: { startSeconds: number; endSeconds: number },
  corridor: { lo: number; hi: number },
  videoDurationSeconds: number | null,
  delta: number
): number {
  const min = Math.max(corridor.lo, 0) - span.startSeconds;
  const max = Math.min(corridor.hi, videoDurationSeconds ?? Infinity) - span.endSeconds;
  return Math.max(min, Math.min(max, delta));
}
```

**`SectionsLane`:**
- The active block gets `onPointerDown`, `onPointerMove` and `onPointerUp`, with pointer capture and a 4 px dead zone. Report `(clientX − startX) / pixelsPerSecond` as `onDragActive(delta, 'move')`, and send `'end'` on release.
- A drag must not also fire the block's `onSelectSection` click. Ignore the click that follows a drag.
- CSS: the active block gets `cursor: grab` (and `grabbing` while dragging).
- Its title is `Drag to move this section`.

**`SyncPanel`** (only when `showSync && sectionsContext`):

```ts
const sectionDragBase = useRef<MarkerState | null>(null);
const onSectionDrag = useCallback((delta: number, phase: 'move' | 'end') => {
  const base = sectionDragBase.current ?? markersRef.current;
  sectionDragBase.current = base;
  const first = base.measures[0];
  if (first) {
    const shift = clampSectionShift(markerSpan(base), corridorRef.current, videoDurationSeconds ?? null, delta);
    setMarkers(shiftMarkersFrom(base, { measureNumber: first.measureNumber, beatInMeasure: 1 }, shift));
  }
  if (phase === 'end') {
    sectionDragBase.current = null;
    setDirty(true);
  }
}, [videoDurationSeconds]);
```

- Pass `onDragActive={onSectionDrag}` to `SectionsLane`. `corridorRef` and `markersRef` already exist.
- `corridor` is computed from the live markers, so it can move during the drag. Compute the clamp from `freeCorridor(markerSpan(base), siblingRanges)` captured at drag start, and store it next to `sectionDragBase`.
- Add a unit test for this wiring only if a pure helper falls out. The clamp is the tested core.

- [ ] **Step 4: Test, type-check and commit**

```bash
git add lib/playsense-studio components/playsense-studio app/globals.css
git commit -m "Drag a scored section along the video without running into its neighbours"
```

---

### Task 13: Event ids stay unique and slurs never point at missing notes

Carried forward from Plan 1 (roadmap, "P3 — Wiring"):
- `ensureEventIds` runs when a score opens and replaces duplicate ids.
- Paste, repeat, duplicate and append give copied events new ids.
- Append merges `spans`, and deleting events removes spans that point at them.
- `MeasureClip.spans` is renamed so it can't be confused with `ScoreDocument.spans`.
- Tuplet group ids carry the per-import token.

**Files:**
- Modify: `lib/playsense-studio/event-ids.ts` (add `newEventId`, `reidMeasures`, `passEventId`, `withPassIds`)
- Modify: `components/playsense-studio/shared/score-model/accessors.ts` (`ensureEventIds` also replaces duplicates)
- Modify: `lib/playsense-studio/editor-state.ts`:
  - `useEditor` init and `replace-score` use `initialEditorState`, which is exported
  - `add-note`/`add-rest` assign ids
  - `delete-event` and `delete-measures` prune spans
  - `withHistory` propagation uses `withPassIds`
- Modify: `lib/playsense-studio/measure-edits.ts`:
  - `MeasureClip.spans` → `timing`; add `notationSpans?: Span[]`
  - `paste-measures`, `append-score`, `repeat-measures` and `set-repeat-count` re-id their copies
- Modify: `components/playsense-studio/sync/structural-timing.ts` (`clipFromMeasures` fills `timing` and `notationSpans`; the paste case reads `clip.timing`)
- Modify: `lib/playsense-studio/measure-clipboard.ts` (copy `timing` and `notationSpans`)
- Modify: `lib/playsense-studio/parsers/musicxml.ts` (tuplet ids use the per-import token)
- Test: `lib/playsense-studio/__tests__/event-ids.test.ts` (new), plus updates to `score-model-additions.test.ts`, `editor-state.test.ts`, `measure-edits.test.ts`, `measure-clipboard.test.ts` and `structural-timing.test.ts` where they build clips with `spans`

**Interfaces — Produces:**

```ts
export function newEventId(): string                              // 'e' + 8 random base-36 chars
export function passEventId(id: string, pass: number): string    // base id for pass 0, `${base}~${pass}` otherwise
export function withPassIds(measure: Measure, pass: number): Measure  // event ids and tuplet ids rewritten for that pass
export function reidMeasures(measures: Measure[], spans: Span[] | undefined, makeId?: () => string):
  { measures: Measure[]; spans: Span[] }                          // fresh ids; spans with both ends inside are copied and remapped
export function pruneSpans(score: ScoreDocument): ScoreDocument['spans']   // from Task 7
export function initialEditorState(score: ScoreDocument): EditorState      // in editor-state.ts
```

- [ ] **Step 1: Write the failing tests** (`event-ids.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import type { Measure, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { passEventId, pruneSpans, reidMeasures, withPassIds } from '../event-ids';
import { ensureEventIds } from '@/components/playsense-studio/shared/score-model/accessors';
import { initialEditorState } from '../editor-state';

const bar = (ids: string[], tuplet?: string): Measure => ({
  number: 1,
  voices: [{ number: 1, events: ids.map((id) => ({ kind: 'note' as const, id, midi: 60, durationQN: 1, ...(tuplet ? { tuplet: { id: tuplet, n: 3, m: 2 } } : {}) })) }],
});
const doc = (measures: Measure[], spans?: ScoreDocument['spans']): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0, spans,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff', measures }],
});

describe('event ids', () => {
  it('ensureEventIds replaces duplicates and keeps the first', () => {
    let n = 0;
    const out = ensureEventIds(doc([bar(['a', 'a', 'b'])]), () => `n${++n}`);
    expect(out.tracks[0].measures[0].voices[0].events.map((e) => e.id)).toEqual(['a', 'n1', 'b']);
  });
  it('opening an old score assigns ids without marking it dirty (Review Focus 1)', () => {
    const s = initialEditorState(doc([{ number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] }]));
    expect(s.isDirty).toBe(false);
    expect(s.past).toEqual([]);
    expect(s.score.tracks[0].measures[0].voices[0].events[0].id).toMatch(/^e/);
  });
  it('re-ids copies and carries the slurs inside them', () => {
    let n = 0;
    const { measures, spans } = reidMeasures([bar(['a', 'b'], 'T')], [
      { id: 's1', type: 'slur', from: 'a', to: 'b' },
      { id: 's2', type: 'slur', from: 'b', to: 'zz' },
    ], () => `k${++n}`);
    const ids = measures[0].voices[0].events.map((e) => e.id);
    expect(ids).not.toContain('a');
    expect(new Set(measures[0].voices[0].events.map((e) => e.tuplet?.id)).size).toBe(1);
    expect(measures[0].voices[0].events[0].tuplet?.id).not.toBe('T');
    expect(spans).toHaveLength(1);
    expect([spans[0].from, spans[0].to]).toEqual(ids);
    expect(spans[0].id).not.toBe('s1');
  });
  it('repeat passes get stable, distinct ids', () => {
    expect(passEventId('a', 0)).toBe('a');
    expect(passEventId('a', 2)).toBe('a~2');
    expect(passEventId('a~2', 1)).toBe('a~1');
    const p2 = withPassIds(bar(['a', 'b'], 'T'), 2);
    expect(p2.voices[0].events.map((e) => e.id)).toEqual(['a~2', 'b~2']);
    expect(p2.voices[0].events[0].tuplet?.id).toBe('T~2');
  });
  it('prunes spans that lost an end', () => {
    expect(pruneSpans(doc([bar(['a'])], [{ id: 's', type: 'slur', from: 'a', to: 'gone' }]))).toEqual([]);
  });
});
```

Also add reducer tests in `editor-state.test.ts`:
- `add-note` gives the new note an id.
- `delete-event` of a slur's end removes that slur.
- `paste-measures` of a bar with ids `['a','b']` into the same score gives the pasted bar different ids, and its slur is copied with remapped ends.
- `repeat-measures` over a bar with id `a` produces ids `a` and `a~1`.
- Editing a note's pitch in pass 2 keeps pass 1's id `a` and pass 2's id `a~1`.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**
  - **`event-ids.ts`:**
    - `newEventId = () => 'e' + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 8)`.
    - `passEventId(id, pass)`: `const base = id.replace(/~\d+$/, ''); return pass === 0 ? base : \`${base}~${pass}\`;`.
    - `withPassIds(measure, pass)`: deep-clone the measure and map every event's `id` and `tuplet.id` through `passEventId`. Chord `notes` have no ids.
    - `reidMeasures(measures, spans, makeId = newEventId)`:
      - Deep-clone the measures.
      - Build `idMap` (old → new) for every event with an id, and give events without one a new id.
      - Build `tupletMap` (old group id → new `t…` id) so every member of a group gets the same new id.
      - Return the clones, plus a copy of each span whose `from` and `to` are both in `idMap`, with a new span id (`'s' + makeId().slice(1)`) and remapped ends.
  - **`accessors.ts` `ensureEventIds`:**
    - Track the ids already seen. An event with no id, or with a repeated id, gets `makeId()`.
    - If nothing changed, return the input by identity (the existing test).
    - Update its doc comment to say duplicates are replaced too.
  - **`editor-state.ts`:**
    - Export `initialEditorState(score) → { score: ensureEventIds(clone(score), newEventId), past: [], future: [], isDirty: false }`, and use it in `useEditor`'s initializer.
    - `replace-score` does the same, keeping its existing history clearing.
    - `add-note`/`add-rest` literals get `id: newEventId()`.
    - After `delete-event` and after the structural `delete-measures`, set `next.spans = pruneSpans(next)` when `spans` is defined.
    - In `withHistory`'s propagation, the copied content for a measure whose pass is `m.repeat.pass` becomes `withPassIds({ ...clone(content), number: m.number, repeat: m.repeat }, m.repeat.pass)`.
  - **`measure-edits.ts`:**
    - Rename `MeasureClip.spans` to `timing` and add `notationSpans?: Span[]`.
    - In `paste-measures`, `const { measures: pasted, spans: copied } = reidMeasures(clip.measures.map(stripOverrides), clip.notationSpans)`, then `if (copied.length) next.spans = [...(next.spans ?? []), ...copied]`.
    - In `append-score`, re-id `bars` together with `action.score.spans` in the same way.
    - In `repeat-measures`, pass `p` copies use `withPassIds(clone(m), pass)`.
    - In `set-repeat-count`, the added passes do the same with their pass number.
  - **`structural-timing.ts`:**
    - `clipFromMeasures` returns `timing: copyMeasureSpans(...)` and `notationSpans: (score.spans ?? []).filter(s => ids.has(s.from) && ids.has(s.to))`, where `ids` is every event id in the copied bars.
    - The paste case reads `action.clip.timing`.
  - **`measure-clipboard.ts`:** copy `timing` and `notationSpans` (deep clone) instead of `spans`.
  - **`parsers/musicxml.ts`:**
    - Find the per-import token that event ids are built from (search for where note `id`s are assigned).
    - Build tuplet group ids as `${token}-t${idx + 1}-${voiceId}-${events.length}`, so two imports never share a tuplet id.
    - Update any parser test that asserts the old tuplet id shape.

- [ ] **Step 4: Run all of `lib/playsense-studio` and `components/playsense-studio`, fix any tests that used `clip.spans`, type-check, and commit**

```bash
git add lib/playsense-studio components/playsense-studio
git commit -m "Keep event ids unique across opens, copies and repeat passes, and drop slurs that lose a note"
```

---

### Task 14: One continuous staff across the visible bars

Roadmap P3, "Measure strip": the strip becomes one continuous SVG across the visible range, so slurs, hairpins and ties cross barlines in the Studio just as they do for students. The bars keep their time-proportional widths. Bars under 46 px still show the dashed placeholder, and bars of 46–110 px draw without dynamics or text.

**Files:**
- Create: `lib/playsense-studio/render-window.ts`
- Create: `components/playsense-studio/studio/continuous-staff.tsx`
- Test: `lib/playsense-studio/__tests__/render-window.test.ts`, `components/playsense-studio/studio/__tests__/continuous-staff.test.tsx`
- Modify: `components/playsense-studio/studio/editable-measure-strip.tsx`:
  - render one `ContinuousStaff` under the measure overlays
  - delete `MiniStave` and its per-measure SVG
  - the measure `<div>`s stay as transparent overlays for selection, hits and the header band

**Interfaces — Produces:**

```ts
export interface RenderWindow { start: number; end: number }   // content px (time × pps)
export function renderWindow(scrollLeft: number, viewportWidth: number, prev: RenderWindow | null): RenderWindow
export function ContinuousStaff(props: {
  items: MeasureStripItem[]; pixelsPerSecond: number; scrollLeftPx: number; viewportWidth: number;
  height: number; spans?: Span[]; onHitsReady: (measureIndex: number, hits: MeasureHit[]) => void;
}): JSX.Element
```

`renderWindow` returns `[scrollLeft − W, scrollLeft + 2W]`, where `W` is the viewport width. It keeps `prev` while the visible range stays at least `W/3` inside it and the width is unchanged. That way scrolling moves the SVG with a CSS transform and redraws only when the window has to move. This follows the "VexFlow cost" risk in spec §14.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { renderWindow } from '../render-window';

describe('renderWindow', () => {
  it('covers a viewport either side', () => {
    expect(renderWindow(1000, 500, null)).toEqual({ start: 500, end: 2000 });
  });
  it('keeps the window while the view stays well inside it', () => {
    const w = renderWindow(1000, 500, null);
    expect(renderWindow(1100, 500, w)).toBe(w);
    expect(renderWindow(900, 500, w)).toBe(w);
  });
  it('moves once the view nears an edge or the width changes', () => {
    const w = renderWindow(1000, 500, null);
    expect(renderWindow(1400, 500, w)).toEqual({ start: 900, end: 2400 });
    expect(renderWindow(1000, 600, w)).toEqual({ start: 400, end: 2200 });
  });
});
```

`continuous-staff.test.tsx` (jsdom, with the canvas `measureText` stub):
- Build two `MeasureStripItem`s from `extractTrackEvents` on a small track: bar 1 has notes with ids `a`, `b`; bar 2 has notes with ids `c`, `d`. Times are `[0,2]` and `[2,4]` s, with `pixelsPerSecond: 150`.
- **(1)** Rendering with `spans: [{ id: 's', type: 'slur', from: 'b', to: 'c' }]` draws more `path` elements than rendering with no spans.
- **(2)** `onHitsReady` is called for both measures, with hit x values relative to each bar's start (every `hit.x < 300`).
- **(3)** Re-rendering with `scrollLeftPx` changed from 0 to 40 keeps the same `<svg>` node (it isn't redrawn) and changes the wrapper's `transform`.

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement**

`render-window.ts`:

```ts
// PlaySense Studio — which slice of the timeline the continuous staff draws:
// one viewport either side of the visible range, kept until the view drifts
// within a third of a viewport of its edge (so scrolling rarely redraws).

export interface RenderWindow { start: number; end: number }

export function renderWindow(scrollLeft: number, viewportWidth: number, prev: RenderWindow | null): RenderWindow {
  const w = Math.max(1, viewportWidth);
  if (prev && prev.end - prev.start === 3 * w && scrollLeft - prev.start >= w / 3 && prev.end - (scrollLeft + w) >= w / 3) return prev;
  return { start: scrollLeft - w, end: scrollLeft + 2 * w };
}
```

`continuous-staff.tsx`:
- Keep `const win = useRef<RenderWindow | null>(null)`, and each render compute `const next = renderWindow(scrollLeftPx, viewportWidth, win.current); win.current = next;`.
- Render `<div className="pointer-events-none absolute left-0" style={{ top: REP_H, height: height - REP_H, width: next.end - next.start, transform: \`translateX(${next.start - scrollLeftPx}px)\` }} ref={hostRef} />`.
- In a `useEffect` keyed on `[next.start, next.end, pixelsPerSecond, items, spans, height]`, clear `hostRef` and draw into one `Renderer(hostRef.current, Renderer.Backends.SVG)` sized `(next.end − next.start) × (height − REP_H)`:
  - **Measure loop.** For each item where `x0 = start × pps − next.start` and `x1 = end × pps − next.start` overlap `[0, next.end − next.start]`, and `x1 − x0 >= 46`:
    - Build `new Stave(x0, staveY, x1 − x0)`, where `staveY` centres the staff exactly as `MiniStave` did.
    - Apply `applyStaveHeader(stave, staveHeader(item, { opening: item.isFirst, rowStart: false }))`, then set the final barline (`BarlineType.END`) when `item.finalBarline`, as `MiniStave` did.
    - Draw the stave.
    - **Bare mode:** if `x1 − x0 < 110`, build from descriptors with `dynamic` and `text` removed (`events.map(({ dynamic: _d, text: _t, ...d }) => d)`).
    - `buildMeasure([events, voice2Events], ts, clef)`, then `formatMeasure(built, Math.max(20, stave.getNoteEndX() − stave.getNoteStartX() − 8))`, then `drawMeasure(ctx, stave, built)`.
    - Push voice-1 notes, then voice-2 notes, into `placed: PlacedNote[]` (`system: 0`, `id`, `hasDynamic`).
    - Record hits, relative to the bar: `vexNotes.map((n, i) => { const bb = n.getBoundingBox(); return { eventIndex: i, x: bb.getX() − x0, y: bb.getY() + REP_H, w: bb.getW(), h: bb.getH() }; })`, and call `onHitsReady(item.measureIndex, hits)`.
  - **Ties.** Draw them across neighbouring drawn bars with the same `scoreTieIndices` + `StaveTie` logic `MiniStave` used. Now both ends are in one SVG, so a tie across a barline is one `StaveTie` with both notes set, not two partial ties.
  - **Spans.** `drawSpanSegments(ctx, spanSegments(spans, placed))`.
  - Re-theme the SVG with the same `themeVexflowSvg` call `MiniStave` made.
  - Wrap each bar's work in `try { … } catch { /* a bar VexFlow can't lay out is skipped */ }` as `MiniStave` did.

**The strip:**
- Remove `MiniStave` and its props interface.
- Render `<ContinuousStaff items={measures} … onHitsReady={handleHitsReady} />` once, before the measure overlays.
- The overlays keep their positions, header bands, selection rings, hits and gap fills. They stop rendering any SVG.
- The narrow placeholder button for bars under 46 px is unchanged.

- [ ] **Step 4: Run all suites, type-check, and commit**

Run: `npx vitest run --exclude '.worktrees/**'` and `npx tsc --noEmit -p .`.

```bash
git add lib/playsense-studio components/playsense-studio
git commit -m "Draw the Studio strip as one continuous staff so slurs, hairpins and ties cross barlines"
```

---

### Task 15: Roadmap, and hand the browser checks to the user

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md`

- [ ] **Step 1: Update the roadmap**
  - Under "## Plan 3", add `**3a done YYYY-MM-DD** (shell, strip selection, beat counts, measure bar, repeat/gap/Bar menus, tempo-mark confirmation, section drag, event ids, continuous staff). 3b — measure zoom and note editing — follows.`
  - Replace the Plan 3 bullets that 3a delivered with a "**Plan 3b** (next)" list:
    - the measure zoom (the animation, slivers, beat bands, fill meter)
    - the floating note toolbar and the More ▾ tabs
    - the full keyboard map
    - V1/V2 editing
    - drag to change pitch, moved from the strip into the zoom
    - pencil click-to-add
    - span editing (slur, cresc/dim), with span mirroring across repeat passes via `passEventId`
    - tuplet group editing consistency
    - beam grouping for additive meters
    - the legacy triplet `[8,16,16,8]` grouping
    - the footer hint wording `⏎ edit notes`
  - Under "## Plan 5", add: `Honour Measure.tempoChange only when score.tempoMarksConfirmed is true (P3a added the flag and the keep/clear prompt).`
  - In "Carried forward from Plan 1", mark the P3 items that 3a did as `(done in P3a)`: event-id integrity, the `MeasureClip.spans` rename, and tuplet ids with the import token.

- [ ] **Step 2: Full verification**

Run: `npx vitest run --exclude '.worktrees/**'` (all pass) and `npx tsc --noEmit -p .` (clean).

**Human check (hand off; no dev server needed from the agent).** In `/admin/playsense-studio/<a video lesson>`:
1. The rail opens on hover and closes shortly after leaving. Typing in the Score title keeps it open.
2. The video floats, drags, and shrinks to a pill while still playing.
3. The splitter resizes the waveform, and a double-click resets it.
4. A drag across bars selects them, and the measure bar appears. Loop, Repeat ×3, Duplicate, Clear (then undo), Bar ▾ → 3/4, and Delete all behave as labelled.
5. A short bar shows a gold beat chip and hatched missing time, and the footer chip jumps to it.
6. The "+" menu adds an empty bar and a copy.
7. The active section block drags along the video and stops at its neighbour.
8. A slur crossing a barline draws as one curve.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-23-playsense-studio-rework-roadmap.md
git commit -m "Mark Studio rework plan 3a done and outline 3b"
```
