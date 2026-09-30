'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// A card shown only while the score carries tempo marks that disagree with
// the lesson tempo — imported ones or ones set in the Bar menu — asking the
// admin to keep or clear them (spec §8). See lib/playsense-studio/tempo-marks.ts.

import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { unconfirmedTempoMarks } from '@/lib/playsense-studio/tempo-marks';

export function TempoMarksNotice({ score, dispatch }: { score: ScoreDocument; dispatch: Dispatch<EditorAction> }) {
  const st = useStudioText();
  const marks = unconfirmedTempoMarks(score);
  if (marks.length === 0) return null;

  const message = `This score has tempo marks that differ from the lesson tempo (${score.initialTempo} BPM): ${marks
    .map((m) => `m.${m.measureNumber} ♩=${m.bpm}`)
    .join(', ')}. Graded play ignores them until you keep them — this includes marks you set here.`;

  return (
    <div className="st-icard">
      <span className="st-sec-label" style={{ color: 'hsl(var(--gold-highlight))' }}>
        {st("Tempo marks")}</span>
      <p className="text-xs text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="st-chip"
          onClick={() => dispatch({ type: 'set-tempo-marks-confirmed', confirmed: true })}
        >
          {st("Keep them")}</button>
        <button
          type="button"
          className="st-chip"
          onClick={() => dispatch({ type: 'clear-tempo-marks', trackIndex: 0 })}
        >
          {st("Clear them")}</button>
      </div>
    </div>
  );
}
