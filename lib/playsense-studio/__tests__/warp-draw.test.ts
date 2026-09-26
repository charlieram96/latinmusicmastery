import { describe, expect, it } from 'vitest';
import { FlexMap } from '../flex';
import { mediaForColumn } from '../warp-draw';

const p = (src: number, dst: number, anchor = false) => ({ src, dst, anchor });

describe('mediaForColumn', () => {
  it('passes the column through unchanged with the identity map', () => {
    expect(mediaForColumn(new FlexMap([]), 12.25, 12.5)).toEqual([12.25, 12.5]);
  });
  it('maps a timeline column to its media span through the warp', () => {
    const m = new FlexMap([p(10, 10, true), p(12, 12.5), p(14, 14, true)]);
    const [a, b] = mediaForColumn(m, 12.25, 12.5);
    expect(a).toBeCloseTo(m.toMedia(12.25), 9);
    expect(b).toBeCloseTo(m.toMedia(12.5), 9);
    expect(a).toBeCloseTo(11.8, 6);
    expect(b).toBeCloseTo(12, 6);
  });
});
