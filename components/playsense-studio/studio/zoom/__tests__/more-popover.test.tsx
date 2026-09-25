// @vitest-environment jsdom
import React, { act, useCallback, useReducer, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Measure, MusicalEvent, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorAction, type EditorState } from '@/lib/playsense-studio/editor-state';
import type { ZoomState } from '../measure-zoom';
import { MorePopover, type MoreTab } from '../more-popover';
import { useZoomEditing, type ZoomEditing } from '../use-zoom-editing';

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

function makeEditing(): ZoomEditing {
  return {
    enterLetter: vi.fn(),
    enterRest: vi.fn(),
    enterStroke: vi.fn(),
    setValue: vi.fn(),
    cycleDots: vi.fn(),
    tuplet: vi.fn(),
    toggleTie: vi.fn(),
    slur: vi.fn(),
    transpose: vi.fn(),
    accidental: vi.fn(),
    articulation: vi.fn(),
    ornament: vi.fn(),
    dynamic: vi.fn(),
    text: vi.fn(),
    grace: vi.fn(),
    remove: vi.fn(),
    walk: vi.fn(),
    bar: vi.fn(),
    selectedRefs: vi.fn(() => []),
    currentEvent: vi.fn(() => null),
  };
}

function render(overrides: Partial<React.ComponentProps<typeof MorePopover>> = {}) {
  const editing = overrides.editing ?? makeEditing();
  const onTab = vi.fn();
  const onClose = vi.fn();
  act(() => {
    root.render(
      <MorePopover
        anchor={{ left: 0, top: 0 }}
        tab="durations"
        onTab={onTab}
        onClose={onClose}
        event={null}
        editing={editing}
        watchLike={false}
        eventKey={null}
        {...overrides}
      />,
    );
  });
  return { editing, onTab, onClose };
}

const buttons = (root_ = host) => Array.from(root_.querySelectorAll('button'));
const byLabel = (label: string, root_ = host) => buttons(root_).find((b) => b.textContent?.trim() === label)!;
const tabButtons = () => Array.from(host.querySelector('[data-testid="more-tabs"]')!.querySelectorAll('button'));

