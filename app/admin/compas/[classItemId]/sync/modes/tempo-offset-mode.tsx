'use client';

// Tempo + offset sync mode — the simplest sync method. Admin enters a
// constant BPM and a video offset (the second on the video where bar 1
// downbeat lands). We walk the score's measures and emit one waypoint
// per measure boundary, computed linearly from BPM. Tempo changes inside
// the score (parsed_score's per-measure tempoChange) are still respected
// so a 96 → 110 BPM jump still bends correctly.

import { useEffect, useMemo, useState } from 'react';
import {
  measureLengthInQN,
  qnToMs,
} from '@/lib/compas/time-mapping';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';
import type { CompasPlayerTimeMap } from '@/components/compas/player/compas-player';
import type { CandidateTimeMap } from '../sync-workspace';

interface TempoOffsetModeProps {
  score: ScoreDocument;
  videoUrl: string;
  onCandidateChange: (candidate: CandidateTimeMap | null) => void;
}

export function TempoOffsetMode({ score, onCandidateChange }: TempoOffsetModeProps) {
  const [bpm, setBpm] = useState(score.initialTempo);
  const [offsetSeconds, setOffsetSeconds] = useState(0);

  const waypoints = useMemo(
    () => buildWaypoints(score, bpm, offsetSeconds),
    [score, bpm, offsetSeconds]
  );

  useEffect(() => {
    if (waypoints.length >= 2) {
      onCandidateChange({
        method: 'tempo',
        params: { bpm, offset_seconds: offsetSeconds },
        waypoints,
      });
    } else {
      onCandidateChange(null);
    }
    // We intentionally exclude onCandidateChange from deps — the parent
    // passes a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, offsetSeconds, waypoints]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">Tempo + offset</h3>
        <p className="text-xs text-muted-foreground">
          Best for steady-tempo material (most metronomic studio tracks). Adjust
          BPM and start offset until the live preview&apos;s cursor lines up
          with the video&apos;s audio downbeats.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            BPM (quarter note)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={30}
              max={240}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="BPM"
            />
            <input
              type="number"
              min={30}
              max={240}
              step={0.1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm rounded border border-border bg-background tabular-nums"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Start offset (seconds)
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-5}
              max={30}
              step={0.05}
              value={offsetSeconds}
              onChange={(e) => setOffsetSeconds(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="Start offset"
            />
            <input
              type="number"
              min={-5}
              max={120}
              step={0.05}
              value={offsetSeconds}
              onChange={(e) => setOffsetSeconds(Number(e.target.value) || 0)}
              className="w-24 px-2 py-1 text-sm rounded border border-border bg-background tabular-nums"
            />
          </div>
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {waypoints.length} waypoint{waypoints.length === 1 ? '' : 's'} generated.
        Score&apos;s embedded tempo changes (if any) are preserved on top of this BPM.
      </p>
    </div>
  );
}

/**
 * Walk the score's measures and emit one waypoint per measure boundary.
 * The score's per-measure tempoChange is honored — at each measure the
 * "effective BPM" is the override if present, else the global BPM.
 */
function buildWaypoints(
  score: ScoreDocument,
  globalBpm: number,
  offsetSeconds: number
): CompasPlayerTimeMap['waypoints'] {
  const track = score.tracks[0];
  if (!track || track.measures.length === 0) return [];

  const out: CompasPlayerTimeMap['waypoints'] = [];
  let cumulativeQN = 0;
  let cumulativeMs = offsetSeconds * 1000;
  let timeSignature = score.initialTimeSignature;
  let bpm = globalBpm;
  let firstMeasure = true;

  for (const measure of track.measures) {
    if (measure.timeSignature) timeSignature = measure.timeSignature;
    if (measure.tempoChange !== undefined) bpm = measure.tempoChange;
    else if (firstMeasure) bpm = globalBpm;
    firstMeasure = false;

    out.push({
      musicalPositionQN: cumulativeQN,
      videoTimeSeconds: cumulativeMs / 1000,
      measureNumber: measure.number,
      beatInMeasure: 1,
    });

    const measureQN = measureLengthInQN(timeSignature);
    cumulativeQN += measureQN;
    cumulativeMs += qnToMs(measureQN, bpm);
  }

  // Tail waypoint at the end of the last measure so the player has a
  // bound past the final downbeat.
  out.push({
    musicalPositionQN: cumulativeQN,
    videoTimeSeconds: cumulativeMs / 1000,
    measureNumber: null,
    beatInMeasure: null,
  });

  // De-dup video time (in case bpm = 0 sneaks through) — strict-monotonic
  // is required by the player.
  return out.filter(
    (w: CompasPlayerTimeMap['waypoints'][number], i: number, arr: CompasPlayerTimeMap['waypoints']) =>
      i === 0 || w.videoTimeSeconds > arr[i - 1].videoTimeSeconds
  );
}
