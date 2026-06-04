'use client';

// In-studio rhythm-highway PREVIEW. Shows the author the exact falling-notes view
// the student gets — the SAME <RhythmHighway> component — derived from the score
// they're editing (scoreToExerciseDefinition), driven by an internal FIXED-BPM
// clock (never a video clock). Purely visual: no mic, no grading, no audio-mode
// prompt. The exercise re-derives from the live score while PAUSED so edits show;
// it's frozen during playback so a stray edit can't re-init the running highway.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { RhythmHighway } from '@/components/play-sense/rhythm-highway/RhythmHighway';
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise';
import { getExerciseDuration } from '@/lib/play-sense/exercise-utils';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { Difficulty } from '@/lib/play-sense/types';

export interface HighwayPreviewProps {
  score: ScoreDocument;
  scoreDocumentId: string;
  title: string;
  difficulty?: Difficulty;
  trackIndex?: number;
}

export function HighwayPreview({
  score,
  scoreDocumentId,
  title,
  difficulty,
  trackIndex,
}: HighwayPreviewProps) {
  // Live derivation — reflects note edits whenever we're not mid-playback.
  const liveExercise = useMemo(
    () =>
      scoreToExerciseDefinition(score, {
        id: scoreDocumentId,
        title,
        difficulty,
        trackIndex,
      }),
    [score, scoreDocumentId, title, difficulty, trackIndex]
  );

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metronomeBeat, setMetronomeBeat] = useState(0);

  // The exercise rendered while playing is frozen at play-start so live edits
  // don't re-init the PixiJS app mid-run.
  const frozenRef = useRef(liveExercise);
  const exercise = playing ? frozenRef.current : liveExercise;

  const hasEvents = exercise.events.length > 0;

  useEffect(() => {
    if (!playing) return;
    const ex = frozenRef.current;
    const duration = Math.max(0.001, getExerciseDuration(ex));
    const beatDur = 60 / ex.bpm;
    let raf = 0;
    let startTs = 0;
    const tick = (now: number) => {
      if (startTs === 0) startTs = now;
      const elapsed = (now - startTs) / 1000;
      const looped = elapsed % duration;
      setProgress(looped / duration);
      setMetronomeBeat(Math.floor(looped / beatDur));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const start = useCallback(() => {
    frozenRef.current = liveExercise;
    setProgress(0);
    setMetronomeBeat(0);
    setPlaying(true);
  }, [liveExercise]);

  const stop = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setMetronomeBeat(0);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Highway preview
        </h2>
        <span className="text-xs text-muted-foreground">
          {exercise.bpm} BPM · {exercise.timeSignature[0]}/{exercise.timeSignature[1]} · fixed-tempo
        </span>
        <div className="ml-auto flex items-center gap-2">
          {playing ? (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition hover:bg-muted"
            >
              <Pause className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!hasEvents}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Preview
            </button>
          )}
          {progress > 0 && !playing && (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-sm transition hover:bg-muted"
              title="Reset to start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-[360px] overflow-hidden rounded-xl border border-border bg-card">
        {hasEvents ? (
          <RhythmHighway
            exercise={exercise}
            sessionState="playing"
            playheadProgress={progress}
            currentScore={0}
            currentCombo={0}
            currentAccuracy={100}
            metronomeBeat={metronomeBeat}
            eventResultsLength={0}
            eventResults={[]}
            showHud={false}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Add notes to the score above to preview them on the rhythm highway.
          </div>
        )}
      </div>
    </div>
  );
}
