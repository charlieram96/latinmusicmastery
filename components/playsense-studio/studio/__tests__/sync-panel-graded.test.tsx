// @vitest-environment jsdom
//
// Studio rework P5, Task 6: SyncPanel's graded mode. The canvases, lanes and
// editor are stubbed so the test drives the panel's own wiring: grid bar
// lines from bar 1 (locked), the bar 1 drag with snap, Auto-align, the
// count-in / pre-roll controls and the "notes on a hit" readout.
import { act } from 'react';
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
  },
  lanes: [] as Array<{ sections: Array<{ label: string }>; activeRange: { startSeconds: number; endSeconds: number }; onDragActive?: DragFn }>,
  hits: [] as number[],
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
vi.mock('@/components/playsense-studio/sync/sections-lane', () => ({
  SectionsLane: (p: (typeof stub.lanes)[number]) => {
    stub.lanes.push(p);
    return null;
  },
}));
vi.mock('@/components/playsense-studio/studio/integrated-editor', () => ({
  IntegratedEditor: () => null,
  isTypingTarget: () => false,
}));
vi.mock('@/components/playsense-studio/sync/reference-monitor', () => ({ ReferenceMonitor: () => null }));
vi.mock('@/components/playsense-studio/player/transport/transport-bar', () => ({ TransportBar: () => null }));
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({ ScoreImportDialog: () => null }));
vi.mock('@/components/playsense-studio/player/state/use-video-click-track', () => ({ useVideoClickTrack: () => {} }));

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
let root: Root;
const onPlayChange = vi.fn();
const onTimingChange = vi.fn();

async function renderPanel(play = { bar1Seconds: 2 as number | null, countInBars: 1 as 1 | 2, preroll: true }) {
  await act(async () => {
    root.render(
      <SyncPanel
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
      />
    );
  });
  await act(async () => {}); // the cached-peaks load
}

const downbeats = () => stub.canvas!.handles.filter((h) => h.isDownbeat).map((h) => h.videoTimeSeconds);
const lane = () => stub.lanes.at(-1)!;
const button = (text: string) =>
  Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
// Placement, anchor, re-analyze and the graded controls (Count-in, Pre-roll,
// the on-hit readout) moved into the left panel's Sync status, which SyncPanel
// renders through `inspectorEl` (Studio layout pass, Task 4).
const inspectorButton = (text: string) =>
  Array.from(inspectorHost.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  stub.canvas = null;
  stub.lanes = [];
  // Hits 10 ms after where the notes land with bar 1 at 3.0.
  stub.hits = ONSETS.map((o) => 3.01 + o);
  onPlayChange.mockReset();
  onTimingChange.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  inspectorHost = document.createElement('div');
  document.body.appendChild(inspectorHost);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  inspectorHost.remove();
  vi.useRealTimers();
});

describe('SyncPanel graded mode', () => {
  it('lays the locked bar lines on the grid from bar 1, ignoring a legacy map and anchor', async () => {
    await renderPanel();
    expect(downbeats()).toEqual([2, 4]);
    expect(stub.canvas!.markersLocked).toBe(true);
    expect(stub.canvas!.metronomeAnchorSeconds).toBeUndefined();
    expect(lane().sections.map((s) => s.label)).toEqual(['Exercise']);
    expect(lane().activeRange).toEqual({ startSeconds: 2, endSeconds: 6 });
  });

  it('falls back to the trim-in point when bar 1 is not placed', async () => {
    await renderPanel({ bar1Seconds: null, countInBars: 1, preroll: true });
    expect(downbeats()).toEqual([1, 3]);
  });

  it('shows the graded controls and hides Flex, Auto-place and the drag mode', async () => {
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
    expect(button('Flex')).toBeUndefined();
    expect(button('Auto-place bars')).toBeUndefined();
    expect(button('Ripple')).toBeUndefined();
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
    expect(align.title).toBe('Line the play-along up with the tempo grid');
    expect(inspectorHost.textContent).not.toContain('notes on a hit');
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
});