// Bypasses React's own instrumented `value` setter, same trick as
// bar-popover.test.tsx / score-meta-editor.test.tsx.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function type(input: HTMLInputElement, value: string) {
  act(() => {
    nativeValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('MorePopover', () => {
  it('lists the tabs in order: Durations, Tuplets, Marks, Dynamics, Text, Timing', () => {
    render();
    expect(tabButtons().map((b) => b.textContent?.trim())).toEqual([
      'Durations', 'Tuplets', 'Marks', 'Dynamics', 'Text', 'Timing',
    ]);
  });

  it('marks the current tab pressed', () => {
    render({ tab: 'marks' });
    expect(tabButtons().find((b) => b.textContent?.trim() === 'Marks')!.getAttribute('aria-pressed')).toBe('true');
    expect(tabButtons().find((b) => b.textContent?.trim() === 'Durations')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onTab when a different tab is clicked', () => {
    const { onTab } = render();
    act(() => { tabButtons().find((b) => b.textContent?.trim() === 'Tuplets')!.click(); });
    expect(onTab).toHaveBeenCalledWith('tuplets');
  });

  describe('Durations', () => {
    it('shows the hint', () => {
      render({ tab: 'durations' });
      expect(host.querySelector('.st-mpop-hint')?.textContent).toBe(
        '32nd and 64th notes, double dot, double flat and double sharp.',
      );
    });

    it('Double dot calls cycleDots(2)', () => {
      const { editing } = render({ tab: 'durations' });
      act(() => { byLabel('Double dot').click(); });
      expect(editing.cycleDots).toHaveBeenCalledWith(2);
    });

    it('32nd, 64th, Double flat and Double sharp call their handlers', () => {
      const { editing } = render({ tab: 'durations' });
      act(() => { byLabel('32nd').click(); });
      expect(editing.setValue).toHaveBeenCalledWith('32');
      act(() => { byLabel('64th').click(); });
      expect(editing.setValue).toHaveBeenCalledWith('64');
      act(() => { byLabel('Double flat').click(); });
      expect(editing.accidental).toHaveBeenCalledWith(-2);
      act(() => { byLabel('Double sharp').click(); });
      expect(editing.accidental).toHaveBeenCalledWith(2);
    });
  });

  describe('Tuplets', () => {
    it('shows the hint', () => {
      render({ tab: 'tuplets' });
      expect(host.querySelector('.st-mpop-hint')?.textContent).toBe(
        'Splits the selected note into a group, then type pitches over it. Pick the same one again to undo.',
      );
    });

    it('5:4 calls tuplet(5, 4)', () => {
      const { editing } = render({ tab: 'tuplets' });
      act(() => { byLabel('5:4').click(); });
      expect(editing.tuplet).toHaveBeenCalledWith(5, 4);
    });

    it('marks 3:2 pressed for a 3:2 event, and no other', () => {
      const event: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1 / 3, tuplet: { id: 't1', n: 3, m: 2 } };
      render({ tab: 'tuplets', event });
      expect(byLabel('3:2').getAttribute('aria-pressed')).toBe('true');
      expect(byLabel('5:4').getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Marks', () => {
    it('Fermata calls articulation("fermata")', () => {
      const { editing } = render({ tab: 'marks' });
      act(() => { byLabel('Fermata').click(); });
      expect(editing.articulation).toHaveBeenCalledWith('fermata');
    });

    it('Acciaccatura calls grace(true), Appoggiatura calls grace(false)', () => {
      const { editing } = render({ tab: 'marks' });
      act(() => { byLabel('Acciaccatura').click(); });
      expect(editing.grace).toHaveBeenCalledWith(true);
      act(() => { byLabel('Appoggiatura').click(); });
      expect(editing.grace).toHaveBeenCalledWith(false);
    });

    it('marks the current articulations and ornament pressed', () => {
      const event: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, articulations: ['accent', 'marcato'], ornament: 'trill' };
      render({ tab: 'marks', event });
      expect(byLabel('Accent').getAttribute('aria-pressed')).toBe('true');
      expect(byLabel('Marcato').getAttribute('aria-pressed')).toBe('true');
      expect(byLabel('Staccato').getAttribute('aria-pressed')).toBe('false');
      expect(byLabel('Trill').getAttribute('aria-pressed')).toBe('true');
      expect(byLabel('Mordent').getAttribute('aria-pressed')).toBe('false');
    });

    it('Trill, Mordent, Turn call ornament(...)', () => {
      const { editing } = render({ tab: 'marks' });
      act(() => { byLabel('Mordent').click(); });
      expect(editing.ornament).toHaveBeenCalledWith('mordent');
    });
  });

  describe('Dynamics', () => {
    it('mf calls dynamic("mf")', () => {
      const { editing } = render({ tab: 'dynamics' });
      act(() => { byLabel('mf').click(); });
      expect(editing.dynamic).toHaveBeenCalledWith('mf');
    });

    it('Crescendo calls slur("cresc"), Diminuendo slur("dim"), Slur (S) slur("slur")', () => {
      const { editing } = render({ tab: 'dynamics' });
      act(() => { byLabel('Crescendo').click(); });
      expect(editing.slur).toHaveBeenCalledWith('cresc');
      act(() => { byLabel('Diminuendo').click(); });
      expect(editing.slur).toHaveBeenCalledWith('dim');
      act(() => { byLabel('Slur (S)').click(); });
      expect(editing.slur).toHaveBeenCalledWith('slur');
    });

    it('marks the current dynamic pressed', () => {
      const event: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, dynamic: 'mf' };
      render({ tab: 'dynamics', event });
      expect(byLabel('mf').getAttribute('aria-pressed')).toBe('true');
      expect(byLabel('f').getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Text', () => {
    it('pre-fills the input with the event text', () => {
      const event: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, text: 'dolce' };
      render({ tab: 'text', event });
      expect((host.querySelector('[aria-label="Text"]') as HTMLInputElement).value).toBe('dolce');
    });

    it('submitting the input calls text(value)', () => {
      const { editing } = render({ tab: 'text' });
      const input = host.querySelector('[aria-label="Text"]') as HTMLInputElement;
      type(input, 'dolce');
      act(() => { byLabel('Set').click(); });
      expect(editing.text).toHaveBeenCalledWith('dolce');
    });

    it('the div. chip calls text("div.")', () => {
      const { editing } = render({ tab: 'text' });
      act(() => { byLabel('div.').click(); });
      expect(editing.text).toHaveBeenCalledWith('div.');
    });

    it('shows every chip', () => {
      render({ tab: 'text' });
      for (const chip of ['dolce', 'pizz.', 'arco', 'div.', 'a tempo', 'rit.', 'montuno', 'solo']) {
        expect(byLabel(chip)).toBeTruthy();
      }
    });
  });

  describe('Timing', () => {
    it('shows the fallback text without a timing object', () => {
      render({ tab: 'timing', timing: undefined });
      expect(host.textContent).toContain('Timing is set on the waveform for synced lessons.');
    });

    it('shows "Plays at", the hint, and +5 ms calls onNudge(5); −5 ms calls onNudge(-5)', () => {
      const timing = {
        offsetMs: 12,
        gridSeconds: 1,
        actualSeconds: 1.5,
        onNudge: vi.fn(),
        onSnap: vi.fn(),
        onReset: vi.fn(),
      };
      render({ tab: 'timing', timing });
      expect(host.textContent).toContain('Plays at 0:01.5');
      expect(host.querySelector('.st-mpop-hint')?.textContent).toBe('Nudge moves only this note against the recording.');
      act(() => { byLabel('+5 ms').click(); });
      expect(timing.onNudge).toHaveBeenCalledWith(5);
      act(() => { byLabel('−5 ms').click(); });
      expect(timing.onNudge).toHaveBeenCalledWith(-5);
    });

    it('Reset calls onReset', () => {
      const timing = {
        offsetMs: 12, gridSeconds: 1, actualSeconds: 1.5,
        onNudge: vi.fn(), onSnap: vi.fn(), onReset: vi.fn(),
      };
      const { } = render({ tab: 'timing', timing });
      act(() => { byLabel('Reset').click(); });
      expect(timing.onReset).toHaveBeenCalledTimes(1);
    });
  });

  // Fix round 1: every action button (tabs, chips, Durations/Tuplets/Marks/
  // Dynamics/Timing) must keep focus out of the dialog on mousedown, as the
  // note toolbar's own buttons do — otherwise a keydown that follows lands on
  // an element inside role="dialog" and isTypingTarget blocks it (Bug 1).
  // Only the Text input and its Set submit are meant to take focus.
  describe('Fix round 1 — focus stays out of the dialog', () => {
    const timing = {
      offsetMs: 12, gridSeconds: 1, actualSeconds: 1.5,
      onNudge: vi.fn(), onSnap: vi.fn(), onReset: vi.fn(),
    };
    const tuplEvent: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1 / 3, tuplet: { id: 't1', n: 3, m: 2 } };
    const marksEvent: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, articulations: ['accent'], ornament: 'trill' };
    const dynEvent: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, dynamic: 'mf' };

    it.each<MoreTab>(['durations', 'tuplets', 'marks', 'dynamics', 'text', 'timing'])(
      'every button prevents mousedown default on the %s tab, except the Text Set submit',
      (tab) => {
        const event = tab === 'tuplets' ? tuplEvent : tab === 'marks' ? marksEvent : tab === 'dynamics' ? dynEvent : null;
        render({ tab, event, timing });
        for (const btn of buttons()) {
          const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
          act(() => { btn.dispatchEvent(ev); });
          if (btn.type === 'submit') {
            expect(ev.defaultPrevented).toBe(false);
          } else {
            expect(ev.defaultPrevented).toBe(true);
          }
        }
      },
    );
  });

  describe('Fix round 1 — Text tab re-seeds on note identity, not text', () => {
    it('re-seeds when the cursor moves to a different note even if its text matches', () => {
      const eventA: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, text: '' };
      const eventB: MusicalEvent = { kind: 'note', midi: 62, durationQN: 1, text: '' };
      const { editing, onTab, onClose } = render({ tab: 'text', event: eventA, eventKey: 'm0:0:0' });
      const input = () => host.querySelector('[aria-label="Text"]') as HTMLInputElement;
      type(input(), 'dolce'); // typed but never submitted
      expect(input().value).toBe('dolce');
      act(() => {
        root.render(
          <MorePopover
            anchor={{ left: 0, top: 0 }} tab="text" onTab={onTab} onClose={onClose}
            event={eventB} editing={editing} watchLike={false} eventKey="m0:0:1"
          />,
        );
      });
      // The new note's (empty) text wins — the old draft doesn't leak onto it.
      expect(input().value).toBe('');
    });

    it('keeps an in-progress draft across a re-render of the same note (identity unchanged)', () => {
      const eventA: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1, text: '' };
      const { editing, onTab, onClose } = render({ tab: 'text', event: eventA, eventKey: 'm0:0:0' });
      const input = () => host.querySelector('[aria-label="Text"]') as HTMLInputElement;
      type(input(), 'dolce');
      act(() => {
        root.render(
          <MorePopover
            anchor={{ left: 0, top: 0 }} tab="text" onTab={onTab} onClose={onClose}
            event={eventA} editing={editing} watchLike={false} eventKey="m0:0:0"
          />,
        );
      });
      expect(input().value).toBe('dolce');
    });
  });
});

