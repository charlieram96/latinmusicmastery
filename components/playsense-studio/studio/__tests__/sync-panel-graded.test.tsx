// @vitest-environment jsdom
//
// Studio rework P5, Task 6: SyncPanel's graded mode. The canvases, lanes and
// editor are stubbed so the test drives the panel's own wiring: grid bar
// lines from bar 1 (locked), the bar 1 drag with snap, Auto-align, the
// count-in / pre-roll controls and the "notes on a hit" readout.
import { act, StrictMode, type ReactNode, type ComponentProps } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DragFn = (delta: number, phase: 'move' | 'end', mods?: { snap: boolean }) => void;
const stub = vi.hoisted(() => ({
  canvas: null as null | {
    handles: Array<{ videoTimeSeconds: number; isDownbeat: boolean }>;
    markersLocked?: boolean;
    onBackgroundDrag?: DragFn;
    metronomeAnchorSeconds?: number | null;
    flexMode?: boolean;
    flexDeleteMode?: boolean;
    flexAddMode?: boolean;
    onFlexRemove?: (index:number)=>void;
    onMarkerDrag?: (ref:{measureNumber:number;beatInMeasure:number},time:number,mode:'single',mods:{snap:boolean})=>void;
    flexPoints?: Array<{src:number;dst:number;anchor:boolean}>;
    onFlexAddAt?: (seconds:number)=>void;
    onFlexDrag?: (index:number,dst:number,mods:{snap:boolean})=>void;
  },
  lanes: [] as Array<{ sections: Array<{ label: string }>; activeRange: { startSeconds: number; endSeconds: number }; onDragActive?: DragFn }>,
  clickGrid: [] as number[],
  hits: [] as number[],
  editor: null as null | { onQuantizePlan?:unknown; onQuantizeApply?:unknown; onResetFlex?:unknown; flexInfo?:unknown; notice?: string | null; noticeAction?: { label: string; onClick: () => void } | null },
}));

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/playsense-studio/waveform-decode', () => ({
  loadCachedPeaks: async () => ({ version: 1, durationSeconds: 30, bucketCount: 0, sampleRate: 1, data: [], hits: stub.hits }),
  loadOrComputePeaks: vi.fn(async () => ({ version: 1, durationSeconds: 30, bucketCount: 0, sampleRate: 1, data: [], hits: stub.hits })),
}));
vi.mock('@/components/playsense-studio/sync/waveform-canvas', () => ({
  WaveformCanvas: (p: NonNullable<typeof stub.canvas>) => {
    stub.canvas = p;
    return null;
  },
}));
vi.mock('@/components/playsense-studio/sync/sections-lane', () => ({
  SectionsLane: (p: (typeof stub.lanes)[number]) => {
    stub.lanes.push(p);
    return null;
  },
}));
vi.mock('@/components/playsense-studio/studio/integrated-editor', () => ({
  IntegratedEditor: (p: { notice?: string | null; noticeAction?: { label: string; onClick: () => void } | null }) => {
    stub.editor = p;
    return null;
  },
  isTypingTarget: () => false,
}));
vi.mock('@/components/playsense-studio/sync/reference-monitor', () => ({ ReferenceMonitor: (p: {videoMuted?:boolean;onVideoMutedChange?:(m:boolean)=>void}) => <button aria-label="Mute video audio" aria-pressed={p.videoMuted} onClick={()=>p.onVideoMutedChange?.(!p.videoMuted)} /> }));
vi.mock('@/components/playsense-studio/player/transport/transport-bar', () => ({ TransportBar: () => null }));
// Rendering the trigger as-is (no dialog machinery) is enough to check the
// "Add measures from a file" button's own markup (Final review Minor 3).
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({
  ScoreImportDialog: (p: { trigger: ReactNode }) => p.trigger,
}));
vi.mock('@/components/playsense-studio/player/state/use-video-click-track', () => ({ useVideoClickTrack: (p:{grid:number[]}) => {stub.clickGrid=p.grid;} }));

