// @vitest-environment jsdom
//
// Studio layout pass: SyncPanel's Auto-place toast wiring. IntegratedEditor's
// neutral `info` slot must carry "Bars auto-placed." with a working Undo in
// the common case (no flex to clear, so nothing sets the old `notice` and the
// toast used to stay hidden) — Important 1 of the layout-pass review. A
// failed Auto-place must stay in the red `notice` slot with no Undo —
// Important 3, so a stale success's Undo never pairs with a fresh failure.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EditorProps = { notice?: string | null; info?: string | null; noticeAction?: { label: string; onClick: () => void } | null };
const stub = vi.hoisted(() => ({
  canvas: null as null | { selection?: {a:number;b:number}|null; handles: Array<{ videoTimeSeconds: number; isDownbeat: boolean }> },
  hits: [] as number[],
  editor: null as null | EditorProps,
}));

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/playsense-studio/waveform-decode', () => ({
  loadCachedPeaks: async () => ({ version: 1, durationSeconds: 30, bucketCount: 0, sampleRate: 1, data: [], hits: stub.hits }),
  loadOrComputePeaks: async () => ({ version: 1, durationSeconds: 30, bucketCount: 0, sampleRate: 1, data: [], hits: stub.hits }),
}));
vi.mock('@/components/playsense-studio/sync/waveform-canvas', () => ({
  WaveformCanvas: (p: NonNullable<typeof stub.canvas>) => {
    stub.canvas = p;
    return null;
  },
}));
vi.mock('@/components/playsense-studio/sync/sections-lane', () => ({ SectionsLane: () => null }));
vi.mock('@/components/playsense-studio/studio/integrated-editor', () => ({
  IntegratedEditor: (p: EditorProps) => {
    stub.editor = p;
    return null;
  },
  isTypingTarget: () => false,
}));
vi.mock('@/components/playsense-studio/sync/reference-monitor', () => ({ ReferenceMonitor: () => null }));
vi.mock('@/components/playsense-studio/player/transport/transport-bar', () => ({ TransportBar: () => null }));
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({
  ScoreImportDialog: (p: { trigger: React.ReactNode }) => p.trigger,
}));
vi.mock('@/components/playsense-studio/player/state/use-video-click-track', () => ({ useVideoClickTrack: () => {} }));

import { SyncPanel } from '../sync-panel';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const quarter = { kind: 'note' as const, durationQN: 1, midi: 60 };
const BARS = 8;
const SCORE = {
  schemaVersion: 1,
  title: 'Auto-place',
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
      measures: Array.from({ length: BARS }, (_, i) => ({
        number: i + 1,
        voices: [{ number: 1, events: [quarter, quarter, quarter, quarter] }],
      })),
    },
  ],
} as unknown as ScoreDocument;

// 120 BPM, 4/4: a quarter note every 0.5 s, bar i's downbeat at i*2 s — the
// grid SyncPanel seeds the markers on with no time map.
const ONSETS = Array.from({ length: BARS }, (_, i) => [0, 1, 2, 3].map((b) => i * 2 + b * 0.5)).flat();

let host: HTMLDivElement;
let inspectorHost: HTMLDivElement;
let scoreActionsHost: HTMLDivElement;
let root: Root;
const onTimingChange = vi.fn();

async function renderPanel() {
  await act(async () => {
    root.render(
      <SyncPanel
        classItemId="ci-1"
        mode="video"
        videoUrl="https://example.test/play.mp4"
        score={SCORE}
        dispatch={vi.fn()}
        activeTimeMap={null}
        onTimingChange={onTimingChange}
        videoDurationSeconds={null}
        inspectorEl={inspectorHost}
        scoreActionsEl={scoreActionsHost}
      />
    );
  });
  await act(async () => {}); // the cached-peaks load
}

const autoPlaceButton = () => host.querySelector<HTMLButtonElement>('[aria-label="Auto-place bars"]')!;
const downbeats = () => stub.canvas!.handles.filter((h) => h.isDownbeat).map((h) => h.videoTimeSeconds);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  // The Auto-place tween checks prefers-reduced-motion; jsdom has no
  // matchMedia, so stub one that reports it — the tween then writes straight
  // to the final marker state instead of animating over un-driven
  // requestAnimationFrame frames.
  vi.stubGlobal('matchMedia', ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia);
  stub.canvas = null;
  stub.editor = null;
  // Every onset played a steady 100 ms behind the grid — Auto-place should
  // fit a corrected line and settle right on it.
  stub.hits = ONSETS.map((t) => t + 0.1);
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
  vi.unstubAllGlobals();
});

