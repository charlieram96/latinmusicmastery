// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Music, Activity } from 'lucide-react';
import { HoverRail, RAIL_CLOSE_DELAY_MS } from '../hover-rail';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <HoverRail
        sections={[
          { id: 'score', label: 'Score', icon: Music, content: <input aria-label="Title" /> },
          { id: 'sync', label: 'Sync status', icon: Activity, badge: 'warn', content: <p>ok</p> },
        ]}
      />
    );
  });
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });

const rail = () => host.querySelector('.st-hrail') as HTMLElement;
const enter = () => act(() => { rail().dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })); });
const leave = () => act(() => { rail().dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })); });

describe('HoverRail', () => {
  it('opens as soon as the pointer enters', () => {
    enter();
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('closes only after the close delay', () => {
    enter(); leave();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS - 10); });
    expect(rail().classList.contains('is-open')).toBe(true);
    act(() => { vi.advanceTimersByTime(20); });
    expect(rail().classList.contains('is-open')).toBe(false);
  });
  it('re-entering cancels a pending close', () => {
    enter(); leave(); enter();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS + 50); });
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('stays open while a field inside it has focus', () => {
    enter();
    const input = host.querySelector('input') as HTMLInputElement;
    act(() => { input.focus(); });
    leave();
    act(() => { vi.advanceTimersByTime(RAIL_CLOSE_DELAY_MS + 50); });
    expect(rail().classList.contains('is-open')).toBe(true);
  });
  it('an icon click opens the rail and scrolls to its section', () => {
    const btn = host.querySelector('button[aria-label="Sync status"]') as HTMLButtonElement;
    act(() => { btn.click(); });
    expect(rail().classList.contains('is-open')).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
  it('shows the badge dot and keeps collapsed bodies mounted', () => {
    expect(host.querySelector('.st-hrail-dot.is-warn')).not.toBeNull();
    expect(host.querySelector('#st-rail-score input')).not.toBeNull();
  });
});