import { SyncPanel } from '../sync-panel';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const quarter = { kind: 'note' as const, durationQN: 1, midi: 60 };
const SCORE = {
  schemaVersion: 1,
  title: 'Graded',
  sourceFormat: 'native',
  initialTempo: 120,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [
    {
      index: 0,
      instrument: 'piano',
      displayName: 'Piano',
      tuning: null,
      stringMultiplicity: 1,
      channel: null,
      defaultView: 'staff',
      measures: [1, 2].map((number) => ({ number, voices: [{ number: 1, events: [quarter, quarter, quarter, quarter] }] })),
    },
  ],
} as unknown as ScoreDocument;
// 120 BPM, 4/4: bars of 2 s, a note every 0.5 s — one loop is 4 s.
const ONSETS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

let host: HTMLDivElement;
let inspectorHost: HTMLDivElement;
let scoreActionsHost: HTMLDivElement;
let root: Root;
const onPlayChange = vi.fn();
const onTimingChange = vi.fn();

async function renderPanel(play = { bar1Seconds: 2 as number | null, countInBars: 1 as 1 | 2, preroll: true }, strict = false, extra: Partial<ComponentProps<typeof SyncPanel>> = {}) {
  const Wrapper = strict ? StrictMode : (({children}: {children:ReactNode}) => <>{children}</>);
  await act(async () => {
    root.render(
      <Wrapper><SyncPanel
        classItemId="ci-1"
        mode="graded"
        publishTarget="exercise"
        videoUrl="https://example.test/play.mp4"
        score={SCORE}
        dispatch={vi.fn()}
        activeTimeMap={{
          // A legacy drag map on the draft: graded mode must ignore it.
          id: 'legacy',
          method: 'drag',
          waypoints: [
            { musicalPositionQN: 0, videoTimeSeconds: 9, measureNumber: 1, beatInMeasure: 1 },
            { musicalPositionQN: 8, videoTimeSeconds: 13, measureNumber: null, beatInMeasure: null },
          ],
        }}
        onTimingChange={onTimingChange}
        videoDurationSeconds={null}
        initialMetronomeAnchorSeconds={7}
        trim={{ trimInSeconds: 1, trimOutSeconds: null }}
        play={play}
        onPlayChange={onPlayChange}
        gradedOnsets={ONSETS}
        inspectorEl={inspectorHost}
        scoreActionsEl={scoreActionsHost}
        {...extra}
      /></Wrapper>
    );
  });
  await act(async () => {}); // the cached-peaks load
}