// ---- Review Focus 5: typing in the Text input never runs note entry -------

const n = (midi: number): MusicalEvent => ({ kind: 'note', midi, durationQN: 1, id: `n${midi}` });
const bar = (number: number, events: MusicalEvent[]): Measure => ({ number, voices: [{ number: 1, events }] });
const doc = (bar1: MusicalEvent[], instrument: Track['instrument'] = 'piano'): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'native', initialTempo: 100, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument, displayName: 'P', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: [bar(1, bar1)],
  }],
});

function TypingHarness({ tab, dispatchSpy }: { tab: MoreTab; dispatchSpy: (a: EditorAction) => void }) {
  const [state, dispatchRaw] = useReducer(
    editorReducer,
    doc([n(60)]),
    (s): EditorState => ({ score: s, past: [], future: [], isDirty: false }),
  );
  const dispatch = useCallback((a: EditorAction) => { dispatchSpy(a); dispatchRaw(a); }, [dispatchSpy]);
  const [zoom, setZoom] = useState<ZoomState | null>({
    measureIndex: 0,
    cursor: { measureIndex: 0, voice: 0, index: 0, anchor: null },
    value: 'q', dots: 0, pencil: false,
  });
  const editing = useZoomEditing({
    score: state.score, dispatch, trackIndex: 0, zoom, setZoom,
    keyFifthsAt: () => 0, clefAt: () => 'treble', barQNAt: () => 4,
    percussion: false, flash: vi.fn(), openBar: vi.fn(), close: vi.fn(),
  });
  return (
    <MorePopover
      anchor={{ left: 0, top: 0 }}
      tab={tab}
      onTab={() => {}}
      onClose={() => {}}
      event={editing.currentEvent()}
      editing={editing}
      watchLike={false}
      eventKey="0:0:0"
    />
  );
}

