import { describe, expect, it } from 'vitest';
import {
  beatGridFromAnchor,
  firstIndexAtOrAfter,
  mergeBeatGrids,
} from '@/lib/playsense-studio/beat-grid';

const near = (a: number[], b: number[]) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
};

describe('beatGridFromAnchor', () => {
  it('emits beats through the anchor across the window', () => {
    // 120bpm -> 0.5s per beat.
    near(beatGridFromAnchor(10, 120, 10, 12), [10, 10.5, 11, 11.5, 12]);
  });

  it('includes a beat that lands exactly on `from` rather than skipping it', () => {
    // The off-by-one that would put every click a beat late.
    expect(beatGridFromAnchor(10, 120, 10, 10.4)[0]).toBeCloseTo(10, 9);
  });

  it('includes a beat that lands exactly on `to`', () => {
    const grid = beatGridFromAnchor(10, 120, 10, 11);
    expect(grid[grid.length - 1]).toBeCloseTo(11, 9);
  });

  it('extends backward when the anchor is after the window', () => {
    // Anchor at 30 still defines the grid at 10 - back-extrapolation.
    near(beatGridFromAnchor(30, 120, 10, 11), [10, 10.5, 11]);
  });

  it('extends forward when the anchor is before the window', () => {
    near(beatGridFromAnchor(0, 120, 10, 11), [10, 10.5, 11]);
  });

  it('handles an anchor that is not on a whole second', () => {
    near(beatGridFromAnchor(10.25, 120, 10, 11), [10.25, 10.75]);
  });

  it('handles a negative anchor without the JS modulo sign trap', () => {
    // (-0.3) % 0.6 === -0.3 in JS, which would land a beat off.
    near(beatGridFromAnchor(-0.3, 100, 0, 2), [0.3, 0.9, 1.5]);
  });

  it('returns an empty grid for an unusable tempo instead of throwing', () => {
    for (const bpm of [0, -120, NaN, Infinity]) {
      expect(beatGridFromAnchor(10, bpm, 10, 12)).toEqual([]);
    }
  });

  it('returns an empty grid for an unusable window instead of throwing', () => {
    expect(beatGridFromAnchor(NaN, 120, 10, 12)).toEqual([]);
    expect(beatGridFromAnchor(10, 120, 12, 10)).toEqual([]);
  });

  it('can return nothing when the window falls between two beats', () => {
    expect(beatGridFromAnchor(10, 120, 10.1, 10.4)).toEqual([]);
  });

  it('is strictly increasing', () => {
    const grid = beatGridFromAnchor(3.7, 97.3, 0, 60);
    expect(grid.length).toBeGreaterThan(90);
    for (let i = 1; i < grid.length; i++) expect(grid[i]).toBeGreaterThan(grid[i - 1]);
  });

  it('derives each beat from the anchor, so late beats do not accumulate error', () => {
    const bpm = 127.5;
    const grid = beatGridFromAnchor(0, bpm, 0, 1000);
    expect(grid[1000]).toBeCloseTo(1000 * (60 / bpm), 9);
  });
});

describe('mergeBeatGrids', () => {
  it('sorts and concatenates', () => {
    near(mergeBeatGrids([[3, 4], [1, 2]]), [1, 2, 3, 4]);
  });

  it('collapses the duplicate beat where two sections abut', () => {
    // Section A ends on the same instant section B begins.
    near(mergeBeatGrids([[10, 10.5, 11], [11, 11.5]]), [10, 10.5, 11, 11.5]);
  });

  it('collapses near-duplicates inside the gap tolerance', () => {
    near(mergeBeatGrids([[11], [11.02]], 0.05), [11]);
  });

  it('keeps beats further apart than the tolerance', () => {
    near(mergeBeatGrids([[11], [11.2]], 0.05), [11, 11.2]);
  });

  it('drops non-finite entries', () => {
    near(mergeBeatGrids([[1, NaN, 2, Infinity]]), [1, 2]);
  });

  it('is empty for no grids and for empty grids', () => {
    expect(mergeBeatGrids([])).toEqual([]);
    expect(mergeBeatGrids([[], []])).toEqual([]);
  });
});

describe('firstIndexAtOrAfter', () => {
  const grid = [10, 10.5, 11, 11.5, 12];

  it('finds an exact hit', () => {
    expect(firstIndexAtOrAfter(grid, 11)).toBe(2);
  });

  it('rounds up between beats', () => {
    // 10.6 falls between 10.5 (index 1) and 11 (index 2) -> the next beat is 11.
    expect(firstIndexAtOrAfter(grid, 10.6)).toBe(2);
  });

  it('returns 0 before the grid', () => {
    expect(firstIndexAtOrAfter(grid, 0)).toBe(0);
  });

  it('returns the length past the end', () => {
    expect(firstIndexAtOrAfter(grid, 99)).toBe(5);
  });

  it('is empty-safe', () => {
    expect(firstIndexAtOrAfter([], 5)).toBe(0);
  });
});

describe('scheduler walk — the property the whole feature rests on', () => {
  /** Emulate the click scheduler: step a horizon forward and drain the grid. */
  const walk = (grid: number[], from: number, to: number, stepSeconds: number) => {
    const emitted: number[] = [];
    let index = firstIndexAtOrAfter(grid, from);
    for (let t = from; t < to; t += stepSeconds) {
      const horizon = t + stepSeconds;
      while (index < grid.length && grid[index] <= horizon) {
        emitted.push(index);
        index += 1;
      }
    }
    return emitted;
  };

  it('emits every beat exactly once, in order, with no gaps', () => {
    const grid = beatGridFromAnchor(0.17, 133, 0, 3);
    const emitted = walk(grid, 0, 3, 0.025);
    expect(emitted).toEqual(grid.map((_, i) => i));
  });

  it('never re-emits a beat when the grid is swapped mid-walk', () => {
    // Crossing a section boundary replaces the grid; the index must stay monotone.
    const a = beatGridFromAnchor(0, 120, 0, 2);
    const b = mergeBeatGrids([a, beatGridFromAnchor(2, 90, 2, 4)]);
    const first = walk(a, 0, 1, 0.025);
    const resumed = walk(b, 1, 4, 0.025);
    expect(new Set(first).size).toBe(first.length);
    expect(new Set(resumed).size).toBe(resumed.length);
    for (let i = 1; i < resumed.length; i++) expect(resumed[i]).toBe(resumed[i - 1] + 1);
  });
});
