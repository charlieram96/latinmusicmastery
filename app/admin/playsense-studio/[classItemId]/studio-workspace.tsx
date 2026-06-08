'use client';

// PlaySense Studio — the unified workspace. One screen where an admin builds a
// score and (when there's a video) syncs it to the audio. Used in TWO places off
// the SAME code: course class-items (optionally video-synced) and standalone
// songs (no video, fixed-BPM only). The owner prop discriminates the two.
//
// This parent owns the SCORE (useEditor — the single source of truth), autosave,
// undo/redo, and the shared header. The score's video clock lives inside SyncPanel.
// Below the editor, HighwayPreview shows the same falling-notes view the student
// gets, derived from the live score on a fixed-BPM clock.

import { ArrowLeft, FileUp, Redo2, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import {
  saveScoreDocument,
  updateSongMeta,
  type SongDifficulty,
} from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import { HighwayPreview } from '@/components/playsense-studio/studio/highway-preview';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export type StudioOwner =
  | { kind: 'classItem'; classItemId: string }
  | {
      kind: 'song';
      songId: string;
      difficulty: SongDifficulty;
      isPublished: boolean;
      trackIndex: number;
    };

/** Video lessons sync the score to the audio; exercises skip syncing entirely. */
export type StudioMode = 'video' | 'exercise';

export interface StudioWorkspaceProps {
  owner: StudioOwner;
  /** Class-item authoring mode. Songs (no video) ignore this — defaults to 'video'. */
  mode?: StudioMode;
  title: string;
  videoUrl: string | null;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  videoDurationSeconds: number | null;
}

const AUTOSAVE_INTERVAL_MS = 5000;

export function StudioWorkspace({
  owner,
  mode = 'video',
  title,
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

  // SyncPanel uses this only on video paths (waveform cache key + publish). For
  // songs there's no video, so the value is never read.
  const mediaOwnerId = owner.kind === 'classItem' ? owner.classItemId : owner.songId;
  const backHref = owner.kind === 'classItem' ? '/admin/courses' : '/admin/play-sense';

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
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {owner.kind === 'classItem' ? 'Admin' : 'Songs'}
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">PlaySense Studio — {title}</h1>

        {owner.kind === 'song' && <SongMetaControls owner={owner} />}

        <div className="ml-auto flex items-center gap-2">
          {owner.kind === 'classItem' && (
            <ScoreImportDialog
              classItemId={owner.classItemId}
              mode="replace"
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-2 text-sm transition hover:bg-muted"
                  title="Replace this lesson's score with a new import"
                >
                  <FileUp className="h-4 w-4" />
                  Replace score
                </button>
              }
            />
          )}
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

      <main className="space-y-6 px-6 py-6">
        {errorMessage && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <ScoreMetaEditor score={state.score} dispatch={dispatch} />

        <SyncPanel
          classItemId={mediaOwnerId}
          scoreDocumentId={scoreDocumentId}
          mode={mode}
          videoUrl={videoUrl}
          score={state.score}
          dispatch={dispatch}
          activeTimeMap={activeTimeMap}
          videoDurationSeconds={videoDurationSeconds}
        />

        <HighwayPreview
          score={state.score}
          scoreDocumentId={scoreDocumentId}
          title={state.score.title}
          difficulty={owner.kind === 'song' ? owner.difficulty : undefined}
          trackIndex={owner.kind === 'song' ? owner.trackIndex : 0}
        />
      </main>
    </div>
  );
}

// Song-only metadata strip: difficulty (drives grading tolerance) + publish.
// Writes to play_sense_songs; not part of the clock-agnostic ScoreDocument.
function SongMetaControls({
  owner,
}: {
  owner: Extract<StudioOwner, { kind: 'song' }>;
}) {
  const [difficulty, setDifficulty] = useState<SongDifficulty>(owner.difficulty);
  const [isPublished, setIsPublished] = useState(owner.isPublished);
  const [, startTransition] = useTransition();

  const onDifficulty = (d: SongDifficulty) => {
    setDifficulty(d);
    startTransition(() => {
      void updateSongMeta({ songId: owner.songId, difficulty: d });
    });
  };
  const onPublish = (next: boolean) => {
    setIsPublished(next);
    startTransition(() => {
      void updateSongMeta({ songId: owner.songId, isPublished: next });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs uppercase tracking-wider text-muted-foreground">Difficulty</label>
      <select
        value={difficulty}
        onChange={(e) => onDifficulty(e.target.value as SongDifficulty)}
        className="rounded border border-border bg-background px-2 py-1 text-xs"
        aria-label="Difficulty"
      >
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <button
        onClick={() => onPublish(!isPublished)}
        className={`rounded-md border px-2.5 py-1 text-xs transition ${
          isPublished
            ? 'border-green-500/30 bg-green-500/10 text-green-600'
            : 'border-border hover:bg-muted'
        }`}
        title={isPublished ? 'Published — students can see this song' : 'Draft — click to publish'}
      >
        {isPublished ? 'Published' : 'Draft'}
      </button>
    </div>
  );
}
