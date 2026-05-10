'use client';

// Compás score editor — admin tool for fixing imported scores and authoring
// small additions. Structured form (track → measure → note) rather than
// click-to-place on a rendered staff. The plan calls Soundslice's editor
// "years of work" and explicitly caps M8's scope; this is the pragmatic
// MVP that handles the most common authoring tasks (correcting wrong
// pitches/durations from MIDI imports, adding/removing measures).

import { ArrowLeft, Redo2, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveScoreDocument } from '@/app/actions/compas';
import { useEditor } from '@/lib/compas/editor-state';
import {
  CompasPlayer,
  type CompasPlayerScoreTrack,
  type CompasPlayerTimeMap,
} from '@/components/compas/player/compas-player';
import { TrackEditor } from './track-editor';
import { ScoreMetaEditor } from './score-meta-editor';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

const AUTOSAVE_INTERVAL_MS = 5000;

interface ScoreEditorWorkspaceProps {
  classItemId: string;
  classItemTitle: string;
  videoUrl: string | null;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  tracks: CompasPlayerScoreTrack[];
  activeTimeMap: CompasPlayerTimeMap | null;
}

export function ScoreEditorWorkspace({
  classItemId,
  classItemTitle,
  videoUrl,
  scoreDocumentId,
  initialScore,
  tracks: initialTracks,
  activeTimeMap,
}: ScoreEditorWorkspaceProps) {
  const editor = useEditor(initialScore);
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean } = editor;
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);

  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSavedAt = useRef<number>(Date.now());

  const persist = () => {
    if (!state.isDirty) return;
    setSavingState('saving');
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveScoreDocument({
        scoreDocumentId,
        scoreDocument: state.score,
      });
      if (result.error) {
        setSavingState('error');
        setErrorMessage(result.error);
      } else {
        setSavingState('saved');
        lastSavedAt.current = Date.now();
        markClean();
      }
    });
  };

  // Autosave loop: every AUTOSAVE_INTERVAL_MS, if there are unsaved changes,
  // persist them.
  useEffect(() => {
    const id = setInterval(() => {
      if (state.isDirty && !isPending) persist();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isDirty, isPending]);

  // Keyboard: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) = redo,
  // Cmd/Ctrl+S = save now.
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

  // Reset active track index if we delete the current one.
  useEffect(() => {
    if (activeTrackIndex >= state.score.tracks.length) {
      setActiveTrackIndex(Math.max(0, state.score.tracks.length - 1));
    }
  }, [state.score.tracks.length, activeTrackIndex]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">Edit score — {classItemTitle}</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Cmd/Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="text-xs text-muted-foreground tabular-nums w-32 text-right">
            {savingState === 'saving' || isPending
              ? 'Saving…'
              : state.isDirty
                ? 'Unsaved changes'
                : savingState === 'saved'
                  ? 'All changes saved'
                  : ' '}
          </span>

          <button
            onClick={persist}
            disabled={!state.isDirty || isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </header>

      <main className="px-6 py-5 max-w-7xl mx-auto space-y-5">
        {errorMessage && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {errorMessage}
          </p>
        )}

        <ScoreMetaEditor score={state.score} dispatch={dispatch} />

        <TrackEditor
          score={state.score}
          activeTrackIndex={activeTrackIndex}
          onSelectTrack={setActiveTrackIndex}
          dispatch={dispatch}
        />

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Live preview</h3>
          <p className="text-xs text-muted-foreground">
            Plays the video against the current score. Edits here update the
            preview as soon as autosave commits (every 5 seconds, or hit Save).
          </p>
          <div className="bg-card border border-border rounded-lg p-4">
            {videoUrl ? (
              <CompasPlayer
                classItemId={classItemId}
                videoUrl={videoUrl}
                score={state.score}
                tracks={initialTracks}
                activeTimeMap={activeTimeMap}
                readOnly
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No video attached to this class item.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
