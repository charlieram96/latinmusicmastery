import { describe, expect, it } from 'vitest';
import { timingPatchFromMarkers } from '../timing-patch';
import { seedMarkerState } from '@/components/playsense-studio/sync/marker-model';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

// The repo has no createBlankScore export — the blank-score factory
// (buildBlankScore) is private to a 'use server' module — so this is built by
// hand: the SCORE shape from draft-actions.test.ts, given a track with two
// 4/4 measures of whole rests so seedMarkerState/buildWaypoints have real
// measures to lay out.
const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'T',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [
    {
      index: 0,
      instrument: 'bass',
      displayName: 'Bass',
      tuning: null,
      stringMultiplicity: 1,
      channel: null,
      defaultView: 'staff',
      measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'rest', durationQN: 4 }] }] },
        { number: 2, voices: [{ number: 1, events: [{ kind: 'rest', durationQN: 4 }] }] },
      ],
    },
  ],
};

describe('timingPatchFromMarkers', () => {
  it('builds the drag timing a publish needs, with nudges in params', () => {
    const markers = seedMarkerState(SCORE.tracks[0], SCORE, buildWaypoints(SCORE, SCORE.initialTempo, 0));
    const patch = timingPatchFromMarkers(markers, { pps: 40, peaksCached: true })!;
    expect(patch.method).toBe('drag');
    expect(patch.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(patch.params).toMatchObject({ editedBeats: [], nudges: [], nudgedNotes: 0, pps: 40, peaksCached: true, version: 1 });
  });
});
