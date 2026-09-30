// @vitest-environment jsdom
//
// Flex editing on the waveform (Flex Time, Task 6). In Flex mode the hits
// show as grips along the top of the wave area (click one to add a point),
// flex points drag (with ⌘ skipping the snap) and a double-click removes one
// (on release, and only if the second press didn't turn into a drag).
// With Flex mode off the same pixels behave exactly as before.

import { useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FlexPoint } from '@/lib/playsense-studio/flex';
import { WaveformCanvas, flexDragLabel, type DragMode } from '../waveform-canvas';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const PPS = 10;
/** The top of the wave area (LABEL_BAND) plus a little: the hit-grip band. */
const GRIP_Y = 25;
const BODY_Y = 100;

function pointer(type: string, x: number, y: number, mods: { metaKey?: boolean } = {}) {
  const e = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    metaKey: mods.metaKey ?? false,
  });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  return e;
}

interface Calls {
  seek: number[];
  add: number[];
  drag: Array<[number, number, { snap: boolean }]>;
  remove: number[];
  marker: Array<[number, DragMode]>;
  select: string[];
}

function Harness({
  flexMode,
  manual,
  deleting,
  adding = false,
  insertAnchor = false,
  calls,
  points = [],
}: {
  flexMode: boolean;
  manual?: (seconds:number)=>void;
  deleting?: boolean;
  adding?: boolean;
  insertAnchor?: boolean;
  calls: Calls;
  points?: FlexPoint[];
}) {
  // The drag re-renders the parent, as SyncPanel's setFlex does.
  const [flex, setFlex] = useState(points);
  return (
    <WaveformCanvas
      peaks={null}
      durationSeconds={60}
      // A bar line exactly on the first hit (5 s → x 50).
      handles={[{ measureNumber: 1, beatInMeasure: 1, isDownbeat: true, videoTimeSeconds: 5 }]}
      noteTicks={[]}
      showNotes={false}
      tailVideoTimeSeconds={60}
      pixelsPerSecond={PPS}
      scrollLeftPx={0}
      dragAll={false}
      selected={null}
      getCurrentSeconds={() => 0}
      onSeek={t=>calls.seek.push(t)}
      onSelect={(t) => calls.select.push(t.kind)}
      onMarkerDrag={(_ref, t, mode) => calls.marker.push([t, mode])}
      onTailDrag={() => {}}
      onDragEnd={() => {}}
      onScrollByPx={() => {}}
      onViewportWidth={() => {}}
      flexMode={flexMode}
      flexDeleteMode={deleting}
      flexAddMode={adding}
      flexPoints={flex}
      hitsTimeline={[5, 20, 35]}
      noteTimes={[5, 21, 36]}
      onFlexAdd={(i) => calls.add.push(i)}
      onFlexAddAt={manual}
      onFlexDrag={(i, t, mods) => {
        calls.drag.push([i, t, mods]);
        setFlex((f) => {
          const moved=f.map((q,j)=>j===i?{...q,dst:t}:q);
          return insertAnchor && mods.start ? [...moved,{src:24,dst:25,anchor:true}].sort((a,b)=>a.src-b.src) : moved;
        });
      }}
      onFlexRemove={(i) => calls.remove.push(i)}
    />
  );
}

const POINTS: FlexPoint[] = [
  { src: 20, dst: 20, anchor: true },
  { src: 28, dst: 30, anchor: false },
  { src: 35, dst: 35, anchor: true },
];

