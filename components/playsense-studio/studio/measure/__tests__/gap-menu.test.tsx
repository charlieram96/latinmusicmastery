// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GapMenu } from '../gap-menu';

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

const noProblems = { empty: null, copy: null, paste: null };

function render(props: Partial<React.ComponentProps<typeof GapMenu>> = {}) {
  const cb = { onEmpty: vi.fn(), onCopyLeft: vi.fn(), onPaste: vi.fn(), onClose: vi.fn() };
  act(() => {
    root.render(
      <GapMenu
        anchor={{ left: 0, top: 0 }}
        gap={2}
        measureCount={4}
        clipCount={3}
        problems={noProblems}
        {...cb}
        {...props}
      />,
    );
  });
  return cb;
}

const buttons = () => Array.from(host.querySelectorAll('button'));
const byLabel = (label: string) => buttons().find((b) => b.textContent?.trim() === label);

describe('GapMenu', () => {
  it('titles the gap "Add between m.2 and m.3", lists the three items and shows the hint', () => {
    render();
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Add between m.2 and m.3');
    expect(byLabel('Empty measure')).toBeTruthy();
    expect(byLabel('Copy of m.2')).toBeTruthy();
    expect(byLabel('Paste 3 copied bars')).toBeTruthy();
    expect(host.querySelector('.st-mpop-hint')?.textContent).toBe(
      'New bars take the length of the bar to their left. Later bars move to make room.',
    );
  });

  it('calls onEmpty when Empty measure is clicked, and closes the menu', () => {
    const cb = render();
    act(() => { byLabel('Empty measure')!.click(); });
    expect(cb.onEmpty).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onCopyLeft when Copy of m.2 is clicked', () => {
    const cb = render();
    act(() => { byLabel('Copy of m.2')!.click(); });
    expect(cb.onCopyLeft).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onPaste when Paste 3 copied bars is clicked', () => {
    const cb = render();
    act(() => { byLabel('Paste 3 copied bars')!.click(); });
    expect(cb.onPaste).toHaveBeenCalledTimes(1);
    expect(cb.onClose).toHaveBeenCalledTimes(1);
  });

  it('titles the end gap "Add at the end"', () => {
    render({ gap: 4, measureCount: 4 });
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Add at the end');
  });

  it('hides "Copy of…" at gap 0, since there is no bar to its left', () => {
    render({ gap: 0 });
    expect(buttons().some((b) => b.textContent?.trim().startsWith('Copy of'))).toBe(false);
  });

  it('hides Paste when nothing is on the clipboard', () => {
    render({ clipCount: null });
    expect(buttons().some((b) => b.textContent?.trim().startsWith('Paste'))).toBe(false);
  });

  it('shows "Paste 1 copied bar" (singular) for a one-bar clipboard', () => {
    render({ clipCount: 1 });
    expect(byLabel('Paste 1 copied bar')).toBeTruthy();
  });

  it('disables an item whose problem is set and shows the problem text as its title', () => {
    render({ problems: { empty: null, copy: 'Unlink this repeat before inserting inside it.', paste: null } });
    const btn = byLabel('Copy of m.2')!;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe('Unlink this repeat before inserting inside it.');
  });

  it('enables an item and uses the label as its title when there is no problem', () => {
    render();
    const btn = byLabel('Empty measure')!;
    expect(btn.disabled).toBe(false);
    expect(btn.title).toBe('Empty measure');
  });
});
