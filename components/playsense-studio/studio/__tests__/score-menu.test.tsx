// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScoreMenu } from '../score-menu';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('ScoreMenu', () => {
  it('is one Score chip whose items stay mounted while hidden', () => {
    act(() => root.render(<ScoreMenu><button className="st-mpop-item">Export…</button></ScoreMenu>));
    const chip = host.querySelector('[aria-label="Score"]') as HTMLButtonElement;
    const panel = host.querySelector('[role="menu"]') as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(panel.textContent).toContain('Export…'); // mounted while hidden
    act(() => chip.click());
    expect(panel.hidden).toBe(false);
    act(() => (panel.querySelector('button') as HTMLButtonElement).click());
    expect(panel.hidden).toBe(true); // choosing an item closes the menu
  });
});
