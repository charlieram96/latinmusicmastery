// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeasureBar } from '../measure-bar';

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

const noProblems = { dup: null, paste: null, clear: null, del: null };

function render(props: Partial<React.ComponentProps<typeof MeasureBar>> = {}) {
  const cb = {
    onEdit: vi.fn(), onLoop: vi.fn(), onRepeat: vi.fn(), onDup: vi.fn(), onCopy: vi.fn(),
    onPaste: vi.fn(), onBar: vi.fn(), onClear: vi.fn(), onDelete: vi.fn(), onQuantize: vi.fn(),
  };
  act(() => {
    root.render(
      <MeasureBar left={300} top={120} label="m.2–3" startSeconds={12.34} bpm={96.4} looping={false} canLoop
        problems={noProblems} {...cb} {...props} />,
    );
  });
  return cb;
}

const buttons = () => Array.from(host.querySelectorAll('button'));
const byName = (name: string) => buttons().find((b) => b.getAttribute('aria-label') === name)!;

describe('MeasureBar', () => {
  it('shows the bars, their start and tempo, then the actions in order', () => {
    render();
    const bar = host.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute('aria-label')).toBe('Selected bars');
    const info = bar.querySelector('.st-fbar-info')!.textContent!;
    expect(info).toContain('m.2–3');
    expect(info).toContain('0:12.3');
    expect(info).toContain('≈96.4');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Edit', 'Loop', 'Quantize', 'Repeat', 'Duplicate', 'Copy', 'Paste', 'Bar properties', 'Clear', 'Delete',
    ]);
  });

  it('labels Edit, Loop and Repeat with text, and shows ×n inside a repeat', () => {
    render({ repeatCount: 2 });
    const text = host.querySelector('[role="toolbar"]')!.textContent!;
    expect(text).toContain('Edit');
    expect(text).toContain('Loop');
    expect(text).toContain('×2');
    expect(text).not.toContain('BPM');
  });

  it('shows plain "Repeat" when the bars are not in a repeat', () => {
    render({ repeatCount: null });
    expect(byName('Repeat').textContent).toContain('Repeat');
    expect(byName('Repeat').textContent).not.toContain('×');
  });

  it('leaves the tempo out when there is none', () => {
    render({ bpm: null });
    expect(host.textContent).not.toContain('BPM');
  });

  it('disables an action with a problem and explains why', () => {
    const cb = render({ problems: { ...noProblems, del: 'Keep at least one measure in the score.' } });
    const del = byName('Delete');
    expect(del.disabled).toBe(true);
    expect(del.title).toBe('Keep at least one measure in the score.');
    act(() => { del.click(); });
    expect(cb.onDelete).not.toHaveBeenCalled();
  });

  it('marks Loop pressed while looping, and disables it without a video', () => {
    render({ looping: true });
    expect(byName('Loop').getAttribute('aria-pressed')).toBe('true');
    render({ canLoop: false });
    expect(byName('Loop').disabled).toBe(true);
    expect(byName('Loop').title).toBe('Play the video to loop');
  });

  it('shows the flag as a pip, with the reason in its title and an accessible label', () => {
    render({ flag: 'no hit near its first note' });
    const info = host.querySelector('.st-fbar-info')!;
    // The reason lives in the title (and the a11y label), not as visible text next to the dot.
    const pip = info.querySelector('.st-status-pip')!;
    expect(pip).not.toBeNull();
    expect(pip.getAttribute('title')).toBe('no hit near its first note');
    expect(pip.getAttribute('role')).toBe('img');
    expect(pip.getAttribute('aria-label')).toBe('Timing: no hit near its first note');
    expect(info.textContent).not.toContain('no hit near its first note');
  });

  it('leaves the flag out when there is none', () => {
    render({ flag: null });
    expect(host.querySelector('.st-fbar-info .st-status-pip')).toBeNull();
  });

  it('shows the flexed info in the bar info', () => {
    render({ flexInfo: 'flexed ±35 ms' });
    const info = host.querySelector('.st-fbar-info')!;
    expect(info.textContent).toContain('flexed ±35 ms');
    const flexEl = info.querySelector('.st-fbar-flex')!;
    expect(flexEl).not.toBeNull();
    expect(flexEl.textContent).toBe('flexed ±35 ms');
  });

  it('leaves the flexed info out when there is none', () => {
    render({ flexInfo: null });
    expect(host.querySelector('.st-fbar-flex')).toBeNull();
  });

  it('opens the menus just under the bar', () => {
    const cb = render();
    act(() => { byName('Repeat').click(); });
    expect(cb.onRepeat).toHaveBeenCalledWith({ left: 300, top: 160 });
    act(() => { byName('Bar properties').click(); });
    expect(cb.onBar).toHaveBeenCalledWith({ left: 300, top: 160 });
    act(() => { byName('Quantize').click(); });
    expect(cb.onQuantize).toHaveBeenCalledWith({ left: 300, top: 160 });
    act(() => { byName('Duplicate').click(); });
    expect(cb.onDup).toHaveBeenCalledTimes(1);
  });

  describe('Quantize (Task 7)', () => {
    it('hides the button when there is no onQuantize', () => {
      render({ onQuantize: undefined });
      expect(buttons().find((b) => b.getAttribute('aria-label') === 'Quantize')).toBeUndefined();
    });

    it('disables the button with a quantizeProblem and explains why', () => {
      const cb = render({ quantizeProblem: 'Needs the audio analysed first' });
      const q = byName('Quantize');
      expect(q.disabled).toBe(true);
      expect(q.title).toBe('Needs the audio analysed first');
      act(() => { q.click(); });
      expect(cb.onQuantize).not.toHaveBeenCalled();
    });
  });
});
