// @vitest-environment jsdom
import React, { act } from 'react';
import { StaveNote } from 'vexflow';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Span, Track } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import type { MeasureHit, MeasureStripItem } from '../editable-measure-strip';
import { ContinuousStaff } from '../continuous-staff';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const note = (id: string, midi: number) => ({ kind: 'note' as const, id, midi, durationQN: 2 });
const track: Track = {
  index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
  measures: [
    { number: 1, voices: [{ number: 1, events: [note('a', 60), note('b', 62)] }] },
    { number: 2, voices: [{ number: 1, events: [note('c', 64), note('d', 65)] }] },
  ],
};

const items: MeasureStripItem[] = extractTrackEvents(track, [4, 4], 0).map((b, i) => ({
  measureIndex: i,
  measureNumber: b.measure.number,
  startVideoTimeSeconds: i * 2,
  endVideoTimeSeconds: i * 2 + 2,
  events: b.events,
  voice2Events: b.voice2Events,
  timeSignature: b.timeSignature,
  isFirst: i === 0,
  clef: b.clef,
  keyFifths: b.keyFifths,
  previousKeyFifths: b.previousKeyFifths,
  keyChanged: b.keyChanged,
  clefChanged: b.clefChanged,
  fill: measureFill(b.measure.voices[0]?.events ?? [], b.measure.voices[1]?.events, b.timeSignature),
}));

function render(props: { spans?: Span[]; scrollLeftPx?: number; onHitsReady?: (i: number, hits: MeasureHit[] | null) => void }) {
  act(() => {
    root.render(
      <ContinuousStaff
        items={items} pixelsPerSecond={150} scrollLeftPx={props.scrollLeftPx ?? 0} viewportWidth={800} height={220}
        spans={props.spans} onHitsReady={props.onHitsReady ?? (() => {})}
      />,
    );
  });
}

describe('ContinuousStaff', () => {
  it('draws the whole range as one SVG, with a slur across the barline', () => {
    render({});
    expect(host.querySelectorAll('svg')).toHaveLength(1);
    const plain = host.querySelectorAll('path').length;
    act(() => root.unmount());
    root = createRoot(host);
    render({ spans: [{ id: 's', type: 'slur', from: 'b', to: 'c' }] });
    expect(host.querySelectorAll('path').length).toBeGreaterThan(plain);
  });

  it('reports voice-1 hits per measure, relative to each bar’s start', () => {
    const got = new Map<number, MeasureHit[]>();
    render({ onHitsReady: (i, hits) => { if (hits) got.set(i, hits); } });
    expect([...got.keys()].sort()).toEqual([0, 1]);
    for (const hits of got.values()) {
      expect(hits).toHaveLength(2);
      for (const h of hits) {
        expect(h.x).toBeGreaterThanOrEqual(0);
        expect(h.x).toBeLessThan(300);
      }
    }
  });

  it('draws a tie across the barline as one tie, not two partial ones', () => {
    const tied: Track = { ...track, measures: [
      { number: 1, voices: [{ number: 1, events: [note('a', 60), { ...note('b', 62), tieToNext: true }] }] },
      { number: 2, voices: [{ number: 1, events: [note('c', 62), note('d', 65)] }] },
    ] };
    const tiedItems = extractTrackEvents(tied, [4, 4], 0).map((b, i) => ({ ...items[i], events: b.events }));
    act(() => {
      root.render(
        <ContinuousStaff items={tiedItems} pixelsPerSecond={150} scrollLeftPx={0} viewportWidth={800} height={220} onHitsReady={() => {}} />,
      );
    });
    expect(host.querySelectorAll('svg')).toHaveLength(1);
    expect(host.querySelectorAll('.vf-stavetie')).toHaveLength(1);
  });

  it('moves the drawn staff by transform on a small scroll instead of redrawing', () => {
    render({});
    const svg = host.querySelector('svg');
    const wrapper = svg!.parentElement as HTMLElement;
    const before = wrapper.style.transform;
    render({ scrollLeftPx: 40 });
    expect(host.querySelector('svg')).toBe(svg);
    expect(wrapper.style.transform).not.toBe(before);
  });

  describe('redraws at most once per animation frame', () => {
    let frames: Map<number, FrameRequestCallback>;
    let nextId: number;
    beforeEach(() => {
      frames = new Map();
      nextId = 1;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(nextId, cb); return nextId++; });
      vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    });
    afterEach(() => vi.unstubAllGlobals());
    const flushFrame = () => act(() => {
      const due = [...frames.values()];
      frames.clear();
      due.forEach((cb) => cb(performance.now()));
    });
    // Every draw puts a fresh <svg> into the host, so counting them counts draws.
    const countDraws = () => {
      let draws = 0;
      const obs = new MutationObserver((records) => {
        for (const r of records) r.addedNodes.forEach((n) => { if (n.nodeName.toLowerCase() === 'svg') draws++; });
      });
      obs.observe(host, { childList: true, subtree: true });
      return () => { obs.takeRecords().forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeName.toLowerCase() === 'svg') draws++; })); obs.disconnect(); return draws; };
    };
    const staff = (p: { items?: MeasureStripItem[]; pps?: number; spans?: Span[]; scrollLeftPx?: number }) => (
      <ContinuousStaff
        items={p.items ?? items} pixelsPerSecond={p.pps ?? 150} scrollLeftPx={p.scrollLeftPx ?? 0} viewportWidth={800} height={220}
        spans={p.spans} onHitsReady={() => {}}
      />
    );

    it('merges several prop changes within one frame into one draw', () => {
      act(() => root.render(staff({})));
      expect(host.querySelectorAll('svg')).toHaveLength(1); // the first draw is immediate
      const stop = countDraws();
      act(() => root.render(staff({ items: items.map((it) => ({ ...it })) })));
      act(() => root.render(staff({ items: items.map((it) => ({ ...it })), pps: 160 })));
      act(() => root.render(staff({ items: items.map((it) => ({ ...it })), pps: 170, spans: [{ id: 's', type: 'slur', from: 'b', to: 'c' }] })));
      flushFrame();
      expect(stop()).toBe(1);
      expect(host.querySelectorAll('svg')).toHaveLength(1);
      expect(frames.size).toBe(0);
    });

    it('draws nothing until the frame, keeping the drawn staff where it was drawn', () => {
      act(() => root.render(staff({})));
      const svg = host.querySelector('svg');
      const wrapper = svg!.parentElement as HTMLElement;
      // A scroll far enough to move the render window: until the frame, the old
      // drawing stays up and the transform still places it at its own window.
      act(() => root.render(staff({ scrollLeftPx: 700 })));
      expect(host.querySelector('svg')).toBe(svg);
      expect(wrapper.style.transform).toBe('translateX(-1500px)'); // drawn from -800, viewed from 700
      flushFrame();
      expect(host.querySelector('svg')).not.toBe(svg);
      expect(wrapper.style.transform).toBe('translateX(-800px)'); // redrawn from -100
    });

    it('cancels a pending draw on unmount', () => {
      act(() => root.render(staff({})));
      act(() => root.render(staff({ pps: 160 })));
      expect(frames.size).toBe(1);
      act(() => root.unmount());
      expect(frames.size).toBe(0);
      root = createRoot(host);
    });
  });
});

