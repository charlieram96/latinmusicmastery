'use client';

// Edit the document-level metadata: title, initial tempo and the time signature
// that's active until a measure overrides it. Laid out as a vertical form for the
// studio's left rail. Tempo and time-signature edits flow through the editor's
// 'set-score-meta' reducer action (which clamps tempo and keeps history).
//
// This is the ONLY tempo input in the studio — placing a score on the timeline
// spaces its measures at this tempo.

import { ChevronDown, Minus, Plus } from 'lucide-react';
import { useRef, useState, type Dispatch, type KeyboardEvent } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { Instrument, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { INSTRUMENT_OPTIONS } from '@/lib/playsense-studio/instrument-options';
import { TempoMarksNotice } from './tempo-marks-notice';

interface ScoreMetaEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  /** Single-track studio: the score model still holds Track[], but the
   *  editor always authors this one track. Defaults to 0. */
  trackIndex?: number;
}

const TIME_SIGNATURES: Array<[number, number]> = [
  [4, 4],
  [3, 4],
  [6, 8],
  [2, 4],
  [2, 2],
  [12, 8],
];

export function ScoreMetaEditor({ score, dispatch, trackIndex = 0 }: ScoreMetaEditorProps) {
  const [num, den] = score.initialTimeSignature;
  const track = score.tracks[trackIndex];

  // The field holds a draft while it is being typed in, so clearing it to
  // retype does not snap to the clamp floor, and one commit is one undo step.
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field, and that blur must not commit the abandoned draft.
  const reverting = useRef(false);

  const nudgeTempo = (delta: number) => {
    setDraft(null);
    dispatch({ type: 'set-score-meta', initialTempo: score.initialTempo + delta });
  };

  const commitDraft = () => {
    if (draft === null) return;
    setDraft(null);
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    const v = Number(draft.trim());
    if (draft.trim() !== '' && Number.isFinite(v)) {
      dispatch({ type: 'set-score-meta', initialTempo: v });
    }
  };

  const onTempoKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitDraft();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reverting.current = draft !== null;
      setDraft(null);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudgeTempo((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Title
        </span>
        <input
          type="text"
          value={score.title}
          onChange={(e) => dispatch({ type: 'set-score-meta', title: e.target.value })}
          className="st-input"
        />
      </label>

      {track && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Track name
            </span>
            <input
              type="text"
              value={track.displayName}
              onChange={(e) => dispatch({ type: 'set-track-name', trackIndex, name: e.target.value })}
              className="st-input"
              aria-label="Track name"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Instrument
            </span>
            <div className="st-select">
              <select
                value={track.instrument}
                onChange={(e) =>
                  dispatch({ type: 'set-track-instrument', trackIndex, instrument: e.target.value as Instrument })
                }
                aria-label="Instrument"
              >
                {INSTRUMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="caret">
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Tempo
        </span>
        <div className="st-stepper lg">
          <button type="button" onClick={() => nudgeTempo(-1)} aria-label="Decrease tempo">
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={draft ?? String(score.initialTempo)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={onTempoKeyDown}
            aria-label="Tempo (BPM)"
          />
          <span className="unit">BPM</span>
          <button type="button" onClick={() => nudgeTempo(1)} aria-label="Increase tempo">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Sets how the score is spaced when you place it on the timeline.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Time signature
        </span>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Time signature">
          {TIME_SIGNATURES.map(([n, d]) => {
            const isOn = n === num && d === den;
            return (
              <button
                key={`${n}/${d}`}
                type="button"
                onClick={() => dispatch({ type: 'set-score-meta', initialTimeSignature: [n, d] })}
                className={`st-chip justify-center font-mono tabular-nums${isOn ? ' is-on' : ''}`}
                role="radio"
                aria-checked={isOn}
              >
                {n}/{d}
              </button>
            );
          })}
        </div>
      </div>

      <TempoMarksNotice score={score} dispatch={dispatch} />
    </div>
  );
}
