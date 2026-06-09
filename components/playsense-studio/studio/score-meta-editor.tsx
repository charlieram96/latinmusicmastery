'use client';

// Edit the document-level metadata: title, plus a read-out of the initial tempo
// and the time signature that's active until a measure overrides it. Laid out as
// a vertical form for the studio's left rail.

import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

interface ScoreMetaEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
}

export function ScoreMetaEditor({ score, dispatch }: ScoreMetaEditorProps) {
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
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm transition focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Tempo
          </span>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm tabular-nums">
            {score.initialTempo}
            <span className="ml-1 text-xs text-muted-foreground">BPM</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Time sig.
          </span>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm tabular-nums">
            {score.initialTimeSignature[0]}/{score.initialTimeSignature[1]}
          </div>
        </div>
      </div>
    </div>
  );
}