describe('SyncPanel Auto-place toast', () => {
  it('a successful Auto-place shows "Bars auto-placed." with a working Undo, even with nothing to clear', async () => {
    await renderPanel();
    const before = downbeats();
    expect(before[0]).toBeCloseTo(0, 6);
    expect(before[7]).toBeCloseTo(14, 6);

    act(() => { autoPlaceButton().click(); });

    expect(stub.editor?.notice).toBeFalsy();
    expect(stub.editor?.info).toBe('Bars auto-placed.');
    expect(stub.editor?.noticeAction?.label).toBe('Undo');

    // The recording's steady 100 ms lag is now baked into every bar.
    const after = downbeats();
    before.forEach((t, i) => expect(after[i]).toBeCloseTo(t + 0.1, 2));

    // The toast is a one-step affordance: gone after 6 s.
    act(() => { vi.advanceTimersByTime(6000); });
    expect(stub.editor?.info).toBeFalsy();
    expect(stub.editor?.noticeAction).toBeFalsy();
  });

  it('clicking Undo restores the bars and hides the toast', async () => {
    await renderPanel();
    const before = downbeats();

    act(() => { autoPlaceButton().click(); });
    expect(stub.editor?.info).toBe('Bars auto-placed.');
    expect(downbeats()[0]).not.toBeCloseTo(before[0], 6);

    act(() => { stub.editor!.noticeAction!.onClick(); });

    expect(downbeats()).toEqual(before);
    expect(stub.editor?.info).toBeFalsy();
    expect(stub.editor?.notice).toBeFalsy();
    expect(stub.editor?.noticeAction).toBeFalsy();
  });

  it('a failed Auto-place shows a red toast with no Undo', async () => {
    stub.hits = [10, 10.3, 10.6, 10.9]; // present (button stays enabled), but nowhere near the score's onsets
    await renderPanel();
    expect(stub.editor?.notice).toBeFalsy();

    act(() => { autoPlaceButton().click(); });

    expect(stub.editor?.notice).toBe('Not enough clear hits to place the bars.');
    expect(stub.editor?.info).toBeFalsy();
    expect(stub.editor?.noticeAction).toBeFalsy();
  });
});


it('contains horizontal trackpad gestures even when a child stops propagation', async () => {
  await renderPanel();
  const area = host.querySelector<HTMLElement>('.st-stage-track')!;
  const empty = document.createElement('div');area.appendChild(empty);
  const childHandler = vi.fn((event: Event) => event.stopPropagation());
  empty.addEventListener('wheel',childHandler);
  for (const deltaX of [-100,100]) {
    const event = new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX});
    empty.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(childHandler).toHaveBeenCalledTimes(2);
  for (const options of [{deltaY:100},{deltaY:100,ctrlKey:true}]) {
    const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,...options});
    empty.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
});


it('selects an interval directly on the waveform for audio quantization',async()=>{
 await renderPanel();
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='Select audio range')!;
 act(()=>button.click());
 const area=host.querySelector<HTMLElement>('div[aria-label="Select audio range"]')!;
 area.setPointerCapture=vi.fn();
 const pointer=(type:string,x:number)=>{
  const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x});
  Object.defineProperty(event,'pointerId',{value:1});act(()=>area.dispatchEvent(event));
 };
 pointer('pointerdown',100);pointer('pointermove',200);pointer('pointerup',200);
 const forward={...stub.canvas!.selection!};
 expect(forward.a).toBeLessThan(forward.b);
 pointer('pointerdown',200);pointer('pointermove',100);
 expect(stub.canvas!.selection).toEqual(forward);
 pointer('pointerup',100);
 expect(stub.canvas!.selection).toEqual(forward);
 expect([...host.querySelectorAll('button')].some(b=>b.textContent==='Quantize audio')).toBe(true);
 expect(host.textContent).not.toMatch(/\d+\.\d{3} s – \d+\.\d{3} s/);
});
