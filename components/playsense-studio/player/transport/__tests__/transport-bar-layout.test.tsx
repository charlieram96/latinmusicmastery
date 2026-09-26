// @vitest-environment jsdom
// components/playsense-studio/player/transport/__tests__/transport-bar-layout.test.tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TransportBar } from '../transport-bar';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const base = {
  currentSeconds: 5, durationSeconds: 100, isPlaying: false, playbackRate: 1,
  onToggle() {}, onRestart() {}, onSeek() {}, onRateChange() {},
  loopA: null, loopB: null, loopEnabled: false, onToggleLoop() {}, onClearLoop() {},
  bpm: 96, beatsPerMeasure: 4,
};

describe('TransportBar layout', () => {
  it('keeps the two-row student layout by default', () => {
    act(() => root.render(<TransportBar {...base} />));
    const play = host.querySelector('[aria-label="Play"]')!;
    expect(host.querySelector('.st-transport-row')).toBeNull();
    // the scrubber is a sibling row above the controls, not inside them
    expect(play.parentElement!.querySelector('[class*="touch-none"]')).toBeNull();
  });

  it('puts the scrubber and the extras in one row with layout="row"', () => {
    act(() => root.render(<TransportBar {...base} layout="row" extra={<span data-testid="hear">Hear</span>} />));
    const row = host.querySelector('.st-transport-row')!;
    expect(row.contains(host.querySelector('[aria-label="Play"]'))).toBe(true);
    expect(row.querySelector('[class*="touch-none"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="hear"]')).not.toBeNull();
  });
});