describe('WaveformCanvas Flex editing', () => {
  let container: HTMLDivElement;
  let root: Root;
  let calls: Calls;

  let restoreHeight: () => void;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    // jsdom lays nothing out; give the overlay a real height so the bottom
    // ANCHOR_BAND (18 px) sits at y 182..200, below BODY_Y.
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 200 });
    restoreHeight = () => {
      if (orig) Object.defineProperty(HTMLElement.prototype, 'clientHeight', orig);
      else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    calls = { seek: [], add: [], drag: [], remove: [], marker: [], select: [] };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restoreHeight();
  });

  const overlay = () => container.querySelectorAll('canvas')[1];
  const fire = (type: string, x: number, y: number, mods?: { metaKey?: boolean }) =>
    act(() => {
      overlay().dispatchEvent(pointer(type, x, y, mods));
    });

  it('clicking a hit grip in Flex mode adds a point at that hit', () => {
    act(() => root.render(<Harness flexMode adding calls={calls} />));
    fire('pointerdown', 51, GRIP_Y);
    fire('pointerup', 51, GRIP_Y);
    expect(calls.add).toEqual([0]);
    // The coincident bar line is not grabbed.
    expect(calls.select).toEqual([]);
    expect(calls.marker).toEqual([]);

    fire('pointerdown', 350, GRIP_Y);
    fire('pointerup', 350, GRIP_Y);
    expect(calls.add).toEqual([0, 2]);
  });

  it('adds points from the waveform body and permits an undetected peak', () => {
    const added:number[]=[];
    act(()=>root.render(<Harness flexMode adding calls={calls} manual={t=>added.push(t)} />));
    fire('pointerdown',200,BODY_Y); fire('pointerup',200,BODY_Y);
    expect(calls.add).toEqual([1]);
    fire('pointerdown',270,BODY_Y); fire('pointerup',270,BODY_Y);
    expect(added).toEqual([27]);
    expect(calls.marker).toEqual([]);
  });

  it('delete mode removes points and seeks on both points and empty space', () => {
    const added:number[]=[];
    act(()=>root.render(<Harness flexMode deleting calls={calls} points={POINTS} manual={t=>added.push(t)} />));
    const x=POINTS[1].dst*PPS;
    fire('pointerdown',x,BODY_Y);fire('pointerup',x,BODY_Y);
    expect(calls.remove).toEqual([1]);
    fire('pointerdown',270,BODY_Y);fire('pointerup',270,BODY_Y);
    expect(added).toEqual([]);expect(calls.marker).toEqual([]);
    expect(calls.seek).toEqual([30,27]);
  });

  it('normal Flex clicks seek without adding anchors, until Add points is enabled', () => {
    const added:number[]=[];
    act(()=>root.render(<Harness flexMode calls={calls} manual={t=>added.push(t)} />));
    fire('pointerdown',200,BODY_Y);fire('pointerup',200,BODY_Y);
    fire('pointerdown',270,BODY_Y);fire('pointerup',270,BODY_Y);
    expect(calls.seek).toEqual([20,27]);
    expect(calls.add).toEqual([]);expect(added).toEqual([]);
    act(()=>root.render(<Harness flexMode adding calls={calls} manual={t=>added.push(t)} />));
    fire('pointerdown',270,BODY_Y);fire('pointerup',270,BODY_Y);
    expect(added).toEqual([27]);
    act(()=>root.render(<Harness flexMode calls={calls} manual={t=>added.push(t)} />));
    fire('pointerdown',280,BODY_Y);fire('pointerup',280,BODY_Y);
    expect(added).toEqual([27]);
    expect(calls.seek.at(-1)).toBe(28);
  });

  it('a simple waveform click seeks with Flex enabled, including new and existing points', () => {
    act(()=>root.render(<Harness flexMode calls={calls} points={POINTS} manual={()=>{}} />));
    fire('pointerdown',270,BODY_Y);fire('pointerup',270,BODY_Y);
    expect(calls.seek).toEqual([27]);
    const x=POINTS[1].dst*PPS;
    fire('pointerdown',x,BODY_Y);fire('pointerup',x,BODY_Y);
    expect(calls.seek.at(-1)).toBe(POINTS[1].dst);
  });

  it('a click on a bar marker also sets the playhead, while a Flex drag does not', () => {
    act(()=>root.render(<Harness flexMode={false} calls={calls} points={POINTS} />));
    fire('pointerdown',50,10);fire('pointerup',50,10);
    expect(calls.seek).toEqual([5]);
    calls.seek=[];
    act(()=>root.render(<Harness flexMode calls={calls} points={POINTS} />));
    const x=POINTS[1].dst*PPS;
    fire('pointerdown',x,BODY_Y);fire('pointermove',x+20,BODY_Y);fire('pointerup',x+20,BODY_Y);
    expect(calls.drag.length).toBeGreaterThan(0);
    expect(calls.seek).toEqual([]);
  });

  it('dragging a flex point reports its timeline time, and ⌘ as no-snap', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    // Point 1 sits at dst 30 s → x 300.
    fire('pointerdown', 300, BODY_Y);
    fire('pointermove', 310, BODY_Y);
    fire('pointermove', 320, BODY_Y);
    fire('pointerup', 320, BODY_Y);
    expect(calls.drag).toEqual([
      [1, 31, { snap: true, start: true }],
      [1, 32, { snap: true, start: false }],
    ]);

    calls.drag.length = 0;
    fire('pointerdown', 320, BODY_Y);
    fire('pointermove', 330, BODY_Y, { metaKey: true });
    fire('pointerup', 330, BODY_Y);
    expect(calls.drag).toEqual([[1, 33, { snap: false, start: true }]]);
    expect(calls.marker).toEqual([]);
  });

  it('keeps dragging the same source when protection inserts a preceding anchor',()=>{
    act(()=>root.render(<Harness flexMode insertAnchor calls={calls} points={POINTS}/>));
    fire('pointerdown',300,BODY_Y);
    fire('pointermove',310,BODY_Y);
    fire('pointermove',320,BODY_Y);
    fire('pointerup',320,BODY_Y);
    expect(calls.drag).toEqual([[1,31,{snap:true,start:true}],[2,32,{snap:true,start:false}]]);
  });

  it('double-clicking a flex point removes it', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    expect(calls.remove).toEqual([]);
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    expect(calls.remove).toEqual([1]);
    expect(calls.drag).toEqual([]);
  });

  it('the second press removes only on release: removal waits for pointerup', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    fire('pointerdown', 300, BODY_Y);
    expect(calls.remove).toEqual([]);
    fire('pointerup', 301, BODY_Y);
    expect(calls.remove).toEqual([1]);
  });

  it('click-then-drag on a flex point drags it and does not remove it', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    fire('pointerdown', 300, BODY_Y);
    fire('pointermove', 310, BODY_Y);
    fire('pointerup', 310, BODY_Y);
    expect(calls.remove).toEqual([]);
    expect(calls.drag).toEqual([[1, 31, { snap: true, start: true }]]);
  });

  it('a flex point is not grabbed in the bottom anchor band', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    // y 190 is inside the bottom ANCHOR_BAND (182..200): no flex drag there.
    fire('pointerdown', 300, 190);
    fire('pointermove', 320, 190);
    fire('pointerup', 320, 190);
    expect(calls.drag).toEqual([]);
    fire('pointerdown', 300, 190);
    fire('pointerup', 300, 190);
    fire('pointerdown', 300, 190);
    fire('pointerup', 300, 190);
    expect(calls.remove).toEqual([]);
  });

  it('with Flex mode off, the same click selects and drags the bar line as before', () => {
    act(() => root.render(<Harness flexMode={false} calls={calls} points={POINTS} />));
    fire('pointerdown', 51, GRIP_Y);
    fire('pointermove', 100, GRIP_Y);
    fire('pointerup', 100, GRIP_Y);
    expect(calls.add).toEqual([]);
    expect(calls.select).toEqual(['marker']);
    expect(calls.marker).toEqual([[10, 'single']]);

    // Nor does a flex point grab or remove when the mode is off.
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    fire('pointerdown', 300, BODY_Y);
    fire('pointerup', 300, BODY_Y);
    expect(calls.remove).toEqual([]);
    expect(calls.drag).toEqual([]);
  });

  it('bar chips keep working in Flex mode', () => {
    act(() => root.render(<Harness flexMode calls={calls} points={POINTS} />));
    // The chip band (y < LABEL_BAND) over the bar line at x 50.
    fire('pointerdown', 52, 10);
    fire('pointermove', 100, 10);
    fire('pointerup', 100, 10);
    expect(calls.add).toEqual([]);
    expect(calls.marker).toEqual([[10, 'single']]);
  });
});

