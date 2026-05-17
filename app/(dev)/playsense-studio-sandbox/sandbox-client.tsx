'use client';

// PlaySense Studio M2 sandbox client.
//
// Loads each fixture, runs it through the staff renderer + transport clock,
// and surfaces minimal play/pause/seek/rate controls. This is the M2 demo
// surface from the plan: "Open sandbox, play, cursor moves; click a note,
// cursor jumps; toggle 0.5x/2x and verify speed."

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { FIXTURES, type FixtureId } from '@/lib/playsense-studio/score-fixtures';
import { trackDurationMs } from '@/lib/playsense-studio/time-mapping';
import { qnToTrackMs } from '@/lib/playsense-studio/time-mapping';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import { useTransportClock } from '@/components/playsense-studio/player/state/use-transport-clock';
import type { SeekTarget } from '@/lib/playsense-studio/renderer';

const FIXTURE_OPTIONS: Array<{ id: FixtureId; label: string }> = [
  { id: 'guitarLick', label: 'Guitar lick (C major scale)' },
  { id: 'congaTumbao', label: 'Conga tumbao 2-3' },
  { id: 'sonMontuno', label: 'Son montuno (multi-track, tempo change)' },
];

const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlaysenseStudioSandbox() {
  const [fixtureId, setFixtureId] = useState<FixtureId>('guitarLick');
  const [trackIndex, setTrackIndex] = useState(0);

  const score = FIXTURES[fixtureId];
  const track = score.tracks[trackIndex];

  const durationMs = useMemo(
    () => trackDurationMs(track, score),
    [track, score]
  );

  const clock = useTransportClock({ durationMs });

  const handleSeek = (target: SeekTarget) => {
    const ms = qnToTrackMs(track, score, target.qn);
    clock.seek(ms);
  };

  const handleFixtureChange = (id: FixtureId) => {
    clock.pause();
    setFixtureId(id);
    setTrackIndex(0);
    clock.seek(0);
  };

  const handleTrackChange = (idx: number) => {
    clock.pause();
    setTrackIndex(idx);
    clock.seek(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">PlaySense Studio Sandbox</h1>
          <p className="text-muted-foreground text-sm">
            M2 demo · staff renderer + transport clock · click notes to seek ·
            keyboard: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">space</kbd> play/pause
          </p>
        </header>

        <section className="flex flex-wrap gap-3">
          {FIXTURE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleFixtureChange(opt.id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition ${
                fixtureId === opt.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </section>

        {score.tracks.length > 1 && (
          <section className="flex flex-wrap gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground self-center mr-2">
              Track:
            </span>
            {score.tracks.map((t, i) => (
              <button
                key={i}
                onClick={() => handleTrackChange(i)}
                className={`px-2.5 py-1 rounded-md text-xs border transition ${
                  trackIndex === i
                    ? 'bg-secondary text-secondary-foreground border-secondary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
              >
                {t.displayName}
              </button>
            ))}
          </section>
        )}

        <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
          <StaffRenderer
            score={score}
            trackIndex={trackIndex}
            currentMs={clock.currentMs}
            onSeek={handleSeek}
          />
        </div>

        <section className="flex items-center gap-3 flex-wrap">
          <button
            onClick={clock.toggle}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            aria-label={clock.isPlaying ? 'Pause' : 'Play'}
          >
            {clock.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {clock.isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => clock.seek(0)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted"
            aria-label="Restart"
          >
            <RotateCcw className="w-4 h-4" />
            Restart
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
              Rate:
            </span>
            {RATE_PRESETS.map((rate) => (
              <button
                key={rate}
                onClick={() => clock.setPlaybackRate(rate)}
                className={`px-2 py-1 rounded text-xs ${
                  clock.playbackRate === rate
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-4 text-sm">
          <span className="font-mono">
            {formatMs(clock.currentMs)} / {formatMs(durationMs)}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs}
            step={10}
            value={clock.currentMs}
            onChange={(e) => clock.seek(Number(e.target.value))}
            className="flex-1"
            aria-label="Seek"
          />
        </section>

        <SpaceToToggle onToggle={clock.toggle} />
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function SpaceToToggle({ onToggle }: { onToggle: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);
  return null;
}
