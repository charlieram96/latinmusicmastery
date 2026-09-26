// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
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

  // Fix round 1: SyncPanel's real "Add score" item is a React SIBLING of
  // <ScoreMenu> that createPortal()s its trigger into a span this component
  // renders as one of `children` (see score-section-editor.tsx). This
  // reproduces that shape directly, rather than a real child button, so the
  // click the menu must close on isn't a React descendant of <ScoreMenu>.
  it('closes when an item portalled in from a sibling React tree (not a descendant of ScoreMenu) is clicked', () => {
    function SiblingPortalledItem({ target }: { target: HTMLElement | null }) {
      if (!target) return null;
      return createPortal(<button className="st-mpop-item">Add measures from a file</button>, target);
    }
    function Host() {
      const [target, setTarget] = useState<HTMLElement | null>(null);
      return (
        <>
          <SiblingPortalledItem target={target} />
          <ScoreMenu>
            <span ref={setTarget} className="contents" />
          </ScoreMenu>
        </>
      );
    }
    act(() => root.render(<Host />));
    const chip = host.querySelector('[aria-label="Score"]') as HTMLButtonElement;
    const panel = host.querySelector('[role="menu"]') as HTMLElement;
    act(() => chip.click());
    expect(panel.hidden).toBe(false);
    const portalled = panel.querySelector('button') as HTMLButtonElement;
    expect(portalled.textContent).toBe('Add measures from a file');
    act(() => portalled.click());
    expect(panel.hidden).toBe(true);
  });
});
