'use client';

// PlaySense Studio — marker seed controls.
//
// Replaces the old Tempo+offset and Tap-along tabs: both are now ways to lay
// down the editor's initial markers, which the admin then fine-tunes by
// dragging on the waveform.
//   • Tempo grid: enter BPM + start offset -> a measure-aligned grid.
//   • Tap: play the video and tap space on each measure downbeat.
// The component emits raw params; the workspace turns them into waypoints
// (buildWaypoints / buildTapSeed) and seeds the marker state.

import { useEffect, useState } from 'react';
import { Grid3x3, Hand, RotateCcw } from 'lucide-react';

export interface SeedControlsProps {
  initialBpm: number;
  /** True when the admin has dragged markers — applying a seed will overwrite. */
  hasEdits: boolean;
  /** Read the video's current time (seconds) when capturing a tap. */
  getCurrentSeconds: () => number;
  onApplyTempoSeed: (bpm: number, offsetSeconds: number) => void;
  onApplyTapSeed: (tapTimes: number[]) => void;
}

export function SeedControls({
  initialBpm,
  hasEdits,
  getCurrentSeconds,
  onApplyTempoSeed,
  onApplyTapSeed,
}: SeedControlsProps) {
  const [bpm, setBpm] = useState(initialBpm);
  const [offset, setOffset] = useState(0);
  const [tapMode, setTapMode] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);

  const confirmOverwrite = () =>
    !hasEdits || window.confirm('Re-seeding replaces your dragged markers. Continue?');

  // Spacebar capture while in tap mode.
  useEffect(() => {
    if (!tapMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setTaps((prev) => [...prev, getCurrentSeconds()]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tapMode, getCurrentSeconds]);

  const applyTempo = () => {
    if (!confirmOverwrite()) return;
    onApplyTempoSeed(bpm, offset);
  };

  const applyTaps = () => {
    if (taps.length < 2) return;
    if (!confirmOverwrite()) return;
    onApplyTapSeed(taps);
    setTapMode(false);
    setTaps([]);
  };

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-3">
      {/* Tempo grid */}
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">BPM</span>
          <input
            type="number"
            min={20}
            max={320}
            step={0.5}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || 0)}
            className="w-20 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Offset (s)</span>
          <input
            type="number"
            min={-10}
            max={600}
            step={0.05}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          onClick={applyTempo}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition hover:opacity-90"
        >
          <Grid3x3 className="h-4 w-4" />
          Seed tempo grid
        </button>
      </div>

      <div className="h-9 w-px bg-border" />

      {/* Tap seed */}
      <div className="flex items-center gap-2">
        {!tapMode ? (
          <button
            onClick={() => {
              setTaps([]);
              setTapMode(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted"
          >
            <Hand className="h-4 w-4" />
            Tap along
          </button>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Play the video and press{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">space</kbd> on each
              downbeat. {taps.length} captured.
            </span>
            <button
              onClick={applyTaps}
              disabled={taps.length < 2}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply taps
            </button>
            <button
              onClick={() => {
                setTapMode(false);
                setTaps([]);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" />
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
