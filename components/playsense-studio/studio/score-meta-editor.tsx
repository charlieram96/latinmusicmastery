'use client';

// Edit the document-level metadata: title, initial tempo and the time signature
// that's active until a measure overrides it. Laid out as a vertical form for the
// studio's left rail. Tempo and time-signature edits flow through the editor's
// 'set-score-meta' reducer action (which clamps tempo and keeps history).

import { ChevronDown } from 'lucide-react';
import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

interface ScoreMetaEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
}

const TIME_SIGNATURES: Array<[number, number]> = [
  [4, 4],
  [3, 4],
  [6, 8],
  [2, 4],
  [2, 2],
  [12, 8],
];

export function ScoreMetaEditor({ score, dispatch }: ScoreMetaEditorProps) {
  const [num, den] = score.initialTimeSignature;
  const sigValue = `${num}/${den}`;

  const nudgeTempo = (delta: number) =>
    dispatch({ type: 'set-score-meta', initialTempo: score.initialTempo + delta });

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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Tempo
          </span>
          <div className="st-stepper">
            <button type="button" onClick={() => nudgeTempo(-1)} aria-label="Decrease tempo">
              –
            </button>
            <input
              type="number"
              min={20}
              max={400}
              value={score.initialTempo}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) dispatch({ type: 'set-score-meta', initialTempo: v });
              }}
              aria-label="Tempo (BPM)"
            />
            <button type="button" onClick={() => nudgeTempo(1)} aria-label="Increase tempo">
              +
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Time sig.
          </span>
          <div className="st-select">
            <select
              value={sigValue}
              onChange={(e) => {
                const [n, d] = e.target.value.split('/').map(Number);
                dispatch({ type: 'set-score-meta', initialTimeSignature: [n, d] });
              }}
              aria-label="Time signature"
            >
              {TIME_SIGNATURES.map(([n, d]) => (
                <option key={`${n}/${d}`} value={`${n}/${d}`}>
                  {n}/{d}
                </option>
              ))}
            </select>
            <span className="caret">
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
