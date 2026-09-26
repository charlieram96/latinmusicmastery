import { describe, expect, it } from 'vitest';
import { FlexMap, type FlexPoint } from '../flex';
import { clickTimesInMedia, mediaSeekFor, timelineOf } from '../flex-player';

const p = (src: number, dst: number, anchor = false): FlexPoint => ({ src, dst, anchor });
const IDENTITY = new FlexMap([]);
// Task 1's fixture: a 12s->12.5s stretch anchored at 10s and 14s.
const THREE_POINT = new FlexMap([p(10, 10, true), p(12, 12.5), p(14, 14, true)]);
const stubTimeMap = (videoTimeSeconds: number) => ({ toVideoTime: () => videoTimeSeconds });

describe('timelineOf', () => {
  it('is a pass-through with the identity map', () => {
    expect(timelineOf(IDENTITY, 12.3)).toBe(12.3);
  });
  it('maps a media time through the flex points', () => {
    expect(timelineOf(THREE_POINT, 11)).toBeCloseTo(11.25);
  });
});

describe('mediaSeekFor', () => {
  it('is a pass-through with the identity map', () => {
    expect(mediaSeekFor(IDENTITY, stubTimeMap(12.3), 5)).toBe(12.3);
  });
  it('maps a qn whose timeline time is 12.5 to media 12', () => {
    expect(mediaSeekFor(THREE_POINT, stubTimeMap(12.5), 5)).toBe(12);
  });
});

describe('clickTimesInMedia', () => {
  it('is a pass-through with the identity map', () => {
    expect(clickTimesInMedia(IDENTITY, [10, 12.5, 14])).toEqual([10, 12.5, 14]);
  });
  it('maps each timeline beat time through toMedia', () => {
    expect(clickTimesInMedia(THREE_POINT, [10, 12.5, 14])).toEqual([10, 12, 14]);
  });
});
