import { describe, expect, it } from 'vitest';
import { clampSectionShift } from '../section-drag';

const span = { startSeconds: 20, endSeconds: 30 };
describe('clampSectionShift (Review Focus 5)', () => {
  it('moves freely inside open space', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 100, 5)).toBe(5);
  });
  it('stops at the next section', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: 33 }, 100, 10)).toBe(3);
  });
  it('stops at the previous section', () => {
    expect(clampSectionShift(span, { lo: 18, hi: Infinity }, 100, -10)).toBe(-2);
  });
  it('never goes before 0 s or past the end of the video', () => {
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 100, -50)).toBe(-20);
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, 32, 50)).toBe(2);
    expect(clampSectionShift(span, { lo: -Infinity, hi: Infinity }, null, 500)).toBe(500);
  });
});
