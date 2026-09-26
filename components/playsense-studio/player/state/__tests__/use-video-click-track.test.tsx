// @vitest-environment jsdom
//
// The click grid is keyed by EVERY entry (to the millisecond), not just its
// length and ends: a flex edit moves interior beats only, and the admin click
// must reschedule when it does.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setGrid = vi.fn();
vi.mock('@/lib/playsense-studio/click-track', () => ({
  ClickTrack: class {
    setGrid = setGrid;
    setVolume() {}
    setOffsetSeconds() {}
    teardown() {}
    close() {}
  },
}));

import { clickGridKey, useVideoClickTrack } from '../use-video-click-track';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe('clickGridKey', () => {
  it('changes when an interior beat moves, even with the same length and ends', () => {
    expect(clickGridKey([1, 2, 3, 4])).not.toBe(clickGridKey([1, 2.1, 3, 4]));
    expect(clickGridKey([1, 2, 3, 4])).not.toBe(clickGridKey([1, 2, 3.002, 4]));
  });

  it('is stable for the same values and ignores sub-millisecond noise', () => {
    expect(clickGridKey([1, 2, 3])).toBe(clickGridKey([1, 2, 3]));
    expect(clickGridKey([1, 2.0000001, 3])).toBe(clickGridKey([1, 2, 3]));
    expect(clickGridKey([])).toBe(clickGridKey([]));
    expect(clickGridKey([])).not.toBe(clickGridKey([0]));
  });
});

function Harness({ grid }: { grid: number[] }) {
  useVideoClickTrack({ videoRef: { current: null }, grid, enabled: false });
  return null;
}

describe('useVideoClickTrack grid', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    setGrid.mockClear();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('reschedules when only an interior beat moves, and not for an equal grid', () => {
    act(() => root.render(<Harness grid={[1, 2, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness grid={[1, 2, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness grid={[1, 2.25, 3, 4]} />));
    expect(setGrid).toHaveBeenCalledTimes(2);
    expect(setGrid).toHaveBeenLastCalledWith([1, 2.25, 3, 4]);
  });
});
