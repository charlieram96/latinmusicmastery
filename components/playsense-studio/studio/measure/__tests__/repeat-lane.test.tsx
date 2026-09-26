// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bandLabel, repeatBands, type RepeatBand } from '../repeat-lane';
import { RepeatPopover } from '../repeat-popover';

const band = (pass: number, w: number, count = 3, length = 2): RepeatBand =>
  ({ id: 'r', pass, count, length, firstIndex: 0, lastIndex: 1, left: 0, right: w });

describe('bandLabel', () => {
  it('pass 1 says how often and how long', () => {
    expect(bandLabel(band(0, 200))).toBe('Repeat ×3 · 2 bars');
    expect(bandLabel(band(0, 200, 2, 1))).toBe('Repeat ×2 · 1 bar');
    expect(bandLabel(band(0, 80))).toBe('×3');
    expect(bandLabel(band(0, 40))).toBe('');
  });
  it('later passes say which pass they are', () => {
    expect(bandLabel(band(1, 120))).toBe('pass 2 of 3');
    expect(bandLabel(band(2, 60))).toBe('3/3');
    expect(bandLabel(band(1, 30))).toBe('');
  });
});

describe('repeatBands', () => {
  it('makes one band per pass', () => {
    const rp = (pass: number, offset: number) => ({ id: 'r', pass, count: 2, offset, length: 2 });
    const items = [0, 1, 2, 3, 4].map((i) => ({
      measureIndex: i, measureNumber: i + 1, startVideoTimeSeconds: i, endVideoTimeSeconds: i + 1,
      repeatPass: i < 4 ? rp(Math.floor(i / 2), i % 2) : undefined,
    })) as unknown as Parameters<typeof repeatBands>[0];
    const bands = repeatBands(items, (t) => t * 100);
    expect(bands.map((b) => [b.pass, b.firstIndex, b.lastIndex, b.left, b.right])).toEqual([[0, 0, 1, 0, 200], [1, 2, 3, 200, 400]]);
  });
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
const noProblem = () => null;
const anchor = { left: 10, top: 20 };

describe('RepeatPopover', () => {
  it('offers counts to a fresh range and picks one', () => {
    const onPick = vi.fn();
    act(() => {
      root.render(
        <RepeatPopover
          anchor={anchor} range={[1, 2]} group={null} problemFor={noProblem}
          onPick={onPick} onRemove={noop} onSelectPassOne={noop} onClose={noop}
        />,
      );
    });
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Play m.2–3 more than once');
    const buttons = Array.from(host.querySelectorAll('.st-mpop-chip')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent)).toEqual(['×2', '×3', '×4', '×6', '×8']);
    act(() => {
      buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledWith(4);
  });

  it('shows the group state, marks the active count and offers remove/select-pass-one', () => {
    act(() => {
      root.render(
        <RepeatPopover
          anchor={anchor} range={[1, 2]} group={{ id: 'r', count: 3 }} problemFor={noProblem}
          onPick={noop} onRemove={noop} onSelectPassOne={noop} onClose={noop}
        />,
      );
    });
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('m.2–3 play ×3');
    const three = Array.from(host.querySelectorAll('.st-mpop-chip')).find((b) => b.textContent === '×3') as HTMLButtonElement;
    expect(three.getAttribute('aria-pressed')).toBe('true');
    const items = Array.from(host.querySelectorAll('.st-mpop-item')).map((b) => b.textContent);
    expect(items).toContain('✕ Remove repeat');
    expect(items).toContain('Select pass 1');
  });
});
