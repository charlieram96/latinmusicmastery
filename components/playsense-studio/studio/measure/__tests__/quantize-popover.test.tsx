// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuantizePopover } from '../quantize-popover';

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

function render(props: Partial<React.ComponentProps<typeof QuantizePopover>> = {}) {
  const plan = props.plan ?? vi.fn((strength: number) => ({ moved: strength >= 50 ? 3 : 0, largestMs: 42 }));
  const cb = { onApply: vi.fn(), onReset: vi.fn(), onClose: vi.fn() };
  act(() => {
    root.render(
      <QuantizePopover anchor={{ left: 0, top: 0 }} plan={plan} {...cb} {...props} />,
    );
  });
  return { plan, ...cb };
}

const buttons = () => Array.from(host.querySelectorAll('button'));
const byLabel = (label: string) => buttons().find((b) => b.textContent?.trim() === label)!;
const slider = () => host.querySelector('input[type="range"]') as HTMLInputElement;

// Bypasses React's own instrumented `value` setter, same trick as
// bar-popover.test.tsx / more-popover.test.tsx.
const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function drag(input: HTMLInputElement, value: number) {
  act(() => {
    nativeValueSetter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('QuantizePopover', () => {
  it('titles the popover "Quantize to the score"', () => {
    render();
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Quantize to the score');
  });

  it('defaults the Strength slider to 70', () => {
    render();
    expect(slider().getAttribute('aria-label')).toBe('Strength');
    expect(slider().value).toBe('70');
  });

  it('previews from plan(strength) at the default strength', () => {
    const plan = vi.fn(() => ({ moved: 3, largestMs: 42 }));
    render({ plan });
    expect(plan).toHaveBeenCalledWith(70);
    expect(host.textContent).toContain('3 notes will move, largest 42 ms');
  });

  it('updates the preview as the slider moves', () => {
    render({ plan: (s) => ({ moved: s >= 90 ? 3 : 0, largestMs: 42 }) }); // 0 at the default 70
    expect(host.textContent).toContain('No notes to move');
    drag(slider(), 95);
    expect(host.textContent).toContain('3 notes will move, largest 42 ms');
  });

  it('shows "No notes to move" when nothing would move', () => {
    render({ plan: () => ({ moved: 0, largestMs: 0 }) });
    expect(host.textContent).toContain('No notes to move');
  });

  it('Apply calls onApply(strength)', () => {
    const cb = render();
    drag(slider(), 55);
    act(() => { byLabel('Apply').click(); });
    expect(cb.onApply).toHaveBeenCalledWith(55);
  });

  it('Reset flex calls onReset', () => {
    const cb = render();
    act(() => { byLabel('Reset flex').click(); });
    expect(cb.onReset).toHaveBeenCalledTimes(1);
  });
});
