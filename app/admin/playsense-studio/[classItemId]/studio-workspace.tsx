'use client';

// PlaySense Studio — the unified workspace. One screen where an admin builds a
// score and (when there's a video) syncs it to the audio. Used in TWO places off
// the SAME code: course class-items (optionally video-synced) and standalone
// songs (no video, fixed-BPM only). The owner prop discriminates the two.
//
// This parent owns the SCORE (useEditor — the single source of truth), autosave,
// undo/redo, and the app-shell chrome. The score's video clock lives inside
// SyncPanel, which renders the stage in the center column and PORTALS its
// inspector (right rail) and transport (bottom dock) into slots this shell
// provides — that keeps the <video> + clock inside SyncPanel's React tree while
// they appear in sibling regions. HighwayPreview (the student falling-notes view)
// lives in a collapsible bottom drawer toggled from the app-bar.

import { ArrowLeft, FileUp, PanelBottom, Redo2, Save, Undo2 } from 'lucide-react';
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

  // Portal targets the SyncPanel renders its inspector + transport into. State
  // (not refs) so the portal re-renders once the slot nodes mount.
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null);
  const [transportEl, setTransportEl] = useState<HTMLElement | null>(null);

  // Student "highway" preview, as a collapsible bottom drawer.
  const [highwayOpen, setHighwayOpen] = useState(false);

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
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background text-foreground md:h-[100dvh]">
      {/* ---- App bar ---- */}
      <header className="st-appbar">
        <Link
          href={backHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{owner.kind === 'classItem' ? 'Admin' : 'Songs'}</span>
        </Link>
        <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="hidden shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground md:inline">
            PlaySense Studio
          </span>
        </div>

        {owner.kind === 'song' && <SongMetaControls owner={owner} />}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHighwayOpen((o) => !o)}
            className={`st-chip${highwayOpen ? ' is-on' : ''}`}
            title="Toggle the student highway preview"
            aria-pressed={highwayOpen}
          >
            <PanelBottom className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {owner.kind === 'classItem' && (
            <ScoreImportDialog
              classItemId={owner.classItemId}
              mode="replace"
              trigger={
                <button
                  type="button"
                  className="st-chip"
                  title="Replace this lesson's score with a new import"
                >
                  <FileUp className="h-4 w-4" />
                  <span className="hidden lg:inline">Replace score</span>
                </button>
              }
            />
          )}

          <span className="mx-0.5 h-6 w-px bg-border" />

          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded-md border border-transparent p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            title="Undo (Cmd/Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded-md border border-transparent p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <span className="hidden w-28 text-right text-xs tabular-nums text-muted-foreground lg:inline">
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
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save score</span>
          </button>
        </div>
      </header>

      {/* ---- Body: left rail (meta + inspector) · center stage ---- */}
      <div className="flex min-h-0 flex-1">
        <aside className="st-rail st-rail-left hidden w-64 shrink-0 flex-col lg:flex">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div>
              <span className="st-sec-label">Score</span>
              <div className="mt-3">
                <ScoreMetaEditor score={state.score} dispatch={dispatch} />
              </div>
            </div>
            {/* Inspector: monitor/demo + selected note + sync status (SyncPanel portals here). */}
            <div
              ref={setInspectorEl}
              className="flex flex-col gap-3 border-t border-border pt-4 empty:hidden"
            />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          {errorMessage && (
            <p className="mb-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <SyncPanel
            classItemId={mediaOwnerId}
            scoreDocumentId={scoreDocumentId}
            mode={mode}
            videoUrl={videoUrl}
            score={state.score}
            dispatch={dispatch}
            activeTimeMap={activeTimeMap}
            videoDurationSeconds={videoDurationSeconds}
            inspectorEl={inspectorEl}
            transportEl={transportEl}
          />
        </main>
      </div>

      {/* ---- Bottom: transport dock + highway drawer ---- */}
      <div ref={setTransportEl} className="shrink-0" />

      {highwayOpen && (
        <div className="st-drawer" style={{ height: 380 }}>
          <div className="h-full overflow-y-auto px-4 py-3">
            <HighwayPreview
              score={state.score}
              scoreDocumentId={scoreDocumentId}
              title={state.score.title}
              difficulty={owner.kind === 'song' ? owner.difficulty : undefined}
              trackIndex={owner.kind === 'song' ? owner.trackIndex : 0}
            />
          </div>
        </div>
      )}
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
    <div className="ml-2 hidden items-center gap-2 md:flex">
      <label className="st-sec-label">Difficulty</label>
      <div className="st-select-wrap relative inline-flex items-center">
        <select
          value={difficulty}
          onChange={(e) => onDifficulty(e.target.value as SongDifficulty)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs"
          aria-label="Difficulty"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
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
