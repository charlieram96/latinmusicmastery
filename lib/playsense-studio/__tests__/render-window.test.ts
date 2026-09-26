import { describe, expect, it } from 'vitest';
import { renderWindow } from '../render-window';

describe('renderWindow', () => {
  it('covers a viewport either side', () => {
    expect(renderWindow(1000, 500, null)).toEqual({ start: 500, end: 2000 });
  });
  it('keeps the window while the view stays well inside it', () => {
    const w = renderWindow(1000, 500, null);
    expect(renderWindow(1100, 500, w)).toBe(w);
    expect(renderWindow(900, 500, w)).toBe(w);
  });
  it('moves once the view nears an edge or the width changes', () => {
    const w = renderWindow(1000, 500, null);
    expect(renderWindow(1400, 500, w)).toEqual({ start: 900, end: 2400 });
    expect(renderWindow(1000, 600, w)).toEqual({ start: 400, end: 2200 });
  });
  it('keeps the window at fractional scroll positions (float drift in its width)', () => {
    // (s + 2w) − (s − w) is not exactly 3w for every fractional s.
    for (let s = 0.1; s < 5000; s += 37.77) {
      const w = renderWindow(s, 1234, null);
      expect(renderWindow(s, 1234, w)).toBe(w);
    }
  });
});