describe('Sync rhythmic alignment', () => {
  it('centers downbeats and later attacks on their exact waveform times at different zoom and flex settings', async () => {
    const centers:number[]=[];
    const original=StaveNote.prototype.draw;
    const spy=vi.spyOn(StaveNote.prototype,'draw').mockImplementation(function(this:StaveNote) {
      centers.push(this.getNoteHeadBeginX()+this.getGlyphWidth()/2);
      return original.call(this);
    });
    const show=(map:(qn:number)=>number, bars=items, pps=150) => (
      <ContinuousStaff items={bars} pixelsPerSecond={pps} scrollLeftPx={0}
        viewportWidth={800} height={220} noteTimeForQN={map} onHitsReady={()=>{}} />
    );
    try {
      act(()=>root.render(show(qn=>qn/2)));
      // Render window starts at -800, hence local SVG coordinates include 800.
      expect(centers).toHaveLength(4);
      centers.forEach((x,i)=>expect(x-800).toBeCloseTo([0,150,300,450][i],5));
      centers.length=0;
      const stretched=items.map((item,i)=>({...item,
        startVideoTimeSeconds:i===0?0:3,endVideoTimeSeconds:i===0?3:5}));
      // First bar stretches from 2s to 3s; second keeps its duration.
      act(()=>root.render(show(qn=>qn<=4?qn*0.75:3+(qn-4)/2,stretched)));
      await act(async()=>{ await new Promise(r=>setTimeout(r,40)); });
      expect(centers).toHaveLength(4);
      centers.forEach((x,i)=>expect(x-800).toBeCloseTo([0,225,450,600][i],5));
      centers.length=0;
      // A beat adjustment without changing bar boundaries must also redraw.
      act(()=>root.render(show(qn=>({0:0,2:1.6,4:3,6:4.2}[qn]??0),stretched,200)));
      await act(async()=>{ await new Promise(r=>setTimeout(r,40)); });
      expect(centers).toHaveLength(4);
      centers.forEach((x,i)=>expect(x-800).toBeCloseTo([0,320,600,840][i],5));
    } finally { spy.mockRestore(); }
  });
});
