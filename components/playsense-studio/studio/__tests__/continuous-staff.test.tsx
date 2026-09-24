// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
});
