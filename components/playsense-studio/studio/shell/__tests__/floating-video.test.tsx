// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingVideo, clampPip, PIP_WIDTH } from '../floating-video';

describe('clampPip', () => {
  const box = { width: 1000, height: 600 };
  it('keeps the top at least 8 px from the top edge', () => {
    expect(clampPip({ right: 26, top: -40, minimized: false }, box).top).toBe(8);
  });
  it('keeps the whole video inside the box', () => {
    const p = clampPip({ right: -50, top: 900, minimized: false }, box);
    expect(p.right).toBe(8);
    expect(p.top).toBe(600 - 170);
    expect(clampPip({ right: 5000, top: 20, minimized: false }, box).right).toBe(1000 - PIP_WIDTH - 8);
  });
  it('a pill can sit lower than the full video', () => {
    expect(clampPip({ right: 26, top: 900, minimized: true }, box).top).toBe(600 - 60);
  });
});

describe('FloatingVideo', () => {
  let host: HTMLDivElement; let root: Root;
  let roCallback: (() => void) | null;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // This jsdom environment has no working global `localStorage` (Node's own
    // experimental implementation shadows jsdom's and throws without
    // --localstorage-file) — stub it the same way the rest of the codebase does.
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    });
    // jsdom has no ResizeObserver — stub one that just captures its callback,
    // so a test can trigger a "resize" by hand.
    roCallback = null;
    class FakeResizeObserver {
      constructor(cb: () => void) { roCallback = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 600 });
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<FloatingVideo label="Reference" onBodyEl={() => {}} />); });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); });
  const pip = () => host.querySelector('.st-pip') as HTMLElement;
  const ptr = (el: Element, type: string, x: number, y: number) => {
    const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: 1 });
    act(() => { el.dispatchEvent(e); });
  };

  it('starts bottom-right', () => {
    expect(pip().style.right).toBe('26px');
    expect(pip().style.top).toBe(`${600 - 170}px`);
  });
  it('drags by its bar', () => {
    const bar = host.querySelector('.st-pip-bar') as HTMLElement;
    ptr(bar, 'pointerdown', 500, 450);
    ptr(bar, 'pointermove', 460, 400);
    ptr(bar, 'pointerup', 460, 400);
    expect(pip().style.right).toBe('66px');
    expect(pip().style.top).toBe(`${600 - 170 - 50}px`);
  });
  it('resizes with the corner handle and remembers its width without unmounting the video', () => {
    const body=host.querySelector('.st-pip-body');
    const handle=host.querySelector('[aria-label="Resize video"]')!;
    ptr(handle,'pointerdown',400,400);ptr(handle,'pointermove',480,420);ptr(handle,'pointerup',480,420);
    expect(pip().style.width).toBe('316px');
    expect(JSON.parse(localStorage.getItem('playsense-studio:pip')!).width).toBe(316);
    expect(host.querySelector('.st-pip-body')).toBe(body);
  });
  it('shrinks to a pill and keeps the video mounted', () => {
    act(() => { (host.querySelector('button[title="Shrink to a pill"]') as HTMLButtonElement).click(); });
    expect(pip().classList.contains('is-min')).toBe(true);
    expect(host.querySelector('.st-pip-body')).not.toBeNull();
  });
  it('re-clamps into view when the stage shrinks', () => {
    expect(pip().style.right).toBe('26px');
    expect(pip().style.top).toBe(`${600 - 170}px`);
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 50 });
    act(() => { roCallback?.(); });
    expect(pip().style.right).toBe('8px');
    expect(pip().style.top).toBe('8px');
  });
});
