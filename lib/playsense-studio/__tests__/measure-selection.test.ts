import { describe, expect, it } from 'vitest';
import {
  clampSelection, clickSelect, dragSelect, isInSelection, measureAtX, selectionBounds, stepSelection,
} from '../measure-selection';

describe('measure selection', () => {
  it('a click selects one bar; ⇧-click extends from the anchor', () => {
    const one = clickSelect(null, 3, false);
    expect(one).toEqual({ anchor: 3, focus: 3 });
    expect(clickSelect(one, 6, true)).toEqual({ anchor: 3, focus: 6 });
    expect(clickSelect(null, 6, true)).toEqual({ anchor: 6, focus: 6 });
  });
  it('bounds are ordered whichever way the drag went', () => {
    expect(selectionBounds(dragSelect(5, 2))).toEqual([2, 5]);
    expect(selectionBounds(null)).toBeNull();
    expect(isInSelection(dragSelect(5, 2), 4)).toBe(true);
    expect(isInSelection(dragSelect(5, 2), 6)).toBe(false);
  });
  it('arrows move or extend, staying inside the score', () => {
    expect(stepSelection(null, 1, false, 8)).toEqual({ anchor: 0, focus: 0 });
    expect(stepSelection({ anchor: 2, focus: 2 }, 1, false, 8)).toEqual({ anchor: 3, focus: 3 });
    expect(stepSelection({ anchor: 2, focus: 2 }, 1, true, 8)).toEqual({ anchor: 2, focus: 3 });
    expect(stepSelection({ anchor: 7, focus: 7 }, 1, false, 8)).toEqual({ anchor: 7, focus: 7 });
    expect(stepSelection({ anchor: 0, focus: 0 }, -1, true, 8)).toEqual({ anchor: 0, focus: 0 });
    expect(stepSelection({ anchor: 0, focus: 0 }, 1, false, 0)).toBeNull();
  });
  it('a selection past the end after a delete or undo is clamped (Review Focus 2)', () => {
    const sel = { anchor: 4, focus: 5 };
    expect(clampSelection(sel, 4)).toEqual({ anchor: 3, focus: 3 });
    expect(clampSelection(sel, 6)).toBe(sel);
    expect(clampSelection(sel, 0)).toBeNull();
  });
  it('finds the bar under x, clamping past either end', () => {
    const bars = [{ left: 0, right: 100 }, { left: 100, right: 180 }, { left: 180, right: 300 }];
    expect(measureAtX(50, bars)).toBe(0);
    expect(measureAtX(100, bars)).toBe(1);
    expect(measureAtX(-40, bars)).toBe(0);
    expect(measureAtX(900, bars)).toBe(2);
    expect(measureAtX(10, [])).toBeNull();
  });
});
