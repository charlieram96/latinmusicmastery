import { describe, expect, it } from 'vitest';
import { anchorPxFor, clampScrollLeft, fitRangeView, followScroll } from '../timeline-view';

const B = { minPps: 8, maxPps: 600, contentSeconds: 440 };

describe('clampScrollLeft', () => {
  it('keeps the view inside the content', () => {
    expect(clampScrollLeft(-50, 10, 1000, 440)).toBe(0);
    expect(clampScrollLeft(9999, 10, 1000, 440)).toBe(3400); // 440*10 - 1000
    expect(clampScrollLeft(500, 1, 1000, 440)).toBe(0);      // content narrower than the view
  });
});

describe('fitRangeView', () => {
  it('fits a 17 s section in a 7:20 video into the viewport with a 4% pad each side', () => {
    const v = fitRangeView(80, 97, 1360, B)!;
    // span 17 s + 2 * 0.68 s pad = 18.36 s over 1360 px
    expect(v.pps).toBeCloseTo(1360 / 18.36, 3);
    expect(v.scrollLeft).toBeCloseTo((80 - 0.68) * v.pps, 3);
  });
  it('clamps pps to the bounds', () => {
    expect(fitRangeView(0, 0.5, 1360, B)!.pps).toBe(600);
    expect(fitRangeView(0, 10000, 1360, { ...B, contentSeconds: 10000 })!.pps).toBe(8);
  });
  it('returns null without a viewport or with an empty range', () => {
    expect(fitRangeView(10, 20, 0, B)).toBeNull();
    expect(fitRangeView(20, 20, 1000, B)).toBeNull();
  });
});

describe('followScroll', () => {
  it('leaves the view alone while t is comfortably inside it', () => {
    expect(followScroll(15, 100, 1000, 1000, B)).toBeNull(); // x = 500
  });
  it('pages so t lands at 25% when it nears the right edge', () => {
    // x = 19.5*100 - 1000 = 950 > 90% of 1000
    expect(followScroll(19.5, 100, 1000, 1000, B)).toBeCloseTo(1950 - 250, 6);
  });
  it('jumps back to t when it is off to the left (a loop wrap or a seek)', () => {
    expect(followScroll(2, 100, 1000, 1000, B)).toBe(0); // 200 - 250 clamps to 0
  });
});

describe('anchorPxFor', () => {
  it('anchors on t when it is on screen, else on the centre', () => {
    expect(anchorPxFor(12, 100, 1000, 800)).toBe(200);
    expect(anchorPxFor(60, 100, 1000, 800)).toBe(400);
  });
});