const downbeats = () => stub.canvas!.handles.filter((h) => h.isDownbeat).map((h) => h.videoTimeSeconds);
const lane = () => stub.lanes.at(-1)!;
const button = (text: string) =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text);
const scoreActionsButton = (text: string) =>
  Array.from(scoreActionsHost.querySelectorAll('button')).find((b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text);
// Placement, anchor, re-analyze and the graded controls (Count-in, Pre-roll,
// the on-hit readout) moved into the left panel's Sync status, which SyncPanel
// renders through `inspectorEl` (Studio layout pass, Task 4).
const inspectorButton = (text: string) =>
  Array.from(inspectorHost.querySelectorAll('button')).find((b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  stub.canvas = null;
  stub.lanes = [];
  stub.editor = null;
  // Hits 10 ms after where the notes land with bar 1 at 3.0.
  stub.hits = ONSETS.map((o) => 3.01 + o);
  onPlayChange.mockReset();
  onTimingChange.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  inspectorHost = document.createElement('div');
  document.body.appendChild(inspectorHost);
  scoreActionsHost = document.createElement('div');
  document.body.appendChild(scoreActionsHost);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  inspectorHost.remove();
  scoreActionsHost.remove();
  vi.useRealTimers();
});

describe('SyncPanel graded mode', () => {
  it('restores Flex and saves anchor edits without moving the score grid', async () => {
    const onFlexChange = vi.fn();
    await renderPanel(undefined,false,{initialFlex:[{src:2,dst:2,anchor:true},{src:3,dst:3,anchor:false},{src:6,dst:6,anchor:true}],onFlexChange});
    const before = downbeats();
    expect(stub.canvas!.flexMode).toBe(false);
    act(()=>button('Flex')!.click());
    act(()=>stub.canvas!.onFlexDrag!(1,3.2,{snap:false}));
    expect(onFlexChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({src:3,dst:3.2})]));
    expect(downbeats()).toEqual(before);
    expect(onPlayChange).not.toHaveBeenCalled();
  });

  it('moves one bar boundary and persists the map with matching metronome beats', async () => {
    await renderPanel();
    act(()=>stub.canvas!.onMarkerDrag!({measureNumber:2,beatInMeasure:1},4.5,'single',{snap:false}));
    expect(downbeats()).toEqual([2,4.5]);
    expect(stub.clickGrid).toContain(4.5);
    act(()=>stub.canvas!.onMarkerDrag!({measureNumber:1,beatInMeasure:2},2.8,'single',{snap:false}));
    expect(stub.clickGrid).toContain(2.8);
    act(()=>vi.advanceTimersByTime(2000));
    expect(onTimingChange).toHaveBeenCalledWith(expect.objectContaining({params:expect.objectContaining({manualScoreSync:true})}));
    expect(onTimingChange.mock.calls.at(-1)![0].waypoints).toEqual(expect.arrayContaining([expect.objectContaining({videoTimeSeconds:2.8})]));
  });

  it('restores an explicitly saved manual map instead of reverting to the BPM grid', async () => {
    await renderPanel(undefined,false,{initialManualTiming:true});
    expect(downbeats()).toEqual([9,11]);
    expect(stub.clickGrid[0]).toBe(9);
  });

  it('exposes the same quantize and local Flex reset tools in exercise Sync',async()=>{
    await renderPanel();
    for(const key of ['onQuantizePlan','onQuantizeApply','onResetFlex','flexInfo'] as const) expect(typeof stub.editor?.[key]).toBe('function');
  });

  it('creates draggable transient anchors with one visible button', async () => {
    const onFlexChange=vi.fn();
    await renderPanel(undefined,false,{onFlexChange});
    act(()=>button('Add transient anchors')!.click());
    expect(stub.canvas!.flexMode).toBe(true);
    expect(onFlexChange).toHaveBeenCalled();
    const points=onFlexChange.mock.calls.at(-1)![0];
    expect(points).toEqual(expect.arrayContaining([expect.objectContaining({src:3.01,anchor:false})]));
    expect(downbeats()).toEqual([2,4]);
  });

  it('keeps anchors when a score moves and permits peaks beyond its last bar', async () => {
    const onFlexChange=vi.fn();
    await renderPanel(undefined,false,{initialFlex:[{src:1,dst:1,anchor:true},{src:3,dst:3.2,anchor:false},{src:8,dst:8,anchor:true}],onFlexChange});
    const original=stub.canvas!.flexPoints;
    act(()=>lane().onDragActive!(1,'move',{snap:false}));
    act(()=>lane().onDragActive!(1,'end',{snap:false}));
    expect(stub.canvas!.flexPoints).toEqual(original);
    act(()=>stub.canvas!.onFlexAddAt!(12));
    expect(stub.canvas!.flexPoints).toEqual(expect.arrayContaining([expect.objectContaining({src:12,dst:12,anchor:false})]));
    act(()=>stub.canvas!.onMarkerDrag!({measureNumber:2,beatInMeasure:1},5.5,'single',{snap:false}));
    expect(stub.canvas!.flexPoints).toEqual(expect.arrayContaining([expect.objectContaining({src:12,anchor:false})]));
  });

  it('toggles Flex without inserting a column beside the timeline', async () => {
    await renderPanel();
    const stage=host.querySelector('.st-stage')!;
    const track=host.querySelector('.st-stage-track')!;
    const flex=button('Flex')!;
    expect(flex.textContent?.trim()).toBe('Show Flex points');
    expect(flex.title).toContain('Flex');
    expect([...stage.children]).toEqual([track]);
    act(()=>flex.click());
    expect(stub.canvas!.flexMode).toBe(true);
    expect([...stage.children]).toEqual([track]);
    act(()=>flex.click());
    expect(stub.canvas!.flexMode).toBe(false);
    expect([...stage.children]).toEqual([track]);
  });

  it('keeps adding and deleting exclusive and defaults to seeking without adding', async () => {
    await renderPanel(undefined,false,{initialFlex:[{src:1,dst:1,anchor:true},{src:3,dst:3.2,anchor:false},{src:8,dst:8,anchor:true}]});
    expect(stub.canvas!.flexAddMode).toBe(false);
    act(()=>button('Add points')!.click());
    expect(stub.canvas!.flexAddMode).toBe(true);
    expect(stub.canvas!.flexDeleteMode).toBe(false);
    act(()=>button('Delete points')!.click());
    expect(stub.canvas!.flexDeleteMode).toBe(true);
    expect(stub.canvas!.flexAddMode).toBe(false);
    act(()=>button('Delete points')!.click());
    expect(stub.canvas!.flexDeleteMode).toBe(false);
    expect(stub.canvas!.flexAddMode).toBe(false);
    act(()=>button('Add points')!.click());
    act(()=>button('Add points')!.click());
    expect(stub.canvas!.flexAddMode).toBe(false);
  });

  it('hides and restores Flex editing without changing saved adjustments', async () => {
    const points=[{src:1,dst:1,anchor:true},{src:3,dst:3.2,anchor:false},{src:8,dst:8,anchor:true}];
    await renderPanel(undefined,false,{initialFlex:points});
    expect(stub.canvas!.flexMode).toBe(false);
    expect(stub.canvas!.flexPoints).toEqual(points);
    act(()=>button('Flex')!.click());
    expect(stub.canvas!.flexMode).toBe(true);
    act(()=>button('Flex')!.click());
    expect(stub.canvas!.flexMode).toBe(false);
    expect(stub.canvas!.flexPoints).toEqual(points);
    expect(button('Flex')!.textContent).toContain('Show Flex points');
    act(()=>button('Flex')!.click());
    expect(stub.canvas!.flexMode).toBe(true);
    expect(stub.canvas!.flexPoints).toEqual(points);
  });

  it('deletes an individual correction and resets all Flex without changing the score timing', async () => {
    const onFlexChange=vi.fn();
    await renderPanel(undefined,false,{initialFlex:[{src:1,dst:1,anchor:true},{src:3,dst:3.2,anchor:false},{src:4,dst:4.1,anchor:false},{src:8,dst:8,anchor:true}],onFlexChange});
    const bars=downbeats();
    act(()=>button('Delete points')!.click());
    expect(stub.canvas!.flexDeleteMode).toBe(true);
    act(()=>stub.canvas!.onFlexRemove!(1));
    expect(stub.canvas!.flexPoints?.some(p=>p.src===3)).toBe(false);
    expect(stub.canvas!.flexPoints?.some(p=>p.src===4 && p.dst===4.1)).toBe(true);
    act(()=>button('Reset Flex')!.click());
    expect(stub.canvas!.flexPoints).toEqual([]);
    expect(stub.canvas!.flexDeleteMode).toBe(false);
    expect(onFlexChange).toHaveBeenLastCalledWith([]);
    expect(downbeats()).toEqual(bars);
    expect(button('Reset Flex')!.disabled).toBe(true);
  });

  it('starts video audio on even after a previous muted session', async () => {
    const keys = ['playsense.studioVideoMuted', 'playsense.studioVideoVolume', 'playsense-studio:hear'];
    const previous = keys.map(k => window.localStorage.getItem(k));
    try {
      window.localStorage.setItem(keys[0], '1');
      window.localStorage.setItem(keys[1], '0');
      window.localStorage.setItem(keys[2], 'score');
      await renderPanel();
      const button = document.querySelector<HTMLButtonElement>('[aria-label="Mute video audio"]')!;
      expect(button.getAttribute('aria-pressed')).toBe('false');
      act(() => button.click());
      expect(button.getAttribute('aria-pressed')).toBe('true');
    } finally {
      keys.forEach((key, i) => previous[i] === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, previous[i]!));
    }
  });

  it('connects the monitor mute to the independent video audio state', async () => {
    localStorage.removeItem('playsense.studioVideoMuted');
    await renderPanel();
    const button = document.querySelector<HTMLButtonElement>('[aria-label="Mute video audio"]')!;
    expect(button).not.toBeNull();
    const before = button.getAttribute('aria-pressed');
    act(() => button.click());
    expect(button.getAttribute('aria-pressed')).toBe(before === 'true' ? 'false' : 'true');
    act(() => button.click());
    expect(button.getAttribute('aria-pressed')).toBe(before);
    expect(onTimingChange).not.toHaveBeenCalled();
  });

  it('seeds editable bar lines on the grid from bar 1, ignoring a legacy map and anchor', async () => {
    await renderPanel();
    expect(downbeats()).toEqual([2, 4]);
    expect(stub.canvas!.markersLocked).toBe(false);
    expect(stub.canvas!.metronomeAnchorSeconds).toBeUndefined();
    expect(lane().sections.map((s) => s.label)).toEqual(['Exercise']);
    expect(lane().activeRange).toEqual({ startSeconds: 2, endSeconds: 6 });
  });

  it('falls back to the trim-in point when bar 1 is not placed', async () => {
    await renderPanel({ bar1Seconds: null, countInBars: 1, preroll: true });
    expect(downbeats()).toEqual([1, 3]);
  });

  it('shows both individual marker and Flex controls', async () => {
    await renderPanel();
    // Auto-align stays on the waveform's tool cluster (WaveTools), in the main tree.
    expect(button('Auto-align')).toBeTruthy();
    // Count-in, Pre-roll and the on-hit readout moved into Sync status (inspectorEl).
    const inspectorText = inspectorHost.textContent ?? '';
    expect(inspectorText).toContain('Count-in');
    expect(inspectorButton('1 bar')?.getAttribute('aria-checked')).toBe('true');
    expect(inspectorButton('2 bars')?.getAttribute('aria-checked')).toBe('false');
    expect(inspectorButton('Pre-roll video')?.getAttribute('aria-pressed')).toBe('true');
    // Bar 1 at 2: the notes at 3.0 … 5.5 sit 10 ms from a hit; 2.0 and 2.5 don't.
    expect(inspectorText).toContain('6/8 notes on a hit');
    expect(button('Flex')).toBeDefined();
    expect(button('Auto-place bars')).toBeUndefined();
    expect(button('Ripple')).toBeDefined();
    expect(host.textContent).not.toContain('Anchor at playhead');
    expect(inspectorText).not.toContain('Anchor at playhead');
  });

  it('writes count-in and pre-roll changes through onPlayChange', async () => {
    await renderPanel();
    act(() => inspectorButton('2 bars')!.click());
    expect(onPlayChange).toHaveBeenLastCalledWith({ countInBars: 2 });
    act(() => inspectorButton('Pre-roll video')!.click());
    expect(onPlayChange).toHaveBeenLastCalledWith({ preroll: false });
  });

  it('Auto-align puts bar 1 where the most onsets land on hits', async () => {
    await renderPanel();
    act(() => button('Auto-align')!.click());
    expect(onPlayChange).toHaveBeenCalledTimes(1);
    expect(onPlayChange.mock.calls[0][0].bar1Seconds).toBeCloseTo(3.01, 9);
  });

  it('disables Auto-align without hits and hides the readout', async () => {
    stub.hits = [];
    await renderPanel();
    const align = button('Auto-align')!;
    expect(align.disabled).toBe(true);
    expect(align.title).toBe('Re-analyze audio to find the hits');
    expect(inspectorHost.textContent).not.toContain('notes on a hit');
  });

  // Final review Important 3: the failure used to reach only the hover rail's
  // SyncActions (opacity 0 until hovered) — it must also reach the stage
  // toast, wired through IntegratedEditor's `notice` prop.
  it('a failed Auto-align reaches the stage toast, with no undo to offer', async () => {
    stub.hits = [50]; // present (button stays enabled) but nowhere near any onset window
    await renderPanel();
    expect(stub.editor?.notice).toBeNull();
    act(() => button('Auto-align')!.click());
    expect(stub.editor?.notice).toBe('Not enough clear hits to align the exercise.');
    expect(stub.editor?.noticeAction).toBeFalsy();
  });

  it('dragging the Exercise block shifts bar 1, snapping the first onset onto a hit', async () => {
    await renderPanel();
    // 0.95 s puts the first note at 2.95; the hit at 3.01 is within 8 px at 40 px/s.
    act(() => lane().onDragActive!(0.95, 'move', { snap: true }));
    expect(downbeats()[0]).toBeCloseTo(3.01, 9);
    expect(onPlayChange).not.toHaveBeenCalled();
    act(() => lane().onDragActive!(0.95, 'end', { snap: true }));
    expect(onPlayChange).toHaveBeenCalledTimes(1);
    expect(onPlayChange.mock.calls[0][0].bar1Seconds).toBeCloseTo(3.01, 9);
  });

  it('⌘ skips the snap, and the waveform background drags bar 1 too', async () => {
    await renderPanel();
    act(() => stub.canvas!.onBackgroundDrag!(0.95, 'move', { snap: false }));
    act(() => stub.canvas!.onBackgroundDrag!(0.95, 'end', { snap: false }));
    expect(onPlayChange.mock.calls[0][0].bar1Seconds).toBeCloseTo(2.95, 9);
  });

  it('never hands waypoints to the draft', async () => {
    await renderPanel();
    act(() => vi.advanceTimersByTime(5000));
    expect(onTimingChange).not.toHaveBeenCalled();
  });

  // Final review Minor 3: Tailwind's `flex items-center gap-2` on this button
  // lost to `.st-mpop-item { display: block }`. A dedicated `has-icon`
  // modifier restores the row.
  it('gives "Add score" its own has-icon row, not a bare block item', async () => {
    await renderPanel();
    const btn = scoreActionsButton('Add score')!;
    expect(btn.className).toBe('st-mpop-item has-icon');
    expect(btn.firstElementChild?.tagName.toLowerCase()).toBe('svg'); // the FilePlus2 icon leads the label
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const rule = css.match(/\.st-mpop-item\.has-icon\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/gap:\s*8px/);
  });
});


it('restores the cached waveform in StrictMode and only re-analyzes on explicit request', async()=>{
  const {loadOrComputePeaks}=await import('@/lib/playsense-studio/waveform-decode');
  vi.mocked(loadOrComputePeaks).mockClear();
  vi.useRealTimers();
  await renderPanel(undefined,true);
  await act(async()=>{await vi.dynamicImportSettled();});
  expect(button('Analyze audio')).toBeUndefined();
  expect(loadOrComputePeaks).not.toHaveBeenCalled();
  expect(downbeats()[0]).toBe(2);
  await act(async()=>inspectorButton('Re-analyze')!.click());
  expect(loadOrComputePeaks).toHaveBeenCalledWith('ci-1','https://example.test/play.mp4',expect.anything(),expect.objectContaining({force:true}));
  expect(downbeats()[0]).toBe(2);
  expect(onPlayChange).not.toHaveBeenCalled();
});
