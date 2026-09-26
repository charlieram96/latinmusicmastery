// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeasureSelection } from '@/lib/playsense-studio/measure-selection';
import { useMeasureKeys } from '../use-measure-keys';

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

type Opts = Parameters<typeof useMeasureKeys>[0];

function Probe(props: Opts) {
  useMeasureKeys(props);
  return <input aria-label="Title" />;
}

function mount(over: Partial<Opts> = {}) {
  const cb = {
    onSelection: vi.fn(), onOpen: vi.fn(), onCopy: vi.fn(), onPaste: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn(),
    onLoop: vi.fn(),
  };
  const selection: MeasureSelection | null = { anchor: 2, focus: 2 };
  act(() => { root.render(<Probe enabled count={6} selection={selection} {...cb} {...over} />); });
  return cb;
}

function key(k: string, mods: { metaKey?: boolean; shiftKey?: boolean } = {}, target: EventTarget = window) {
  const e = new KeyboardEvent('keydown', { key: k, metaKey: !!mods.metaKey, shiftKey: !!mods.shiftKey, bubbles: true, cancelable: true });
  act(() => { target.dispatchEvent(e); });
  return e;
}

describe('useMeasureKeys', () => {
  it('→ moves the selection one bar', () => {
    const cb = mount();
    key('ArrowRight');
    expect(cb.onSelection).toHaveBeenCalledWith({ anchor: 3, focus: 3 });
  });

  it('⇧→ extends the selection', () => {
    const cb = mount();
    key('ArrowRight', { shiftKey: true });
    expect(cb.onSelection).toHaveBeenCalledWith({ anchor: 2, focus: 3 });
  });

  it('⏎ opens the first selected bar', () => {
    const cb = mount();
    key('Enter');
    expect(cb.onOpen).toHaveBeenCalledWith(2);
  });

  it('⌘C, ⌘V and ⌘D copy, paste and duplicate; ⌘D keeps the browser away', () => {
    const cb = mount();
    key('c', { metaKey: true });
    key('v', { metaKey: true });
    const d = key('d', { metaKey: true });
    expect(cb.onCopy).toHaveBeenCalledTimes(1);
    expect(cb.onPaste).toHaveBeenCalledTimes(1);
    expect(cb.onDuplicate).toHaveBeenCalledTimes(1);
    expect(d.defaultPrevented).toBe(true);
  });

  it('⌫ deletes the selected bars', () => {
    const cb = mount();
    key('Backspace');
    expect(cb.onDelete).toHaveBeenCalledTimes(1);
  });

  it('Esc clears the selection', () => {
    const cb = mount();
    key('Escape');
    expect(cb.onSelection).toHaveBeenCalledWith(null);
  });

  it('never fires while typing in a field', () => {
    const cb = mount();
    const input = host.querySelector('input')!;
    input.focus();
    key('Backspace', {}, input);
    key('ArrowLeft', {}, input);
    expect(cb.onDelete).not.toHaveBeenCalled();
    expect(cb.onSelection).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const cb = mount({ enabled: false });
    for (const k of ['ArrowRight', 'Enter', 'Backspace', 'Escape']) key(k);
    key('c', { metaKey: true });
    key('d', { metaKey: true });
    for (const fn of Object.values(cb)) expect(fn).not.toHaveBeenCalled();
  });

  it('with nothing selected, only the arrows act (→ selects the first bar)', () => {
    const cb = mount({ selection: null });
    key('Backspace');
    key('Enter');
    key('c', { metaKey: true });
    expect(cb.onDelete).not.toHaveBeenCalled();
    expect(cb.onOpen).not.toHaveBeenCalled();
    expect(cb.onCopy).not.toHaveBeenCalled();
    key('ArrowRight');
    expect(cb.onSelection).toHaveBeenCalledWith({ anchor: 0, focus: 0 });
  });

  it('⏎ on a focused button presses the button instead of opening the bar', () => {
    const cb = mount();
    const button = document.createElement('button');
    host.appendChild(button);
    button.focus();
    const e = key('Enter', {}, button);
    expect(cb.onOpen).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('⌘C leaves a page text selection to the browser', () => {
    const cb = mount();
    const p = document.createElement('p');
    p.textContent = 'Some lesson text';
    host.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    try {
      const e = key('c', { metaKey: true });
      expect(cb.onCopy).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(false);
    } finally {
      window.getSelection()!.removeAllRanges();
    }
  });
  it('L loops the selected bars', () => {
    const cb = mount({ selection: { anchor: 1, focus: 3 } });
    const e = key('l');
    expect(cb.onLoop).toHaveBeenCalledWith(1, 3);
    expect(e.defaultPrevented).toBe(true);
  });

  it('L does nothing while typing, with no selection, or with ⌘', () => {
    const cb = mount();
    key('l', {}, host.querySelector('input')!);
    key('l', { metaKey: true });
    expect(cb.onLoop).not.toHaveBeenCalled();
    const none = mount({ selection: null });
    key('l');
    expect(none.onLoop).not.toHaveBeenCalled();
  });
});
