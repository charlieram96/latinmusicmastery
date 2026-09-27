// @vitest-environment jsdom
import React, { act, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorState } from '@/lib/playsense-studio/editor-state';

const extractSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@/lib/playsense-studio/score-to-vexflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/playsense-studio/score-to-vexflow')>();
  return {
    ...actual,
    extractTrackEvents: (...args: Parameters<typeof actual.extractTrackEvents>) => {
      extractSpy.calls++;
      return actual.extractTrackEvents(...args);
    },
  };
});

import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../integrated-editor';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
});

const score: ScoreDocument = {
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
    measures: [1, 2].map(number => ({ number, voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: 4 }] }] })),
  }],
} as ScoreDocument;

const timings = (shift: number): IntegratedEditorMeasureTiming[] => [
  { measureNumber: 1, startVideoTimeSeconds: shift, endVideoTimeSeconds: shift + 2 },
  { measureNumber: 2, startVideoTimeSeconds: shift + 2, endVideoTimeSeconds: shift + 4 },
];

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
function render(measureTimings: IntegratedEditorMeasureTiming[]) {
  act(() => {
    root.render(
      <IntegratedEditor
        score={score} dispatch={noop} measureTimings={measureTimings} pixelsPerSecond={100} scrollLeftPx={0}
        viewportWidth={800} onRequestZoom={noop}
      />,
    );
  });
}

describe('IntegratedEditor strip items', () => {
  it('does not re-extract the track when only the sync markers move', () => {
    render(timings(0));
    const afterMount = extractSpy.calls;
    expect(afterMount).toBeGreaterThan(0);
    render(timings(0.5));
    render(timings(1));
    expect(extractSpy.calls).toBe(afterMount);
  });

  it('has no editor row: the tools sit in the strip corner', () => {
    render(timings(0));
    expect(host.querySelector('input[aria-label="Track name"]')).toBeNull();
    const corner = host.querySelector('.st-strip-corner')!;
    expect(corner).not.toBeNull();
    expect(corner.querySelector('[aria-label="Staff"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Piano-roll"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Record MIDI"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Add a measure at the end"]')).not.toBeNull();
  });

  // Review Focus 4: the docked toolbar's buttons keep focus where it was
  // (onMouseDown preventDefault), so the zoom's window key handler still
  // gets the digits after a click.
  it('keeps the zoom keys working after a docked toolbar button is clicked', () => {
    function Harness() {
      const [state, dispatch] = useReducer(editorReducer, score, (s): EditorState => ({ score: s, past: [], future: [], isDirty: false }));
      return (
        <IntegratedEditor
          score={state.score} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0}
          viewportWidth={800} onRequestZoom={noop}
        />
      );
    }
    act(() => { root.render(<Harness />); });
    const key = (k: string) => act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    });
    key('ArrowRight'); // select bar 0
    key('Enter'); // open the zoom on it, its note selected
    const dock = () => host.querySelector('.st-zoom-dock')!;
    const quarter = dock().querySelector<HTMLButtonElement>('[aria-label="Quarter"]')!;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { quarter.dispatchEvent(down); quarter.click(); });
    expect(down.defaultPrevented).toBe(true);
    expect(dock().querySelector('[aria-label="Quarter"]')!.getAttribute('aria-pressed')).toBe('true');
    key('6'); // KEY_VALUE: 6 is Half
    expect(dock().querySelector('[aria-label="Half"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});
