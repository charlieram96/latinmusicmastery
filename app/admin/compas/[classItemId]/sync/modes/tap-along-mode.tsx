'use client';

// Tap-along sync mode — best for rubato or live recordings. Admin plays
// the video and presses spacebar on each beat (or each measure downbeat,
// configurable). Each tap captures the video's currentTime; we map them
// to musical positions in order to produce waypoints.
//
// For v1 we assume the admin taps **measure downbeats** in order, starting
// at measure 1. Per-beat tapping can land later if it's needed; per-measure
// gives a usable result with the least friction.

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  measureLengthInQN,
} from '@/lib/compas/time-mapping';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';
import type { CompasPlayerTimeMap } from '@/components/compas/player/compas-player';
import type { CandidateTimeMap } from '../sync-workspace';

interface TapAlongModeProps {
  score: ScoreDocument;
  videoUrl: string;
  onCandidateChange: (candidate: CandidateTimeMap | null) => void;
}

interface Tap {
  videoTimeSeconds: number;
  measureNumber: number;
  musicalPositionQN: number;
}

export function TapAlongMode({ score, videoUrl, onCandidateChange }: TapAlongModeProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalMeasures = score.tracks[0]?.measures.length ?? 0;

  // Precompute the cumulative QN at each measure's downbeat.
  const measureQNs = useRef<number[]>([]);
  if (measureQNs.current.length === 0 && score.tracks[0]) {
    let cumulative = 0;
    let timeSig = score.initialTimeSignature;
    for (const m of score.tracks[0].measures) {
      if (m.timeSignature) timeSig = m.timeSignature;
      measureQNs.current.push(cumulative);
      cumulative += measureLengthInQN(timeSig);
    }
    // Add the final boundary so we have a bound past the last bar.
    measureQNs.current.push(cumulative);
  }

  // Spacebar handler — only active while the video is playing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      const video = videoRef.current;
      if (!video || video.paused) return;
      const measureIdx = taps.length;
      if (measureIdx >= measureQNs.current.length) return;
      setTaps((prev) => [
        ...prev,
        {
          videoTimeSeconds: video.currentTime,
          measureNumber: measureIdx + 1,
          musicalPositionQN: measureQNs.current[measureIdx],
        },
      ]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [taps.length]);

  useEffect(() => {
    if (taps.length >= 2) {
      const waypoints: CompasPlayerTimeMap['waypoints'] = taps.map((t) => ({
        musicalPositionQN: t.musicalPositionQN,
        videoTimeSeconds: t.videoTimeSeconds,
        measureNumber: t.measureNumber,
        beatInMeasure: 1,
      }));
      onCandidateChange({
        method: 'tap',
        params: { tap_count: taps.length, target: 'measure-downbeats' },
        waypoints,
      });
    } else {
      onCandidateChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">Tap-along</h3>
        <p className="text-xs text-muted-foreground">
          Play the video and press <kbd className="px-1 py-0.5 rounded bg-muted text-foreground text-[11px]">space</kbd>{' '}
          on each measure&apos;s downbeat. The first tap anchors bar 1, the
          second tap anchors bar 2, and so on. {taps.length} of {totalMeasures + 1}{' '}
          measure boundaries captured.
        </p>
      </div>

      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full max-h-80 bg-black rounded-md"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={togglePlay}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => setTaps([])}
          disabled={taps.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <RotateCcw className="w-4 h-4" />
          Clear taps
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {taps.length === 0
            ? 'Press Play, then tap space on bar 1 downbeat.'
            : taps.length < 2
              ? 'Tap at least one more downbeat to publish.'
              : `${taps.length} taps captured.`}
        </span>
      </div>

      {taps.length > 0 && (
        <div className="border border-border rounded-md max-h-40 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Bar</th>
                <th className="px-3 py-1.5 text-left font-medium">Video time</th>
                <th className="px-3 py-1.5 text-left font-medium">QN</th>
              </tr>
            </thead>
            <tbody>
              {taps.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1 tabular-nums">{t.measureNumber}</td>
                  <td className="px-3 py-1 font-mono tabular-nums">
                    {t.videoTimeSeconds.toFixed(3)} s
                  </td>
                  <td className="px-3 py-1 font-mono tabular-nums">
                    {t.musicalPositionQN.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
