// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../integrated-editor';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const score: ScoreDocument = {
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
    measures: [1, 2, 3].map(number => ({ number, voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: 4 }] }] })),
  }],
} as ScoreDocument;

// Each bar is 2 s long: 4 quarter notes in 2 s is 120 BPM.
const timings: IntegratedEditorMeasureTiming[] = [0, 1, 2].map((i) => ({
  measureNumber: i + 1, startVideoTimeSeconds: i * 2, endVideoTimeSeconds: i * 2 + 2,
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

function render(props: Partial<React.ComponentProps<typeof IntegratedEditor>> = {}) {
  const dispatch = vi.fn();
  const onRequestZoom = vi.fn();
  act(() => {
    root.render(
      <IntegratedEditor
        score={score} dispatch={dispatch} measureTimings={timings} pixelsPerSecond={100} scrollLeftPx={0}
        viewportWidth={800} onRequestZoom={onRequestZoom} {...props}
      />,
    );
  });
  return { dispatch, onRequestZoom };
}

function key(k: string, mods: { metaKey?: boolean; shiftKey?: boolean } = {}, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, metaKey: !!mods.metaKey, shiftKey: !!mods.shiftKey, bubbles: true, cancelable: true }));
  });
}

const toolbar = () => host.querySelector('[role="toolbar"][aria-label="Selected bars"]');
const barButton = (name: string) => toolbar()!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const dispatched = (d: ReturnType<typeof vi.fn>, type: string) => d.mock.calls.map((c) => c[0]).filter((a) => a.type === type);

describe('IntegratedEditor measure bar', () => {
  it('floats over the selected bars with their number, start and tempo', () => {
    render();
    expect(toolbar()).toBeNull();
    key('ArrowRight'); // nothing selected → bar 1
    key('ArrowRight', { shiftKey: true });
    const info = toolbar()!.querySelector('.st-fbar-info')!.textContent!;
    expect(info).toContain('m.1–2');
    expect(info).toContain('0:00.0');
    expect(info).toContain('≈120.0 BPM');
  });

  it('can’t loop without a video, and loops the selected bars with one', () => {
    render();
    key('ArrowRight');
    expect(barButton('Loop').disabled).toBe(true);
    expect(barButton('Loop').title).toBe('Play the video to loop');

    const onLoopMeasures = vi.fn();
    render({ onLoopMeasures, loopedRange: [0, 0] });
    expect(barButton('Loop').getAttribute('aria-pressed')).toBe('true');
    act(() => { barButton('Loop').click(); });
    expect(onLoopMeasures).toHaveBeenCalledWith(0, 0);
  });

  it('⌘D duplicates the bars and selects the copies', () => {
    const { dispatch } = render();
    key('ArrowRight');
    key('d', { metaKey: true });
    expect(dispatched(dispatch, 'duplicate-measures')).toEqual([{ type: 'duplicate-measures', trackIndex: 0, start: 0, count: 1 }]);
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.2');
  });

  it('Clear empties the bars and says the timing stayed', () => {
    const { dispatch } = render();
    key('ArrowRight');
    act(() => { barButton('Clear').click(); });
    expect(dispatched(dispatch, 'clear-measures')).toEqual([{ type: 'clear-measures', trackIndex: 0, start: 0, count: 1 }]);
    expect(host.textContent).toContain('Cleared. Timing kept.');
    act(() => { vi.advanceTimersByTime(2600); });
    expect(host.textContent).not.toContain('Cleared. Timing kept.');
  });

  it('Copy says what it copied', () => {
    render();
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    act(() => { barButton('Copy').click(); });
    expect(host.textContent).toContain('Copied m.1–2 with its timing.');
  });

  it('⏎ zooms into the bar instead of adding a note', () => {
    const { dispatch, onRequestZoom } = render();
    key('ArrowRight');
    key('Enter');
    expect(onRequestZoom).toHaveBeenCalledTimes(1);
    expect(dispatched(dispatch, 'add-note')).toEqual([]);
  });

  it('⌫ while typing the track name never deletes bars', () => {
    const { dispatch } = render();
    key('ArrowRight');
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Track name"]')!;
    input.focus();
    key('Backspace', {}, input);
    expect(dispatched(dispatch, 'delete-measures')).toEqual([]);
    key('Backspace');
    expect(dispatched(dispatch, 'delete-measures')).toEqual([{ type: 'delete-measures', trackIndex: 0, start: 0, count: 1 }]);
  });

  it('closes an open bar menu when the selection moves', () => {
    render();
    key('ArrowRight');
    act(() => { barButton('Bar properties').click(); });
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    key('ArrowRight');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    act(() => { barButton('Repeat').click(); });
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    key('Escape'); // closes the menu only
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(toolbar()).not.toBeNull();
    key('Escape');
    expect(toolbar()).toBeNull();
  });

  it('the footer “?” lists the strip shortcuts', () => {
    render();
    const help = host.querySelector<HTMLButtonElement>('button[aria-label="Keyboard shortcuts"]')!;
    act(() => { help.click(); });
    const dialog = host.querySelector('[role="dialog"][aria-label="Strip shortcuts"]')!;
    expect(dialog.textContent).toContain('Drag across bars');
    expect(dialog.textContent).toContain('copy, paste after, duplicate');
 
    // A second press on "?" closes it (the menu's outside-press close runs first).
    const down = new MouseEvent('pointerdown', { bubbles: true });
    act(() => { help.dispatchEvent(down); help.click(); });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has no old measure buttons or Repeat panel in the editor bar', () => {
    render();
    key('ArrowRight');
    const text = host.textContent!;
    expect(text).not.toContain('Repeat measures');
    expect(text).not.toContain('Double bar');
    expect(text).not.toContain('Delete measure');
  });
});
