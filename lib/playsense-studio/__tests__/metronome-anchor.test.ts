import { describe, expect, it } from 'vitest';
import {
  qnToSeconds,
  rebaseAnchor,
  secondsToQn,
  type AnchorWaypoint,
} from '@/lib/playsense-studio/metronome-anchor';

// Two bars at 120bpm (0.5s/qn), starting 10s into the video.
const wps: AnchorWaypoint[] = [
  { musicalPositionQN: 0, videoTimeSeconds: 10 },
  { musicalPositionQN: 4, videoTimeSeconds: 12 },
  { musicalPositionQN: 8, videoTimeSeconds: 14 },
];

describe('qnToSeconds', () => {
  it('is exact at a waypoint', () => {
    expect(qnToSeconds(wps, 4)).toBeCloseTo(12, 9);
  });

  it('interpolates between waypoints', () => {
    expect(qnToSeconds(wps, 2)).toBeCloseTo(11, 9);
    expect(qnToSeconds(wps, 6)).toBeCloseTo(13, 9);
  });

  it('extrapolates before the first waypoint using the first interval slope', () => {
    expect(qnToSeconds(wps, -4)).toBeCloseTo(8, 9);
  });

  it('extrapolates after the last waypoint using the last interval slope', () => {
    expect(qnToSeconds(wps, 12)).toBeCloseTo(16, 9);
  });

  it('follows a tempo change rather than one global slope', () => {
    // Second bar takes twice as long as the first.
    const slowing: AnchorWaypoint[] = [
      { musicalPositionQN: 0, videoTimeSeconds: 0 },
      { musicalPositionQN: 4, videoTimeSeconds: 2 },
      { musicalPositionQN: 8, videoTimeSeconds: 6 },
    ];
    expect(qnToSeconds(slowing, 6)).toBeCloseTo(4, 9);
  });

  it('returns null rather than throwing when there is no slope to use', () => {
    expect(qnToSeconds([], 4)).toBeNull();
    expect(qnToSeconds([wps[0]], 4)).toBeNull();
    expect(qnToSeconds(wps, NaN)).toBeNull();
  });

  it('tolerates unsorted input', () => {
    expect(qnToSeconds([wps[2], wps[0], wps[1]], 2)).toBeCloseTo(11, 9);
  });
});

describe('secondsToQn', () => {
  it('is the inverse of qnToSeconds', () => {
    for (const qn of [-4, 0, 1.5, 4, 7.25, 12]) {
      expect(secondsToQn(wps, qnToSeconds(wps, qn)!)).toBeCloseTo(qn, 9);
    }
  });

  it('returns null when there is no slope to use', () => {
    expect(secondsToQn([], 11)).toBeNull();
    expect(secondsToQn([wps[0]], 11)).toBeNull();
  });
});

describe('rebaseAnchor', () => {
  // The sync was re-dragged: everything now sits 1s later and runs slower.
  const moved: AnchorWaypoint[] = [
    { musicalPositionQN: 0, videoTimeSeconds: 11 },
    { musicalPositionQN: 4, videoTimeSeconds: 14 },
  ];

  it('moves the anchor with the music when its musical position is known', () => {
    const next = rebaseAnchor({ anchorSeconds: 11, anchorQn: 2 }, moved);
    expect(next).not.toBeNull();
    // qn 2 is now halfway through a 3s bar.
    expect(next!.anchorSeconds).toBeCloseTo(12.5, 9);
    expect(next!.anchorQn).toBeCloseTo(2, 9);
  });

  it('adopts a musical position when the anchor only had seconds', () => {
    const next = rebaseAnchor({ anchorSeconds: 12.5, anchorQn: null }, moved);
    expect(next).not.toBeNull();
    // Seconds are left exactly where the admin put them...
    expect(next!.anchorSeconds).toBeCloseTo(12.5, 9);
    // ...and the qn is derived so the NEXT publish can rebase properly.
    expect(next!.anchorQn).toBeCloseTo(2, 9);
  });

  it('leaves the anchor untouched when the new map is unusable', () => {
    // Must never be able to fail a publish.
    expect(rebaseAnchor({ anchorSeconds: 11, anchorQn: 2 }, [])).toBeNull();
    expect(rebaseAnchor({ anchorSeconds: 11, anchorQn: 2 }, [moved[0]])).toBeNull();
  });

  it('leaves the anchor untouched when there is no anchor at all', () => {
    expect(rebaseAnchor({ anchorSeconds: null, anchorQn: null }, moved)).toBeNull();
  });
});
