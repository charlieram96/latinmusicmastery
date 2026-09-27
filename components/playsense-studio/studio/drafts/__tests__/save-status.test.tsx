// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStatus } from '../save-status';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const pip = () => host.querySelector('.st-status-pip') as HTMLElement;
const status = () => host.querySelector('[role="status"]') as HTMLElement;

describe('SaveStatus', () => {
  it('shows "Saved" with a quiet, glow-free ok pip when idle', () => {
    act(() => root.render(<SaveStatus saveState="idle" pending={false} flush={vi.fn()} />));
    expect(status().textContent).toContain('Saved');
    expect(pip().className).toBe('st-status-pip');
    expect(pip().style.boxShadow).toBe('none');
    expect(pip().style.width).toBe('6px');
    expect(pip().style.height).toBe('6px');
  });

  it('shows "Saving…" with a warn pip while pending', () => {
    act(() => root.render(<SaveStatus saveState="idle" pending flush={vi.fn()} />));
    expect(status().textContent).toContain('Saving…');
    expect(pip().className).toBe('st-status-pip warn');
  });

  it('shows "Saving…" with a warn pip while the save is in flight', () => {
    act(() => root.render(<SaveStatus saveState="saving" pending={false} flush={vi.fn()} />));
    expect(status().textContent).toContain('Saving…');
    expect(pip().className).toBe('st-status-pip warn');
  });

  it('shows "Save failed · Retry" with a bad pip, and Retry calls flush', () => {
    const flush = vi.fn();
    act(() => root.render(<SaveStatus saveState="error" pending={false} flush={flush} />));
    expect(status().textContent).toContain('Save failed');
    expect(pip().className).toBe('st-status-pip bad');
    const retry = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Retry')!;
    act(() => retry.click());
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('treats "saved" the same as idle: "Saved" with an ok pip', () => {
    act(() => root.render(<SaveStatus saveState="saved" pending={false} flush={vi.fn()} />));
    expect(status().textContent).toContain('Saved');
    expect(pip().className).toBe('st-status-pip');
  });
});
