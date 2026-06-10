'use client';

// PlaySense Studio — single-section editor.
//
// Owns the SCORE for one scored section (useEditor — the source of truth),
// autosave, undo/redo, a per-section "Replace score", and the video-sync panel.
// One of these is mounted at a time inside VideoSectionsWorkspace, keyed by the
// section + its score document so switching/replacing remounts cleanly.
//
// It renders the SyncPanel stage in the center column and PORTALS its chrome into
// the app-shell slots VideoSectionsWorkspace provides: the score-action cluster →
// the app-bar, the score-meta form → the left rail, and (when open) the highway
// preview → the bottom drawer. SyncPanel itself portals its inspector + transport
// into the right rail + bottom dock.

import { FileUp, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { saveScoreDocument, replaceSectionScore } from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import { HighwayPreview } from '@/components/playsense-studio/studio/highway-preview';
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
  // App-shell slots provided by VideoSectionsWorkspace (portal targets).
  appBarEl: HTMLElement | null;
  metaEl: HTMLElement | null;
  rightRailEl: HTMLElement | null;
  transportEl: HTMLElement | null;
  drawerEl: HTMLElement | null;
  highwayOpen: boolean;
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
  appBarEl,
  metaEl,
  rightRailEl,
  transportEl,
  drawerEl,
  highwayOpen,
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
    <>
      {/* Center: error banner + the SyncPanel stage. */}
      {errorMessage && (
        <p className="mb-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

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
        rightRailEl={rightRailEl}
        transportEl={transportEl}
      />

      {/* App-bar: score action cluster. */}
      {appBarEl &&
        createPortal(
          <>
            <ScoreImportDialog
              classItemId={classItemId}
              mode="replace"
              onConfirm={(score, filename) =>
                replaceSectionScore({ sectionId, scoreDocument: score, sourceFilename: filename })
              }
              onImported={onChanged}
              trigger={
                <button type="button" className="st-chip" title="Replace this section's score with a new import">
                  <FileUp className="h-4 w-4" />
                  <span className="hidden lg:inline">Replace score</span>
                </button>
              }
            />
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
          </>,
          appBarEl,
        )}

      {/* Left rail: score meta form. */}
      {metaEl && createPortal(<ScoreMetaEditor score={state.score} dispatch={dispatch} />, metaEl)}

      {/* Bottom drawer: student highway preview. */}
      {highwayOpen &&
        drawerEl &&
        createPortal(
          <div className="h-full overflow-y-auto px-4 py-3">
            <HighwayPreview
              score={state.score}
              scoreDocumentId={scoreDocumentId}
              title={state.score.title}
              trackIndex={0}
            />
          </div>,
          drawerEl,
        )}
    </>
  );
}
