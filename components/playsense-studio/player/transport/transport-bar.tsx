'use client';

// PlaySense Studio transport bar — play/pause, scrub, time, speed, A/B loop.
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

  // Scored-section regions drawn on the scrub bar (clickable to jump). Used by
  // multi-section video lessons; omitted elsewhere.
  sectionMarkers?: Array<{ startSeconds: number; endSeconds: number | null; label?: string | null }>;
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
  sectionMarkers,
}: TransportBarProps) {
  const safeDuration = Math.max(durationSeconds, 0.001);
  const loopAPct = loopA !== null ? (loopA / safeDuration) * 100 : null;
  const loopBPct = loopB !== null ? (loopB / safeDuration) * 100 : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* Scored-section regions (tint + clickable start ticks) */}
        {sectionMarkers?.map((m, i) => {
          const startPct = (m.startSeconds / safeDuration) * 100;
          const endPct = ((m.endSeconds ?? m.startSeconds) / safeDuration) * 100;
          return (
            <div
              key={`sec-tint-${i}`}
              aria-hidden
              className="absolute top-1/2 -translate-y-1/2 h-2 rounded pointer-events-none"
              style={{
                left: `${startPct}%`,
                width: `${Math.max(0.6, endPct - startPct)}%`,
                background: 'hsl(var(--secondary) / 0.55)',
              }}
            />
          );
        })}

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

        {/* Clickable section start ticks (sit above the range input). */}
        {sectionMarkers?.map((m, i) => {
          const startPct = (m.startSeconds / safeDuration) * 100;
          return (
            <button
              key={`sec-tick-${i}`}
              type="button"
              onClick={() => onSeek(m.startSeconds)}
              title={m.label ? `Jump to ${m.label}` : 'Jump to scored section'}
              aria-label={m.label ? `Jump to ${m.label}` : 'Jump to scored section'}
              className="absolute top-1/2 z-10 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-secondary transition hover:bg-secondary/70"
              style={{ left: `${startPct}%` }}
            />
          );
        })}

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
          className="st-play-btn"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>

        <button onClick={onRestart} className="st-iconbtn" aria-label="Restart">
          <RotateCcw className="h-4 w-4" />
        </button>

        <span className="st-tp-time">
          {formatSeconds(currentSeconds)}
          <span className="sep">/</span>
          {formatSeconds(durationSeconds)}
        </span>

        {/* Loop control cluster — endpoints are set by dragging on the staff;
            this row only toggles + clears + offers the metronome. */}
        <div className="flex items-center gap-1 sm:ml-2">
          <button
            onClick={onToggleLoop}
            disabled={loopA === null || loopB === null}
            className="st-iconbtn"
            style={
              loopEnabled
                ? {
                    color: 'hsl(var(--primary))',
                    background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)',
                  }
                : undefined
            }
            title={
              loopA === null || loopB === null
                ? 'Drag on the staff to set a loop range'
                : loopEnabled
                  ? 'Loop on'
                  : 'Loop off'
            }
            aria-pressed={loopEnabled}
          >
            <Repeat className="h-4 w-4" />
          </button>
          {(loopA !== null || loopB !== null) && (
            <button onClick={onClearLoop} className="st-iconbtn" title="Clear loop" aria-label="Clear loop">
              <X className="h-4 w-4" />
            </button>
          )}
          <ClickTrackToggle bpm={bpm} beatsPerMeasure={beatsPerMeasure} isPlaying={isPlaying} />
        </div>

        <span className="st-divline ml-auto hidden sm:block" />
        <div className="st-tp-rate">
          <span className="lab hidden sm:inline">Rate</span>
          <div className="st-seg mono">
            {RATE_PRESETS.map((rate) => (
              <button
                key={rate}
                onClick={() => onRateChange(rate)}
                className={Math.abs(playbackRate - rate) < 0.001 ? 'is-on' : ''}
              >
                {rate}×
              </button>
            ))}
          </div>
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
