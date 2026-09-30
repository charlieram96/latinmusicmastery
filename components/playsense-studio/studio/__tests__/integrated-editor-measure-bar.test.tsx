// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../integrated-editor';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

const makeScore = (bars: number, noteQN = 4): ScoreDocument => ({
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
    measures: Array.from({ length: bars }, (_, i) => ({ number: i + 1, voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: noteQN }] }] })),
  }],
} as ScoreDocument);
const score = makeScore(3);
const timingsFor = (bars: number): IntegratedEditorMeasureTiming[] => Array.from({ length: bars }, (_, i) => ({
  measureNumber: i + 1, startVideoTimeSeconds: i * 2, endVideoTimeSeconds: i * 2 + 2,
}));

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
  it('keeps Sync measure commands docked even when the selected range is offscreen', () => {
    const { dispatch } = render({ pageWorkspace: false, scrollLeftPx: 3000 });
    const controls = host.querySelector('[data-testid="sync-measure-controls"]')!;
    expect(toolbar()?.classList.contains('is-docked')).toBe(true);
    expect(barButton('Delete').disabled).toBe(true);
    expect(barButton('Copy').disabled).toBe(true);
    const select = [...controls.querySelectorAll('button')].find(b => b.textContent === 'Select measures')!;
    act(() => select.click());
    expect(barButton('Copy').disabled).toBe(false);
    expect(toolbar()?.classList.contains('is-docked')).toBe(true);
    act(() => barButton('Copy').click());
    expect(dispatched(dispatch, 'copy-measures')[0]).toMatchObject({ start: 0, count: 1 });
    const end = controls.querySelector<HTMLSelectElement>('[aria-label="To measure"]')!;
    act(() => { end.value = '1'; end.dispatchEvent(new Event('change', { bubbles: true })); });
    act(() => barButton('Duplicate').click());
    expect(dispatched(dispatch, 'duplicate-measures')[0]).toMatchObject({ start: 0, count: 2 });
    act(() => barButton('Delete').click());
    expect(dispatched(dispatch, 'delete-measures')[0]).toMatchObject({ start: 0, count: 2 });
  });

  it('applies four total passes to selected Sync measures 1–2 only after Apply', () => {
    const { dispatch } = render({pageWorkspace:false});
    key('ArrowRight');
    key('ArrowRight',{shiftKey:true});
    act(()=>barButton('Repeat').click());
    const button=(label:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(b=>b.textContent===label)!;
    act(()=>button('×4').dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    act(()=>button('×4').click());
    expect(dispatched(dispatch,'repeat-measures')).toEqual([]);
    act(()=>button('Apply').click());
    expect(dispatched(dispatch,'repeat-measures')).toEqual([
      expect.objectContaining({trackIndex:0,start:0,end:1,count:4})
    ]);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('adds a measure from the visible Sync controls without selecting notes', () => {
    const { dispatch } = render({ pageWorkspace: false });
    const controls = host.querySelector('[data-testid="sync-measure-controls"]')!;
    const add = [...controls.querySelectorAll('button')].find(b => b.textContent === 'Add measure after')!;
    act(() => add.click());
    expect(dispatched(dispatch, 'insert-measure')[0]).toMatchObject({ index: 3, trackIndex: 0 });
  });

  it('exposes a resize grip on the selected Sync measure without clearing selection', () => {
    const resize = vi.fn();
    render({pageWorkspace:false,onResizeMeasures:resize});
    key('ArrowRight');
    const grip=host.querySelector<HTMLButtonElement>('[aria-label="Drag to resize selected measures"]')!;
    expect(grip).not.toBeNull();
    grip.hasPointerCapture=()=>true;
    for(const type of ['pointerdown','pointermove','pointerup']) {
      const event=new MouseEvent(type,{bubbles:true,clientX:300,button:0});
      Object.defineProperty(event,'pointerId',{value:1});
      act(()=>grip.dispatchEvent(event));
    }
    expect(resize).toHaveBeenCalledWith(0,0,3,'move');
    expect(resize).toHaveBeenCalledWith(0,0,3,'end');
    expect(barButton('Copy').disabled).toBe(false);
  });

  it('floats over the selected bars with their number and tempo', () => {
    render();
    expect(toolbar()).toBeNull();
    key('ArrowRight'); // nothing selected → bar 1
    key('ArrowRight', { shiftKey: true });
    const info = toolbar()!.querySelector('.st-fbar-info')!.textContent!;
    expect(info).toContain('m.1–2');
    expect(info).not.toContain('0:00.0');
    expect(info).toContain('≈120.0');
    expect(info).not.toContain('BPM');
  });

  it('shows ×n on Repeat when the selected bars are in a repeat group', () => {
    const repMeasures = [0, 1, 2, 3].map((i) => ({
      number: i + 1,
      voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: 4 }] }],
      repeat: { id: 'r1', pass: Math.floor(i / 2), offset: i % 2, length: 2, count: 2 },
    }));
    const repScore: ScoreDocument = { ...score, tracks: [{ ...score.tracks[0], measures: repMeasures }] };
    render({ score: repScore, measureTimings: timingsFor(4) });
    key('ArrowRight'); // selects bar 1 (index 0), inside the repeat group's first pass
    expect(barButton('Repeat').textContent).toContain('×2');
    const band=host.querySelector<HTMLButtonElement>('.st-rband')!;
    act(()=>band.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
    act(()=>band.click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(toolbar()).not.toBeNull();
    act(()=>barButton('Repeat').click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
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

  it('⌘D duplicates the bars and selects the copies once they arrive', () => {
    // The parent accepts the edit: the score grows by the two copies.
    const grow = vi.fn(() => {
      root.render(
        <IntegratedEditor score={makeScore(5)} dispatch={grow} measureTimings={timingsFor(5)} pixelsPerSecond={100}
          scrollLeftPx={0} viewportWidth={800} onRequestZoom={() => {}} />,
      );
    });
    render({ dispatch: grow });
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    key('d', { metaKey: true });
    expect(dispatched(grow, 'duplicate-measures')).toEqual([{ type: 'duplicate-measures', trackIndex: 0, start: 0, count: 2 }]);
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.3–4');
  });

  it('a refused duplicate leaves the selection on the original bars', () => {
    const { dispatch } = render(); // dispatch does nothing: the parent refused
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    key('d', { metaKey: true });
    expect(dispatched(dispatch, 'duplicate-measures')).toHaveLength(1);
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.1–2');
    // A later, unrelated score change doesn't resurrect the stale plan.
    render({ score: makeScore(3) });
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.1–2');
  });

  it('drops a refused duplicate’s plan, so a later undo reaching the same bar count doesn’t select', () => {
    const { dispatch } = render(); // no-op dispatch: the parent refused
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    key('d', { metaKey: true });
    act(() => { vi.advanceTimersByTime(1); });
    // An undo/redo (straight to useEditor, not through dispatch) lands on 3 + 2 bars.
    render({ dispatch, score: makeScore(5), measureTimings: timingsFor(5) });
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.1–2');
    expect(host.querySelector('.is-new')).toBeNull();
  });

  it('a selection made after a refused duplicate also drops its plan', () => {
    const { dispatch } = render();
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    key('d', { metaKey: true });
    key('ArrowRight'); // the admin moves on: m.3
    render({ dispatch, score: makeScore(5), measureTimings: timingsFor(5) });
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.3');
    expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).not.toContain('m.3–4');
  });

  it('an accepted edit selects its bars before the drop timer fires (real scheduling, no act)', async () => {
    vi.useRealTimers();
    function Host() {
      const [sc, setSc] = React.useState(() => makeScore(3));
      const n = sc.tracks[0].measures.length;
      const dispatch = (a: { type: string; count?: number }) => {
        if (a.type === 'duplicate-measures') setSc(makeScore(n + (a.count ?? 0)));
      };
      return (
        <IntegratedEditor score={sc} dispatch={dispatch as never} measureTimings={timingsFor(n)} pixelsPerSecond={100}
          scrollLeftPx={0} viewportWidth={800} onRequestZoom={() => {}} />
      );
    }
    act(() => { root.render(<Host />); });
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true, bubbles: true, cancelable: true }));
      // The editor's drop timer was queued first, so it has fired by now; had
      // it fired before the edit's effect consumed the plan, the copies would
      // never be selected. Give React's follow-up render time to land.
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 20));
      expect(toolbar()!.querySelector('.st-fbar-info')!.textContent).toContain('m.3–4');
    } finally {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    }
  });

  it('keeps the Score palette at the top when selection or scrolling changes', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('st-fbar') ? 400 : 0;
    });
    try {
      render();
      key('ArrowRight');
      expect(toolbar()!.getAttribute('style')).toContain('left: 212px');
      key('ArrowRight');
      key('ArrowRight');
      expect(toolbar()!.getAttribute('style')).toContain('left: 212px');
      render({ scrollLeftPx: 100 });
      expect(toolbar()!.getAttribute('style')).toContain('left: 212px');
      render({ viewportWidth: 300, scrollLeftPx: 300 });
      expect(toolbar()!.getAttribute('style')).toContain('left: 212px');
    } finally {
      spy.mockRestore();
    }
  });

  it('before measuring, assumes a 600 px bar', () => {
    render();
    key('ArrowRight');
    expect(toolbar()!.getAttribute('style')).toContain('left: 312px');
  });

  it('⏎ does nothing on the Piano-roll tab — note entry lives in the zoom, which only the staff tab shows', () => {
    const { dispatch } = render({ score: makeScore(3, 1) });
    key('ArrowRight');
    const tab = host.querySelector<HTMLButtonElement>('[aria-label="Piano-roll"]')!;
    act(() => { tab.click(); });
    key('Enter');
    expect(dispatched(dispatch, 'add-note')).toHaveLength(0);
  });

  // Final review Minor 4: the corner (position: absolute) used to sit INSIDE
  // the piano-roll's own overflow-y-auto scroller, so it scrolled away. It
  // must be a sibling of the scroller, pinned against a non-scrolling wrapper.
  it('keeps the corner outside the piano-roll scroller so it stays pinned', () => {
    render();
    const tab = host.querySelector<HTMLButtonElement>('[aria-label="Piano-roll"]')!;
    act(() => { tab.click(); });
    const corner = host.querySelector('.st-strip-corner')!;
    const scroller = host.querySelector('.overflow-y-auto')!;
    expect(scroller.contains(corner)).toBe(false);
    expect(corner.parentElement).toBe(scroller.parentElement);
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

  // Final review Important 3 / Minor 2: `notice` (a SyncPanel-level failure,
  // e.g. a refused edit or a failed Auto-place/Auto-align) turns the toast
  // red and never shows a `noticeAction` button — that's reserved for the
  // neutral `info` slot (see below). The local `flash` confirmation stays
  // neutral and never gets a button either.
  it('the flash toast (a neutral confirmation) is not styled as an error', () => {
    render();
    key('ArrowRight');
    act(() => { barButton('Clear').click(); });
    const toast = host.querySelector('.st-toast')!;
    expect(toast.textContent).toBe('Cleared. Timing kept.');
    expect(toast.classList.contains('is-bad')).toBe(false);
    expect(toast.querySelector('button')).toBeNull();
  });

  it('shows a passed-in notice as a red toast, with no action button even when one is given', () => {
    // A failed Auto-place/Auto-align (`notice`) must never pair with an Undo
    // for some earlier, unrelated success (Important 3): the action only ever
    // shows alongside `info`.
    const onUndo = vi.fn();
    render({ notice: 'Not enough clear hits to place the bars.', noticeAction: { label: 'Undo', onClick: onUndo } });
    const toast = host.querySelector('.st-toast')!;
    expect(toast.classList.contains('is-bad')).toBe(true);
    expect(toast.textContent).toBe('Not enough clear hits to place the bars.');
    expect(toast.querySelector('button')).toBeNull();
  });

  it('notice wins over flash and shows no button without a noticeAction', () => {
    render({ notice: 'Not enough clear hits to align the exercise.' });
    key('ArrowRight');
    act(() => { barButton('Clear').click(); }); // would also set the flash
    const toast = host.querySelector('.st-toast')!;
    expect(toast.textContent).toBe('Not enough clear hits to align the exercise.');
    expect(toast.querySelector('button')).toBeNull();
  });

  // Final review (Studio layout pass): a neutral `info` slot, distinct from
  // the red `notice` — Auto-place's "Bars auto-placed." toast needs a visible
  // Undo without reading as an error.
  it('shows a passed-in info as a neutral toast, with an action button when given', () => {
    const onUndo = vi.fn();
    render({ info: 'Bars auto-placed.', noticeAction: { label: 'Undo', onClick: onUndo } });
    const toast = host.querySelector('.st-toast')!;
    expect(toast.classList.contains('is-bad')).toBe(false);
    expect(toast.textContent).toBe('Bars auto-placed.Undo');
    const btn = toast.querySelector('button')!;
    expect(btn.textContent).toBe('Undo');
    act(() => { btn.click(); });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('info without a noticeAction shows no button', () => {
    render({ info: 'Flex was cleared because the bars moved' });
    const toast = host.querySelector('.st-toast')!;
    expect(toast.classList.contains('is-bad')).toBe(false);
    expect(toast.textContent).toBe('Flex was cleared because the bars moved');
    expect(toast.querySelector('button')).toBeNull();
  });

  it('notice wins over info and flash, and never shows an action button', () => {
    const onUndo = vi.fn();
    render({ notice: 'Not enough clear hits to place the bars.', info: 'Bars auto-placed.', noticeAction: { label: 'Undo', onClick: onUndo } });
    const toast = host.querySelector('.st-toast')!;
    expect(toast.classList.contains('is-bad')).toBe(true);
    expect(toast.textContent).toBe('Not enough clear hits to place the bars.');
    expect(toast.querySelector('button')).toBeNull();
  });

  it('Copy says what it copied', () => {
    render();
    key('ArrowRight');
    key('ArrowRight', { shiftKey: true });
    act(() => { barButton('Copy').click(); });
    expect(host.textContent).toContain('Copied m.1–2 with its timing.');
  });

  it('reports the measure zoom opening, so SyncPanel can leave F to it', () => {
    const onZoomOpenChange = vi.fn();
    render({ score: makeScore(3, 1), onZoomOpenChange });
    expect(onZoomOpenChange).toHaveBeenLastCalledWith(false);
    key('ArrowRight');
    key('Enter');
    expect(onZoomOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('⏎ zooms into the bar instead of adding a note', () => {
    const { dispatch, onRequestZoom } = render({ score: makeScore(3, 1) });
    key('ArrowRight');
    key('Enter');
    expect(onRequestZoom).not.toHaveBeenCalled();
    expect(dispatched(dispatch, 'add-note')).toEqual([]);
  });

  it('⌫ while typing in a field elsewhere on the page never deletes bars', () => {
    // The track name field moved out of the strip into the Score panel (Task
    // 5), a separate DOM subtree from IntegratedEditor — but the measure keys'
    // listener is bound on `window`, so it must still ignore Backspace typed
    // into it. A detached input stands in for that field here.
    const { dispatch } = render();
    key('ArrowRight');
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Track name');
    document.body.appendChild(input);
    input.focus();
    key('Backspace', {}, input);
    expect(dispatched(dispatch, 'delete-measures')).toEqual([]);
    key('Backspace');
    expect(dispatched(dispatch, 'delete-measures')).toEqual([{ type: 'delete-measures', trackIndex: 0, start: 0, count: 1 }]);
    input.remove();
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

  it('keeps instructions out of the staff before and after selecting bars', () => {
    render();
    const wrap = host.querySelector('[data-testid="staff-wrap"]')!;
    const foot = host.querySelector('.st-strip-foot')!;
    expect(wrap.contains(foot)).toBe(true);
    expect(foot.textContent).not.toContain('Drag across bars to select');
    key('ArrowRight');
    expect(host.querySelector('.st-strip-foot')!.textContent).not.toContain('edit notes');
  });

  it('the header “?” lists shortcuts without covering the staff', () => {
    render();
    const help = host.querySelector<HTMLButtonElement>('button[aria-label="Keyboard shortcuts"]')!;
    expect(help.closest('.lmm-desk-tools')).not.toBeNull();
    expect(host.querySelector('.st-strip-foot .st-help-btn')).toBeNull();
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
