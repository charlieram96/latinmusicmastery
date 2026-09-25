// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clampNoteToolbarPosition, NoteToolbar, type NoteToolbarProps } from '../note-toolbar';
import type { ZoomEditing } from '../use-zoom-editing';

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
    enterPitch: vi.fn(),
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
    eventAt: vi.fn(() => null),
  };
}

const baseProps = (): Omit<NoteToolbarProps, 'editing' | 'onMore' | 'onPencil'> => ({
  left: 100,
  top: 50,
  info: 'E4',
  value: 'q',
  dots: 0,
  isRest: false,
  tie: false,
  tripletOn: false,
  hasSelection: true,
  percussion: null,
  pencil: false,
});

function render(overrides: Partial<NoteToolbarProps> = {}) {
  const editing = makeEditing();
  const onMore = vi.fn();
  const onPencil = vi.fn();
  act(() => {
    root.render(<NoteToolbar {...baseProps()} editing={editing} onMore={onMore} onPencil={onPencil} {...overrides} />);
  });
  return { editing, onMore, onPencil };
}

const buttons = () => Array.from(host.querySelectorAll('button'));
const byLabel = (name: string) => buttons().find((b) => b.getAttribute('aria-label') === name)!;

describe('NoteToolbar', () => {
  it('shows the info chip, then every button in order', () => {
    render();
    const bar = host.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Note');
    expect(bar.querySelector('.st-fbar-info')!.textContent).toBe('E4');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Whole', 'Half', 'Quarter', '8th', '16th',
      'Dot', 'Rest', 'Tie',
      'Flat', 'Natural', 'Sharp',
      'Triplet', 'More', 'Pencil', 'Delete',
    ]);
  });

  it('toggles the pencil from its button, titled with its key', () => {
    const { onPencil } = render({ pencil: true });
    const pencil = byLabel('Pencil');
    expect(pencil.getAttribute('title')).toBe('Click to add (N)');
    expect(pencil.getAttribute('aria-pressed')).toBe('true');
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { pencil.dispatchEvent(down); });
    expect(down.defaultPrevented).toBe(true);
    act(() => { pencil.click(); });
    expect(onPencil).toHaveBeenCalledTimes(1);
  });

  it('marks the current value, dot, rest, tie and triplet pressed', () => {
    render({ value: 'q', dots: 1, isRest: true, tie: true, tripletOn: true });
    expect(byLabel('Quarter').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Whole').getAttribute('aria-pressed')).toBe('false');
    expect(byLabel('Dot').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Rest').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Tie').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Triplet').getAttribute('aria-pressed')).toBe('true');
  });

  it('calls accidental(1) when ♯ is clicked', () => {
    const { editing } = render();
    act(() => { byLabel('Sharp').click(); });
    expect(editing.accidental).toHaveBeenCalledWith(1);
  });

  it('calls setValue for a duration button', () => {
    const { editing } = render();
    act(() => { byLabel('8th').click(); });
    expect(editing.setValue).toHaveBeenCalledWith('8');
  });

  it('hides Delete without a selection', () => {
    render({ hasSelection: false });
    expect(buttons().find((b) => b.getAttribute('aria-label') === 'Delete')).toBeUndefined();
  });

  it('shows stroke buttons instead of ♭♮♯ on a percussion track', () => {
    const { editing } = render({
      percussion: {
        strokes: [{ midi: 60, label: 'Open' }, { midi: 61, label: 'Slap' }],
        current: 60,
      },
    });
    expect(buttons().find((b) => b.getAttribute('aria-label') === 'Flat')).toBeUndefined();
    expect(buttons().find((b) => b.getAttribute('aria-label') === 'Natural')).toBeUndefined();
    expect(buttons().find((b) => b.getAttribute('aria-label') === 'Sharp')).toBeUndefined();
    const strokeButtons = buttons().filter((b) => ['Open', 'Slap'].includes(b.getAttribute('aria-label') ?? ''));
    expect(strokeButtons).toHaveLength(2);
    expect(byLabel('Open').getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('Slap').getAttribute('aria-pressed')).toBe('false');
    act(() => { byLabel('Slap').click(); });
    expect(editing.enterStroke).toHaveBeenCalledWith(61);
  });

  it('calls onMore when "More ▾" is clicked', () => {
    const { onMore } = render();
    act(() => { byLabel('More').click(); });
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('keeps focus out of the toolbar on mousedown', () => {
    render();
    const btn = byLabel('Quarter');
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { btn.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('draws the rest glyph on the Rest button', () => {
    render();
    expect(byLabel('Rest').querySelector('svg')).not.toBeNull();
  });

  // Fix round 1: the caller measures the toolbar's real size to clamp it, and
  // caps its width so a long percussion stroke row wraps instead of overflowing.
  it('forwards a ref to its root element, tagged for measuring', () => {
    let node: HTMLDivElement | null = null;
    act(() => {
      root.render(<NoteToolbar {...baseProps()} editing={makeEditing()} onMore={vi.fn()} onPencil={vi.fn()} ref={(el) => { node = el; }} />);
    });
    expect(node).not.toBeNull();
    expect(node).toBe(host.querySelector('[data-testid="note-toolbar"]'));
  });

  it('caps its width and wraps when given maxWidth, and stays unbounded without it', () => {
    render({ maxWidth: 300 });
    const bar = host.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar.style.maxWidth).toBe('300px');
    expect(bar.style.flexWrap).toBe('wrap');

    render({ maxWidth: undefined });
    const bar2 = host.querySelector<HTMLElement>('[role="toolbar"]')!;
    expect(bar2.style.maxWidth).toBe('');
    expect(bar2.style.flexWrap).toBe('');
  });
});

describe('clampNoteToolbarPosition', () => {
  it('leaves the anchor alone when nothing is measured yet', () => {
    expect(clampNoteToolbarPosition(10, 20, { w: 0, h: 0 }, { centerW: 0, bodyH: 0 })).toEqual({ left: 10, top: 20 });
  });

  it('clamps left inside [halfW, centerW - halfW]', () => {
    // halfW = 200/2 + 8 = 108; bound = [108, 592 - 108] = [108, 484].
    expect(clampNoteToolbarPosition(0, 0, { w: 200, h: 0 }, { centerW: 592, bodyH: 0 }).left).toBe(108);
    expect(clampNoteToolbarPosition(1000, 0, { w: 200, h: 0 }, { centerW: 592, bodyH: 0 }).left).toBe(484);
    expect(clampNoteToolbarPosition(300, 0, { w: 200, h: 0 }, { centerW: 592, bodyH: 0 }).left).toBe(300);
  });

  it('clamps top inside [0, bodyH - height]', () => {
    expect(clampNoteToolbarPosition(0, -50, { w: 0, h: 40 }, { centerW: 0, bodyH: 172 }).top).toBe(0);
    expect(clampNoteToolbarPosition(0, 1000, { w: 0, h: 40 }, { centerW: 0, bodyH: 172 }).top).toBe(132);
    expect(clampNoteToolbarPosition(0, 60, { w: 0, h: 40 }, { centerW: 0, bodyH: 172 }).top).toBe(60);
  });

  it('collapses to a single edge when the toolbar is bigger than the bound on that axis', () => {
    // halfW = 900/2 + 8 = 458; centerW - halfW = 592 - 458 = 134 < 458, so the
    // clamp always lands on 458 regardless of the raw x.
    expect(clampNoteToolbarPosition(0, 0, { w: 900, h: 0 }, { centerW: 592, bodyH: 0 }).left).toBe(458);
    expect(clampNoteToolbarPosition(5000, 0, { w: 900, h: 0 }, { centerW: 592, bodyH: 0 }).left).toBe(458);
    // bodyH - h = 172 - 300 = -128 < 0, so top always lands on 0.
    expect(clampNoteToolbarPosition(0, 0, { w: 0, h: 300 }, { centerW: 0, bodyH: 172 }).top).toBe(0);
    expect(clampNoteToolbarPosition(0, 900, { w: 0, h: 300 }, { centerW: 0, bodyH: 172 }).top).toBe(0);
  });
});
