'use client';

// Edit the document-level metadata: title, composer, initial tempo, and
// the time signature that's active until a measure overrides it.

import type { Dispatch } from 'react';
import type { EditorAction } from '@/lib/compas/editor-state';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

interface ScoreMetaEditorProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
}

export function ScoreMetaEditor({ score, dispatch }: ScoreMetaEditorProps) {
  return (
    <section className="bg-card border border-border rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Title
        </span>
        <input
          type="text"
          value={score.title}
          onChange={(e) => dispatch({ type: 'set-score-meta', title: e.target.value })}
          className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Composer
        </span>
        <input
          type="text"
          value={score.composer ?? ''}
          onChange={(e) => dispatch({ type: 'set-score-meta', composer: e.target.value })}
          className="w-full px-3 py-1.5 rounded border border-border bg-background text-sm"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Initial tempo (BPM)
        </span>
        <p className="font-mono text-sm tabular-nums">{score.initialTempo}</p>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Time signature
        </span>
        <p className="font-mono text-sm tabular-nums">
          {score.initialTimeSignature[0]}/{score.initialTimeSignature[1]}
        </p>
      </div>
    </section>
  );
}
