'use client';

// PlaySense Studio — the unified workspace. One screen where an admin builds a
// score for a video and syncs it to the audio. The waveform + draggable markers
// live on top of the EDITABLE notation strip (rendered inside SyncPanel via the
// IntegratedEditor), so the same notation that aligns with the audio is the one
// you edit. No separate "Build score" section — notation editing and syncing
// share one visualization.
//
// This parent owns the SCORE (useEditor — the single source of truth), autosave,
// undo/redo, and the shared header (plus a compact ScoreMetaEditor strip). The
// score's video clock lives inside SyncPanel (its only consumer), so playback
// doesn't re-render this parent.

import { ArrowLeft, Redo2, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveScoreDocument } from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface StudioWorkspaceProps {
  classItemId: string;
  classItemTitle: string;
  videoUrl: string | null;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  videoDurationSeconds: number | null;
}

const AUTOSAVE_INTERVAL_MS = 5000;

export function StudioWorkspace({
  classItemId,
  classItemTitle,
  videoUrl,
  scoreDocumentId,
  initialScore,
  activeTimeMap,
  videoDurationSeconds,
}: StudioWorkspaceProps) {
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">PlaySense Studio — {classItemTitle}</h1>

        <div className="ml-auto flex items-center gap-2">
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
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {errorMessage && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <ScoreMetaEditor score={state.score} dispatch={dispatch} />

        <SyncPanel
          classItemId={classItemId}
          scoreDocumentId={scoreDocumentId}
          videoUrl={videoUrl}
          score={state.score}
          dispatch={dispatch}
          activeTimeMap={activeTimeMap}
          videoDurationSeconds={videoDurationSeconds}
        />
      </main>
    </div>
  );
}
