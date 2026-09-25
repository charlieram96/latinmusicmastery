// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteToolbar, type NoteToolbarProps } from '../note-toolbar';
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

const baseProps = (): Omit<NoteToolbarProps, 'editing' | 'onMore'> => ({
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
});

function render(overrides: Partial<NoteToolbarProps> = {}) {
  const editing = makeEditing();
  const onMore = vi.fn();
  act(() => {
    root.render(<NoteToolbar {...baseProps()} editing={editing} onMore={onMore} {...overrides} />);
  });
  return { editing, onMore };
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
      'Triplet', 'More', 'Delete',
    ]);
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
});