describe('MorePopover Text tab — Review Focus 5', () => {
  it('typing "d" into the Text input never enters a note (the zoom key listener treats it as typing)', () => {
    const dispatchSpy = vi.fn();
    act(() => {
      root.render(<TypingHarness tab="text" dispatchSpy={dispatchSpy} />);
    });
    const input = host.querySelector('[aria-label="Text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true }));
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

// ---- Fix round 1, Bug 1: zoom keys keep working after a popover button click ----
//
// jsdom doesn't itself move focus on a synthetic mousedown/click (unlike a
// real browser's default action for a focusable control), so the test plays
// that default action out explicitly: focus only follows when the mousedown
// wasn't prevented — exactly the branch this fix adds.

describe('MorePopover — Fix round 1: clicking a tab button never steals the zoom keys', () => {
  it('clicking Tuplets → 3:2 applies it, and a following key still enters a note', () => {
    const dispatchSpy = vi.fn();
    act(() => {
      root.render(<TypingHarness tab="tuplets" dispatchSpy={dispatchSpy} />);
    });
    const btn = byLabel('3:2');
    act(() => {
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      btn.dispatchEvent(down);
      // What a real browser does by default on mousedown, unless prevented.
      if (!down.defaultPrevented) btn.focus();
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(dispatchSpy).toHaveBeenCalled(); // the tuplet was applied
    expect(document.activeElement).not.toBe(btn); // focus never moved onto it

    dispatchSpy.mockClear();
    const target = document.activeElement ?? document.body;
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true }));
    });
    expect(dispatchSpy).toHaveBeenCalled(); // note entry still runs
  });
});
