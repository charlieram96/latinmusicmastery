// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StageSplitter, clampWaveHeight, WAVE_DEFAULT, WAVE_MAX, WAVE_MIN } from '../stage-splitter';

describe('clampWaveHeight', () => {
  it('clamps to 110–360', () => {
    expect(clampWaveHeight(20)).toBe(WAVE_MIN);
    expect(clampWaveHeight(999)).toBe(WAVE_MAX);
    expect(clampWaveHeight(200)).toBe(200);
  });
});

describe('StageSplitter', () => {
  let host: HTMLDivElement; let root: Root; const onChange = vi.fn();
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    onChange.mockReset();
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    act(() => { root.render(<StageSplitter height={180} onChange={onChange} />); });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const ptr = (type: string, y: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    act(() => { host.querySelector('.st-splitter')!.dispatchEvent(e); });
  };
  it('drags the waveform taller, clamped', () => {
    ptr('pointerdown', 300); ptr('pointermove', 340);
    expect(onChange).toHaveBeenLastCalledWith(220);
    ptr('pointermove', 900);
    expect(onChange).toHaveBeenLastCalledWith(WAVE_MAX);
    ptr('pointerup', 900);
  });
  it('double-click resets', () => {
    act(() => { host.querySelector('.st-splitter')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(onChange).toHaveBeenLastCalledWith(WAVE_DEFAULT);
  });
  it('stops dragging on pointercancel', () => {
    ptr('pointerdown', 300);
    ptr('pointercancel', 300);
    onChange.mockReset();
    ptr('pointermove', 340);
    expect(onChange).not.toHaveBeenCalled();
  });
});
