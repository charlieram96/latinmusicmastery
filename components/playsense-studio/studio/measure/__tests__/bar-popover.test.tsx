// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarPopover } from '../bar-popover';

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

const baseCurrent = {
  timeSignature: [4, 4] as [number, number],
  keyFifths: 0,
  clef: 'treble' as const,
  tempo: 120,
  repeatStart: false,
  repeatEnd: false,
  double: false,
  final: false,
  volta: null,
};

function render(props: Partial<React.ComponentProps<typeof BarPopover>> = {}) {
  const cb = { onPatch: vi.fn(), onFinal: vi.fn(), onClose: vi.fn() };
  act(() => {
    root.render(
      <BarPopover
        anchor={{ left: 0, top: 0 }}
        measureIndex={2}
        measureNumber={3}
        percussion={false}
        current={baseCurrent}
        {...cb}
        {...props}
      />,
    );
  });
  return cb;
}

const buttons = () => Array.from(host.querySelectorAll('button'));
const byLabel = (label: string) => buttons().find((b) => b.textContent?.trim() === label);

// Bypasses React's own instrumented `value` setter (installed on the node to
// track "real" changes), so the following 'input' event isn't a no-op — same
// trick as score-meta-editor.test.tsx.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function type(input: HTMLInputElement, value: string) {
  act(() => {
    nativeValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('BarPopover', () => {
  it('titles the popover "Bar m.3"', () => {
    render();
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Bar m.3');
  });

  it('clicking 6/8 calls onPatch({ timeSignature: [6, 8] })', () => {
    const cb = render();
    act(() => { byLabel('6/8')!.click(); });
    expect(cb.onPatch).toHaveBeenCalledWith({ timeSignature: [6, 8] });
  });

  it('marks the chip matching the current time signature as pressed', () => {
    render({ current: { ...baseCurrent, timeSignature: [3, 4] } });
    expect(byLabel('3/4')!.getAttribute('aria-pressed')).toBe('true');
    expect(byLabel('4/4')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('hides the key and clef selects for a percussion track', () => {
    render({ percussion: true });
    expect(host.querySelector('[aria-label="Key"]')).toBeNull();
    expect(host.querySelector('[aria-label="Clef"]')).toBeNull();
  });

  it('shows the key and clef selects for a pitched track', () => {
    render();
    expect(host.querySelector('[aria-label="Key"]')).toBeTruthy();
    expect(host.querySelector('[aria-label="Clef"]')).toBeTruthy();
  });

  it('re-syncs the tempo field when current.tempo changes while open, and submits the new value', () => {
    render();
    const input = () => host.querySelector('[aria-label="Tempo"]') as HTMLInputElement;
    expect(input().value).toBe('120');
    const cb2 = render({ current: { ...baseCurrent, tempo: 140 } });
    expect(input().value).toBe('140');
    act(() => { byLabel('Set ♩ =')!.click(); });
    expect(cb2.onPatch).toHaveBeenCalledWith({ tempo: 140 });
  });

  it('submitting tempo 132 calls onPatch({ tempo: 132 })', () => {
    const cb = render();
    const input = host.querySelector('[aria-label="Tempo"]') as HTMLInputElement;
    type(input, '132');
    act(() => { byLabel('Set ♩ =')!.click(); });
    expect(cb.onPatch).toHaveBeenCalledWith({ tempo: 132 });
  });

  it('ignores a tempo submitted outside 30–300', () => {
    const cb = render();
    const input = host.querySelector('[aria-label="Tempo"]') as HTMLInputElement;
    type(input, '301');
    act(() => { byLabel('Set ♩ =')!.click(); });
    expect(cb.onPatch).not.toHaveBeenCalled();
  });

  it('the 1st ending toggle calls onPatch({ volta: "1." })', () => {
    const cb = render();
    act(() => { byLabel('1st ending')!.click(); });
    expect(cb.onPatch).toHaveBeenCalledWith({ volta: '1.' });
  });

  it('the 1st ending toggle calls onPatch({ volta: null }) when it is already on', () => {
    const cb = render({ current: { ...baseCurrent, volta: '1.' } });
    act(() => { byLabel('1st ending')!.click(); });
    expect(cb.onPatch).toHaveBeenCalledWith({ volta: null });
  });

  it('Final barline calls onFinal(true)', () => {
    const cb = render();
    act(() => { byLabel('Final barline')!.click(); });
    expect(cb.onFinal).toHaveBeenCalledWith(true);
  });

  it('Final barline calls onFinal(false) when already final', () => {
    const cb = render({ current: { ...baseCurrent, final: true } });
    act(() => { byLabel('Final barline')!.click(); });
    expect(cb.onFinal).toHaveBeenCalledWith(false);
  });
});
