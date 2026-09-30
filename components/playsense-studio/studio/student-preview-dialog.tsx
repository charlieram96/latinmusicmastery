'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';
import { LanguageScope } from '@/components/language-provider';
import { CASCARA_COACHING_ID } from '@/lib/play-sense/cascara-coaching';


// PlaySense Studio — the Student preview dialog (Studio rework P5, Task 7).
//
// Runs the REAL student game (ScoreExerciseGame, in `preview` mode) over the
// draft's score, play settings, media and backing tracks — there is no
// separate simulated preview, so what the admin sees here can never drift
// from what a student sees (see the plan's Decision 2).
//
// A hand-rolled `role="dialog"` overlay, not the shadcn Dialog primitive:
// ScoreExerciseGame's own ExerciseModeFrame installs an Escape handler that
// deliberately steps aside for "an open settings menu or dialog" ancestor
// (it checks `event.target.closest('[role="dialog"]')`); this overlay's own
// Escape listener runs in the CAPTURE phase and stops propagation, so it
// always wins the race and ExerciseModeFrame never sees the keystroke —
// mirroring the same capture + stopPropagation idiom as
// studio/measure/popover.tsx's MeasurePopover.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ScoreExerciseGame } from '@/components/class-viewer/lesson-viewer/score-exercise-game';
import type { ExerciseDefinition } from '@/lib/play-sense/types';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { BackingTrack, ExerciseMedia } from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';

export interface StudentPreviewExerciseVideo {
  url: string;
  /** Trim in-point: where the usable region of the video starts. */
  startSeconds: number;
  /** End of the usable region; null/undefined = play to the end. */
  trimOutSeconds?: number | null;
  /** The older exercise time map — never read for a graded part; bar 1 (via `play`) places it. */
  timeMap: PlaysenseStudioPlayerTimeMap | null;
}

export interface StudentPreviewDialogProps {
  /** The graded exercise, built from the draft score (scoreToExerciseDefinition). */
  exercise: ExerciseDefinition;
  /** The draft score — rendered as staff notation alongside the highway. */
  score: ScoreDocument;
  /** The play-along video, built from the Studio's current (possibly unsaved)
   *  media + trim. Absent/null when the part has no play-along video. */
  exerciseVideo?: StudentPreviewExerciseVideo | null;
  /** The draft's play settings (bar 1, count-in, pre-roll). */
  play?: ExerciseMedia['play'] | null;
  /** The part's backing tracks (even an empty array — see ScoreExerciseGame's own prop doc). */
  backingTracks?: BackingTrack[];
  /** A jam session's own track plays audibly (Studio rework P5, Task 8 fix
   *  round 1) — see ScoreExerciseGame's own prop doc. Exercises leave this unset. */
  mediaAudible?: boolean;
  onClose: () => void;
}

/** A full-screen `role="dialog"` overlay that runs the student's own game
 *  component in preview mode. Closed by Esc or the close button — never by
 *  `window.alert`, which can't render this. */
export function StudentPreviewDialog(props: StudentPreviewDialogProps) {
  // This requested Spanish coaching demo must also work in an English browser session.
  return props.exercise.id === CASCARA_COACHING_ID
    ? <LanguageScope locale="es"><StudentPreviewContent {...props} /></LanguageScope>
    : <StudentPreviewContent {...props} />;
}

function StudentPreviewContent({
  exercise,
  score,
  exerciseVideo = null,
  play = null,
  backingTracks = [],
  mediaAudible = false,
  onClose,
}: StudentPreviewDialogProps) {
  const st = useStudioText();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // A portaled settings panel owns Escape before the preview itself.
        if (document.querySelector('[data-slot=popover-content][data-state=open]')) return;
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={st("Student preview")}
      className="fixed inset-0 z-[200] bg-background"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={st("Close student preview")}
        title={st("Close preview (Esc)")}
        className="absolute right-3 top-3 z-10 rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <ScoreExerciseGame
        preview
        exercise={exercise}
        score={score}
        exerciseVideo={exerciseVideo}
        play={play}
        backingTracks={backingTracks}
        mediaAudible={mediaAudible}
      />
    </div>
  );
}
