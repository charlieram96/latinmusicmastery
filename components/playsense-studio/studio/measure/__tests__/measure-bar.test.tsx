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
    onPaste: vi.fn(), onBar: vi.fn(), onClear: vi.fn(), onDelete: vi.fn(),
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
    expect(info).toContain('≈96.4 BPM');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Edit', 'Loop', 'Repeat', 'Duplicate', 'Copy', 'Paste', 'Bar properties', 'Clear', 'Delete',
    ]);
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

  it('opens the menus just under the bar', () => {
    const cb = render();
    act(() => { byName('Repeat').click(); });
    expect(cb.onRepeat).toHaveBeenCalledWith({ left: 300, top: 160 });
    act(() => { byName('Bar properties').click(); });
    expect(cb.onBar).toHaveBeenCalledWith({ left: 300, top: 160 });
    act(() => { byName('Duplicate').click(); });
    expect(cb.onDup).toHaveBeenCalledTimes(1);
  });
});
