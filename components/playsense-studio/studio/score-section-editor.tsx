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
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { saveScoreDocument, replaceSectionScore } from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import type { LaneSection } from '@/components/playsense-studio/sync/sections-lane';
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
  /** True when this section has an autosaved sync draft not yet Published. */
  hasDraft?: boolean;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  /** Re-fetch sections (ranges / score swapped). Called after publish or replace. */
  onChanged: () => void;
  /** All of this class item's sections — drives the timeline lane + overlap guard. */
  sections: LaneSection[];
  onSelectSection: (sectionId: string) => void;
  // App-shell slots provided by VideoSectionsWorkspace (portal targets).
  appBarEl: HTMLElement | null;
  metaEl: HTMLElement | null;
  inspectorEl: HTMLElement | null;
  transportEl: HTMLElement | null;
  monitorEl: HTMLElement | null;
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
  hasDraft,
  videoUrl,
  videoDurationSeconds,
  onChanged,
  sections,
  onSelectSection,
  appBarEl,
  metaEl,
  inspectorEl,
  transportEl,
  monitorEl,
  drawerEl,
  highwayOpen,
}: ScoreSectionEditorProps) {
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean } = useEditor(initialScore);

  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Latest editor state, mirrored so timers/handlers/unmount always read the
  // newest score (never a stale closure). savingRef prevents overlapping saves.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const savingRef = useRef(false);
  // The section name shown in the sidebar/lane IS the score title; refetch to
  // refresh it only when the title actually changed (renames are rare).
  const lastSyncedTitleRef = useRef(initialScore.title);

  const persist = useCallback(() => {
    const snap = stateRef.current;
    if (!snap.isDirty || savingRef.current) return;
    savingRef.current = true;
    setSavingState('saving');
    setErrorMessage(null);
    startTransition(async () => {
      const result = await saveScoreDocument({ scoreDocumentId, scoreDocument: snap.score });
      savingRef.current = false;
      if (result.error) {
        setSavingState('error');
        setErrorMessage(result.error);
        return;
      }
      setSavingState('saved');
      // Only clean if no edit landed during the save; the reducer clones on every
      // edit, so an unchanged reference means nothing newer is pending.
      if (stateRef.current.score === snap.score) markClean();
      if (snap.score.title !== lastSyncedTitleRef.current) {
        lastSyncedTitleRef.current = snap.score.title;
        onChanged();
      }
    });
  }, [scoreDocumentId, markClean, onChanged]);

  // Autosave every 5s (persist itself no-ops when clean / already saving).
  useEffect(() => {
    const id = setInterval(persist, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [persist]);

  // Flush a pending edit on unmount (e.g. switching sections) so nothing within
  // the autosave window is lost. Fire-and-forget: no local state / no onChanged
  // (the closed-over onChanged would reselect the section we just left).
  useEffect(() => {
    return () => {
      const snap = stateRef.current;
      if (snap.isDirty && !savingRef.current) {
        void saveScoreDocument({ scoreDocumentId, scoreDocument: snap.score });
      }
    };
  }, [scoreDocumentId]);

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
  }, [undo, redo, persist]);

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
        hasDraft={hasDraft}
        videoDurationSeconds={videoDurationSeconds}
        onPublished={onChanged}
        inspectorEl={inspectorEl}
        transportEl={transportEl}
        monitorEl={monitorEl}
        sectionsContext={{ sections, activeSectionId: sectionId, onSelectSection }}
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