describe('flexDragLabel', () => {
  it('shows the signed offset and the left segment\'s playback speed as a percentage', () => {
    // 20→30 timeline plays 20→28 media: speed 0.8, so 80% (slower is under 100).
    expect(flexDragLabel(POINTS, 1)).toBe('+2000 ms · 80%');
    const early: FlexPoint[] = [
      { src: 10, dst: 10, anchor: true },
      { src: 12.5, dst: 12.488, anchor: false },
    ];
    expect(flexDragLabel(early, 1)).toBe('-12 ms · 100%');
    // The first point has identity to its left.
    expect(flexDragLabel(POINTS, 0)).toBe('+0 ms · 100%');
  });
  it('clamps the displayed speed to the driver\'s [50, 200]', () => {
    const slow: FlexPoint[] = [{ src: 0, dst: 0, anchor: true }, { src: 1, dst: 5, anchor: false }];
    expect(flexDragLabel(slow, 1)).toBe('+4000 ms · 50%');
    const fast: FlexPoint[] = [{ src: 0, dst: 0, anchor: true }, { src: 5, dst: 1, anchor: false }];
    expect(flexDragLabel(fast, 1)).toBe('-4000 ms · 200%');
  });
});

describe('WaveformCanvas stretch tints', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fills: Array<[string, number, number]>;
  let restore: Array<() => void>;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    fills = [];
    const state: Record<string, unknown> = {};
    const target: Record<string, unknown> = {
      fillRect: (x: number, _y: number, w: number) => fills.push([String(state.fillStyle), x, w]),
      measureText: () => ({ width: 0 }),
    };
    const ctx = new Proxy(target, {
      get: (t, k: string) => (k in t ? t[k] : k in state ? state[k] : () => {}),
      set: (_t, k: string, v) => {
        state[k] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof origGetContext;
    const origWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
    restore = [
      () => { HTMLCanvasElement.prototype.getContext = origGetContext; },
      () => {
        if (origWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origWidth);
        else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    restore.forEach((r) => r());
  });

  const SLOWER = 'hsl(210 90% 55% / .14)';
  const FASTER = 'hsl(28 95% 55% / .14)';

  it('tints slower segments blue and faster ones orange, even with Flex mode off', () => {
    const calls: Calls = { seek: [], add: [], drag: [], remove: [], marker: [], select: [] };
    act(() => root.render(<Harness flexMode={false} calls={calls} points={POINTS} />));
    const tints = fills.filter(([s]) => s === SLOWER || s === FASTER);
    // 20→30 timeline covers 20→28 media: slower. 30→35 covers 28→35: faster.
    expect(tints).toContainEqual([SLOWER, 200, 100]);
    expect(tints).toContainEqual([FASTER, 300, 50]);
  });

  it('draws no tint without points', () => {
    const calls: Calls = { seek: [], add: [], drag: [], remove: [], marker: [], select: [] };
    act(() => root.render(<Harness flexMode calls={calls} />));
    expect(fills.filter(([s]) => s === SLOWER || s === FASTER)).toEqual([]);
  });
});
