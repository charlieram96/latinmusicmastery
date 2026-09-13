'use client';

// PlaySense Studio chronometer — a single control that unifies tempo (BPM),
// playback rate, and the optional click track.
//
// BPM and playback rate are two views of one value: the transport's playback
// rate drives the video, and the notation cursor is derived from the video
// clock, so slowing/speeding the rate moves video + notation together.
//   effectiveBpm = baseBpm × playbackRate
//   set a BPM     → onRateChange(bpm / baseBpm)   (clamped to [0.1, 2])
//
// This is a PURE CONTROL: it owns no audio. The click track is phase-locked to
// the recording via a per-section anchor, which needs the video element, the
// active section and media time -- none of which this component knows. So the
// engine lives in PlaysenseStudioPlayer (useVideoClickTrack) and `clickOn` is
// lifted to it; here we only render the switch.
//
// Note `effectiveBpm` below is ROUNDED. That is fine for a readout and for the
// CSS pendulum, and it is exactly why the scheduler must never see it: a
// rounded tempo is cumulative phase error for a phase-locked click.

import { Bell, BellOff, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MIN_RATE = 0.1;
const MAX_RATE = 2;

const clampRate = (r: number) => Math.min(MAX_RATE, Math.max(MIN_RATE, r));

interface ChronometerControlProps {
  /** The score's notated tempo — the BPM shown at 1× playback. */
  baseBpm: number;
  beatsPerMeasure: number;
  playbackRate: number;
  isPlaying: boolean;
  onRateChange: (rate: number) => void;
  /** Click state, owned by the player that runs the engine. */
  clickOn: boolean;
  onClickOnChange: (on: boolean) => void;
  /** False when the section under the playhead has no anchor, so the click
   *  cannot be aligned to the recording. It still plays, just free-running. */
  clickAligned?: boolean;
  clickVolume: number;
  onClickVolumeChange: (volume: number) => void;
}

export function ChronometerControl({
  baseBpm,
  beatsPerMeasure,
  playbackRate,
  isPlaying,
  onRateChange,
  clickOn,
  onClickOnChange,
  clickAligned = true,
  clickVolume,
  onClickVolumeChange,
}: ChronometerControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const effectiveBpm = Math.round(baseBpm * playbackRate);
  const beatSeconds = effectiveBpm > 0 ? 60 / effectiveBpm : 0;
  const active = Math.abs(playbackRate - 1) > 0.001;

  const setBpm = (bpm: number) => onRateChange(clampRate(bpm / baseBpm));

  // --- close popover on outside pointerdown ---
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  // The pendulum arm swings once per beat; `alternate` makes a full L↔R cycle
  // take two beats, matching how a real metronome ticks each way.
  const swingStyle = {
    animationDuration: beatSeconds > 0 ? `${beatSeconds}s` : undefined,
    animationPlayState: isPlaying ? 'running' : 'paused',
  } as const;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="st-iconbtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Chronometer — tempo & speed"
        style={
          active
            ? {
                width: 'auto',
                paddingInline: 8,
                color: 'hsl(var(--primary))',
                background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)',
              }
            : { width: 'auto', paddingInline: 8 }
        }
      >
        <span className="flex items-center gap-1.5">
          <Pendulum size="sm" swingStyle={swingStyle} />
          <span className="font-mono text-[12px] font-semibold tabular-nums leading-none">
            {effectiveBpm}
          </span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chronometer"
          className="st-chrono-pop absolute bottom-full right-0 z-20 mb-2 w-[236px] rounded-xl border border-border bg-popover/95 p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md"
        >
          {/* Pendulum + BPM readout */}
          <div className="flex items-center gap-3">
            <Pendulum size="lg" swingStyle={swingStyle} />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold tabular-nums leading-none text-foreground">
                  {effectiveBpm}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  BPM
                </span>
              </div>
              <span className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                {playbackRate.toFixed(2)}×
              </span>
            </div>

            {/* BPM steppers */}
            <div className="ml-auto flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setBpm(effectiveBpm + 1)}
                className="st-chrono-step"
                aria-label="Increase tempo"
                disabled={playbackRate >= MAX_RATE - 0.0001}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBpm(effectiveBpm - 1)}
                className="st-chrono-step"
                aria-label="Decrease tempo"
                disabled={playbackRate <= MIN_RATE + 0.0001}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Rate slider */}
          <div className="mt-3.5">
            <input
              type="range"
              min={MIN_RATE}
              max={MAX_RATE}
              step={0.05}
              value={playbackRate}
              onChange={(e) => onRateChange(Number(e.target.value))}
              className="st-chrono-range w-full"
              aria-label="Playback speed"
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
              <span>0.1×</span>
              <button
                type="button"
                onClick={() => onRateChange(1)}
                className="rounded px-1.5 py-0.5 font-semibold text-foreground transition-colors hover:bg-muted"
                title="Reset to normal speed"
              >
                1×
              </button>
              <span>2×</span>
            </div>
          </div>

          {/* Click track toggle */}
          <button
            type="button"
            onClick={() => onClickOnChange(!clickOn)}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              clickOn
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-pressed={clickOn}
          >
            {clickOn ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            Click track
          </button>
          {clickOn && (
            <div className="mt-2 flex items-center gap-2">
              <span className="w-10 shrink-0 text-[11px] text-muted-foreground">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={clickVolume}
                onChange={(e) => onClickVolumeChange(Number(e.target.value))}
                className="flex-1 accent-primary"
                aria-label="Click volume"
              />
              <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {Math.round(clickVolume * 100)}
              </span>
            </div>
          )}
          {clickOn && !clickAligned && (
            <p className="mt-1.5 text-center text-[11px] leading-snug text-muted-foreground">
              Not aligned to the recording here
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// A little metronome glyph: a triangular body with a pivoting arm + weight.
// The arm's swing is CSS-driven (see .st-chrono-arm) at the tempo passed in.
function Pendulum({
  size,
  swingStyle,
}: {
  size: 'sm' | 'lg';
  swingStyle: CSSProperties;
}) {
  const dim = size === 'sm' ? 18 : 44;
  return (
    <span
      className="st-chrono"
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <span className="st-chrono-body" />
      <span className="st-chrono-arm" style={swingStyle}>
        <span className="st-chrono-weight" />
      </span>
      <span className="st-chrono-pivot" />
    </span>
  );
}
