'use client';

// PlaySense Studio — score-editing panel (bottom half of the unified studio).
//
// The structured editor: score meta, track tabs, view-mode tabs (Staff /
// Piano-roll / List) and the active view. It is presentational over the
// editor's `score` + `dispatch`; the parent StudioWorkspace owns the score
// (useEditor), autosave, undo/redo, and persistence. Memoized so the parent's
// per-frame playback clock re-renders don't repaint the editing UI.

import { memo, useEffect, useState, type Dispatch } from 'react';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { ScoreMetaEditor } from './score-meta-editor';
import { TrackEditor } from './track-editor';
import { StaffEditView } from './staff-edit-view';
import { PianoRollView } from './piano-roll-view';

type EditorTab = 'staff' | 'piano-roll' | 'list';

export interface ScoreEditPanelProps {
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
}

export const ScoreEditPanel = memo(function ScoreEditPanel({
  score,
  dispatch,
}: ScoreEditPanelProps) {
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');

  // Keep the active track in range if a track was deleted.
  useEffect(() => {
    if (activeTrackIndex >= score.tracks.length) {
      setActiveTrackIndex(Math.max(0, score.tracks.length - 1));
    }
  }, [score.tracks.length, activeTrackIndex]);

  return (
    <div className="space-y-4">
      <ScoreMetaEditor score={score} dispatch={dispatch} />

      {score.tracks.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 self-center text-xs uppercase tracking-wider text-muted-foreground">
            Track
          </span>
          {score.tracks.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTrackIndex(i)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                i === activeTrackIndex
                  ? 'bg-secondary text-secondary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {t.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border">
        {(
          [
            { id: 'staff' as const, label: 'Staff' },
            { id: 'piano-roll' as const, label: 'Piano-roll' },
            { id: 'list' as const, label: 'List' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setEditorTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              editorTab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        {editorTab === 'staff' && (
          <StaffEditView score={score} activeTrackIndex={activeTrackIndex} dispatch={dispatch} />
        )}
        {editorTab === 'piano-roll' && (
          <PianoRollView score={score} activeTrackIndex={activeTrackIndex} dispatch={dispatch} />
        )}
        {editorTab === 'list' && (
          <TrackEditor
            score={score}
            activeTrackIndex={activeTrackIndex}
            onSelectTrack={setActiveTrackIndex}
            dispatch={dispatch}
          />
        )}
      </section>
    </div>
  );
});
