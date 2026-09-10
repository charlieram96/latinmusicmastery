import { describe, expect, it } from 'vitest';
import { interludeProgress, lessonSectionGaps } from '../lesson-notation';

const first = { id: 'first', label: 'Cáscara', videoStartSeconds: 81, videoEndSeconds: 83.4 };

describe('video intervals around notation', () => {
  it('includes the introduction before the first score and the video afterward', () => {
    const gaps = lessonSectionGaps(first, [first], 440);
    expect(gaps.leading).toEqual({ startSeconds: 0, endSeconds: 81, nextLabel: 'Cáscara' });
    expect(gaps.trailing).toEqual({ startSeconds: 83.4, endSeconds: 440, nextLabel: null });
    expect(gaps.hasNext).toBe(false);
  });
  it('uses chronological sections and does not repeat the introduction on later scores', () => {
    const next = { id: 'next', label: 'Variation', videoStartSeconds: 150, videoEndSeconds: 180 };
    expect(lessonSectionGaps(first, [next, first], 440).trailing?.endSeconds).toBe(150);
    expect(lessonSectionGaps(next, [next, first], 440).leading).toBeNull();
  });
  it('does not invent a gap between adjacent or overlapping sections', () => {
    for (const start of [83.4, 82]) {
      const next = { ...first, id: 'next', videoStartSeconds: start, videoEndSeconds: 100 };
      expect(lessonSectionGaps(first, [first, next], 440).trailing).toBeNull();
    }
  });
  it('waits for video metadata before showing an unknown final duration', () => {
    expect(lessonSectionGaps(first, [first], 0).trailing).toBeNull();
    expect(lessonSectionGaps({ ...first, videoStartSeconds: 0 }, [{ ...first, videoStartSeconds: 0 }], 440).leading).toBeNull();
  });
  it('keeps fractional countdowns within their total, including seeks and the final hold', () => {
    expect(interludeProgress(0, 1000, 356600)).toEqual({ remaining: '5:57', progress: 0 });
    expect(interludeProgress(1000, 1000, 356600)).toEqual({ remaining: '5:57', progress: 0 });
    expect(interludeProgress(2600, 1000, 356600).remaining).toBe('5:55');
    expect(interludeProgress(500000, 1000, 356600)).toEqual({ remaining: '0:00', progress: 1 });
    expect(interludeProgress(-81000, -81000, 81000).remaining).toBe('1:21');
    expect(interludeProgress(-1000, -81000, 81000).remaining).toBe('0:01');
  });
});
