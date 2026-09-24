// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Track } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import { EditableMeasureStrip, type MeasureStripItem } from '../editable-measure-strip';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  // The strip only draws measures inside its viewport; jsdom reports no width.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
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

const noop = () => {};

function renderStrip(track: Track, keyFifths = 0) {
  const items: MeasureStripItem[] = extractTrackEvents(track, [4, 4], keyFifths).map((b, i) => ({
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
  act(() => {
    root.render(
      <EditableMeasureStrip
        measures={items} pixelsPerSecond={100} scrollLeftPx={0} selected={null}
        onSelectEvent={noop} onSelectMeasureRange={noop} onOpenMeasure={noop} onRequestZoomTo={noop} onSetPitch={noop}
        accidental={0} keyFifths={keyFifths} isPercussion={false} percStrokes={null}
      />,
    );
  });
  return [...host.querySelectorAll('svg')].filter(svg => svg.querySelector('.vf-stave'));
}

const base = (measures: Track['measures']): Track => ({
  index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff', measures,
});

describe('EditableMeasureStrip', () => {
  it('draws a measure whose only notes are in voice 2', () => {
    const svgs = renderStrip(base([
      { number: 1, voices: [{ number: 1, events: [] }, { number: 2, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
    ]));
    expect(svgs).toHaveLength(1);
    expect(svgs[0].querySelectorAll('.vf-stavenote').length).toBe(1);
  });

  it('draws cancelling naturals on a key change to fewer accidentals', () => {
    const quarters = [{ number: 1, events: [62, 64, 66, 67].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 })) }];
    const svgs = renderStrip(base([
      { number: 1, voices: quarters },
      { number: 2, keyFifths: 0, voices: quarters },
    ]), 2);
    const sig = svgs[1].querySelector('.vf-keysignature');
    expect((sig?.textContent ?? '').split('').length - 1).toBe(2);
  });
});
