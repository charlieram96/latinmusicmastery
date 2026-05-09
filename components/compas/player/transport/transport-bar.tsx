'use client';

// Compás transport bar — play/pause, scrub, time, speed.
//
// Shared between the M2 sandbox (RAF clock) and the M3 player (video clock).
// The component is unaware of the time source: it just gets a duration in
// seconds and a current value, and emits seek/playRate/toggle.

import { Pause, Play, RotateCcw } from 'lucide-react';

const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface TransportBarProps {
  currentSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;
}

export function TransportBar({
  currentSeconds,
  durationSeconds,
  isPlaying,
  playbackRate,
  onToggle,
  onRestart,
  onSeek,
  onRateChange,
}: TransportBarProps) {
  return (
    <div className="space-y-2">
      <input
        type="range"
        min={0}
        max={Math.max(durationSeconds, 0.001)}
        step={0.05}
        value={currentSeconds}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-primary"
        aria-label="Scrub"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted transition"
          aria-label="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <span className="font-mono text-sm tabular-nums">
          {formatSeconds(currentSeconds)} / {formatSeconds(durationSeconds)}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Rate
          </span>
          {RATE_PRESETS.map((rate) => (
            <button
              key={rate}
              onClick={() => onRateChange(rate)}
              className={`px-2 py-1 rounded text-xs ${
                Math.abs(playbackRate - rate) < 0.001
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const total = Math.floor(s);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
