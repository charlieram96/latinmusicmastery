'use client';

// Compás transport bar — play/pause, scrub, time, speed, A/B loop.
//
// Loop UI: a tiny "set A" / "set B" / clear-loop / loop-toggle cluster sits
// next to the rate selector. The scrub bar shows the loop range as a tinted
// span, with vertical markers at A and B. When loop is enabled but the user
// scrubs outside the range, the wrap kicks in on the next RAF tick.

import { Pause, Play, Repeat, RotateCcw, X } from 'lucide-react';
import { ClickTrackToggle } from './click-track-toggle';

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

  // A/B loop — endpoints are set by dragging on the staff. The transport
  // exposes the toggle + clear so the user can disarm/clear without
  // touching the staff.
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  onToggleLoop: () => void;
  onClearLoop: () => void;

  // Click-track context
  bpm: number;
  beatsPerMeasure: number;
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
  loopA,
  loopB,
  loopEnabled,
  onToggleLoop,
  onClearLoop,
  bpm,
  beatsPerMeasure,
}: TransportBarProps) {
  const safeDuration = Math.max(durationSeconds, 0.001);
  const loopAPct = loopA !== null ? (loopA / safeDuration) * 100 : null;
  const loopBPct = loopB !== null ? (loopB / safeDuration) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* Loop range tint */}
        {loopAPct !== null && loopBPct !== null && loopBPct > loopAPct && (
          <div
            aria-hidden
            className="absolute top-1/2 -translate-y-1/2 h-2 rounded pointer-events-none"
            style={{
              left: `${loopAPct}%`,
              width: `${loopBPct - loopAPct}%`,
              background: loopEnabled
                ? 'hsl(var(--primary) / 0.25)'
                : 'hsl(var(--primary) / 0.12)',
            }}
          />
        )}

        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.05}
          value={currentSeconds}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Scrub"
        />

        {/* A / B markers */}
        {loopAPct !== null && (
          <LoopMarker label="A" pct={loopAPct} />
        )}
        {loopBPct !== null && (
          <LoopMarker label="B" pct={loopBPct} />
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-2 sm:px-3 py-2 rounded-md border border-border hover:bg-muted transition"
          aria-label="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <span className="font-mono text-xs sm:text-sm tabular-nums">
          {formatSeconds(currentSeconds)}
          <span className="text-muted-foreground"> / {formatSeconds(durationSeconds)}</span>
        </span>

        {/* Loop control cluster — endpoints are set by dragging on the staff;
            this row only toggles + clears + offers the metronome. */}
        <div className="flex items-center gap-1 sm:ml-2">
          <button
            onClick={onToggleLoop}
            disabled={loopA === null || loopB === null}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition ${
              loopEnabled
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
            title={
              loopA === null || loopB === null
                ? 'Drag on the staff to set a loop range'
                : loopEnabled
                  ? 'Loop on'
                  : 'Loop off'
            }
            aria-pressed={loopEnabled}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Loop</span>
          </button>
          {(loopA !== null || loopB !== null) && (
            <button
              onClick={onClearLoop}
              className="p-1.5 rounded text-xs border border-border hover:bg-muted"
              title="Clear loop"
              aria-label="Clear loop"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ClickTrackToggle
            bpm={bpm}
            beatsPerMeasure={beatsPerMeasure}
            isPlaying={isPlaying}
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="hidden sm:inline text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Rate
          </span>
          {RATE_PRESETS.map((rate, i) => (
            <button
              key={rate}
              onClick={() => onRateChange(rate)}
              // Hide some rates on narrow screens so the row fits.
              className={`px-2 py-1 rounded text-xs ${
                i === 0 || i === 5
                  ? 'hidden md:inline-flex'
                  : i === 1 || i === 4
                    ? 'hidden sm:inline-flex'
                    : 'inline-flex'
              } items-center ${
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

function LoopMarker({ label, pct }: { label: string; pct: number }) {
  return (
    <div
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
      style={{ left: `${pct}%` }}
    >
      <div className="w-0.5 h-5 bg-primary" />
      <div className="text-[10px] font-bold text-primary mt-0.5 -translate-x-1/2 ml-0.5">
        {label}
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
