'use client';

// PlaySense Studio — single-section editor.
//
// Owns the SCORE for one scored section (useEditor — the source of truth),
// autosave, undo/redo, a per-section "Replace score", and the video-sync panel.
// One of these is mounted at a time inside VideoSectionsWorkspace, keyed by the
// section + its score document so switching/replacing remounts cleanly.

import { FileUp, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { saveScoreDocument, replaceSectionScore } from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface ScoreSectionEditorProps {
  classItemId: string;
  sectionId: string;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  /** Re-fetch sections (ranges / score swapped). Called after publish or replace. */
  onChanged: () => void;
}

const AUTOSAVE_INTERVAL_MS = 5000;

export function ScoreSectionEditor({
  classItemId,
  sectionId,
  scoreDocumentId,
  initialScore,
  activeTimeMap,
  videoUrl,
  videoDurationSeconds,
  onChanged,
}: ScoreSectionEditorProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean } = useEditor(initialScore);

  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const persist = () => {
    if (!state.isDirty) return;
    setSavingState('saving');
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveScoreDocument({ scoreDocumentId, scoreDocument: state.score });
      if (result.error) {
        setSavingState('error');
        setErrorMessage(result.error);
      } else {
        setSavingState('saved');
        markClean();
      }
    });
  };

  // Autosave every 5s when dirty.
  useEffect(() => {
    const id = setInterval(() => {
      if (state.isDirty && !isPending) persist();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isDirty, isPending]);

  // Cmd/Ctrl+Z = undo, +Shift = redo (or Ctrl+Y), Cmd/Ctrl+S = save now.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        persist();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ScoreImportDialog
          classItemId={classItemId}
          mode="replace"
          onConfirm={(score, filename) => replaceSectionScore({ sectionId, scoreDocument: score, sourceFilename: filename })}
          onImported={onChanged}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-2 text-sm transition hover:bg-muted"
              title="Replace this section's score with a new import"
            >
              <FileUp className="h-4 w-4" />
              Replace score
            </button>
          }
        />
        <button
          onClick={undo}
          disabled={!canUndo}
          className="rounded border border-border p-2 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          title="Undo (Cmd/Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="rounded border border-border p-2 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          title="Redo (Cmd/Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="w-32 text-right text-xs tabular-nums text-muted-foreground">
          {savingState === 'saving' || isPending
            ? 'Saving…'
            : state.isDirty
              ? 'Unsaved changes'
              : savingState === 'saved'
                ? 'All changes saved'
                : ' '}
        </span>

        <button
          onClick={persist}
          disabled={!state.isDirty || isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save score
        </button>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <ScoreMetaEditor score={state.score} dispatch={dispatch} />

      <SyncPanel
        classItemId={classItemId}
        scoreDocumentId={scoreDocumentId}
        sectionId={sectionId}
        mode="video"
        videoUrl={videoUrl}
        score={state.score}
        dispatch={dispatch}
        activeTimeMap={activeTimeMap}
        videoDurationSeconds={videoDurationSeconds}
        onPublished={onChanged}
      />
    </div>
  );
}
