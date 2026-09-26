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

import { Download, FileUp, Redo2, Save, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { replaceSectionScore } from '@/app/actions/playsense-studio';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import { useStudioDraft } from '@/components/playsense-studio/studio/drafts/use-studio-draft';
import { timingToTimeMap, type StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import type { MediaTrim } from '@/lib/playsense-studio/clip-model';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import type { LaneSection } from '@/components/playsense-studio/sync/sections-lane';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { HistoryPanel } from '@/components/playsense-studio/studio/drafts/history-panel';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import { HighwayPreview } from '@/components/playsense-studio/studio/highway-preview';
import { ExportDialog } from '@/components/playsense-studio/export/export-dialog';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface ScoreSectionEditorProps {
  classItemId: string;
  sectionId: string;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  /** Seeds the editor's draft timing (and so SyncPanel's markers and click
   *  anchor): the draft's timing when one exists, else live. */
  initialTiming: StudioTiming;
  classItemTitle: string;
  sectionIndex: number;
  sectionCount: number;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  /** Usable region of the lesson video, owned by the workspace above. */
  trim?: MediaTrim;
  onTrimDrag?: (edge: 'in' | 'out', videoTimeSeconds: number) => void;
  /** Re-fetch sections (ranges / score swapped). Called after Replace score. */
  onChanged: () => void;
  /** The latest content actually sent to (or pending for, at unmount) this
   *  section's draft — lets the host cache it locally so reselecting this
   *  section later seeds from it without waiting for a refetch. */
  onDraftContent?: (c: { score: ScoreDocument; timing: StudioTiming }) => void;
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

export function ScoreSectionEditor({
  classItemId,
  sectionId,
  scoreDocumentId,
  initialScore,
  initialTiming,
  classItemTitle,
  sectionIndex,
  sectionCount,
  videoUrl,
  videoDurationSeconds,
  trim,
  onTrimDrag,
  onChanged,
  onDraftContent,
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
  const { state, dispatch, undo, redo, canUndo, canRedo, markClean, replaceScore } = useEditor(initialScore);
  const draft = useStudioDraft({
    owner: { kind: 'section', id: sectionId },
    label: state.score.title,
    score: state.score,
    isDirty: state.isDirty,
    markClean,
    replaceScore,
    initialTiming,
    onDraftContent,
  });

  // SyncPanel seeds from the draft's timing, not the mount-time props: Restore
  // and Discard replace draft.timing and bump draft.timingEpoch, remounting
  // SyncPanel on the adopted timing. SyncPanel reads these only on mount, so
  // drags in between don't reseed it.
  const draftTimeMap = useMemo(() => timingToTimeMap(draft.timing), [draft.timing]);

  // App-bar slot SyncPanel portals its "Add score" chip into (state, not a ref,
  // so the portal renders once the node mounts).
  const [scoreActionsEl, setScoreActionsEl] = useState<HTMLElement | null>(null);

  // The sidebar row / lane label reads the live title straight from the
  // Studio-drafts status (useStudioDraft's own effect keeps `statuses[key].label`
  // in step with `state.score.title` on every render) — no refetch needed just
  // for a rename, and no risk of firing one per keystroke while still typing.

  // Cmd/Ctrl+Z = undo, +Shift = redo (or Ctrl+Y), Cmd/Ctrl+S = save now.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
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
        void draft.flush();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, draft]);

  return (
    <>
      {/* Center: error banner + the SyncPanel stage. */}
      {draft.error && (
        <p className="mb-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {draft.error}
        </p>
      )}

      <SyncPanel
        key={draft.timingEpoch}
        classItemId={classItemId}
        sectionId={sectionId}
        mode="video"
        videoUrl={videoUrl}
        score={state.score}
        dispatch={dispatch}
        activeTimeMap={draftTimeMap}
        videoDurationSeconds={videoDurationSeconds}
        initialMetronomeAnchorSeconds={draft.timing.anchor?.seconds ?? null}
        trim={trim}
        onTrimDrag={onTrimDrag}
        onTimingChange={draft.setTiming}
        registerTimingFlush={draft.registerPreFlush}
        inspectorEl={inspectorEl}
        transportEl={transportEl}
        monitorEl={monitorEl}
        scoreActionsEl={scoreActionsEl}
        sectionsContext={{ sections, activeSectionId: sectionId, onSelectSection }}
      />

      {/* App-bar: score action cluster. */}
      {appBarEl &&
        createPortal(
          <>
            {/* SyncPanel portals its "Add score" chip here. */}
            <span ref={setScoreActionsEl} className="contents" />
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
            <HistoryPanel owner={{ kind: 'section', id: sectionId }} />
            <ExportDialog
              score={state.score}
              classItemTitle={classItemTitle}
              sectionIndex={sectionIndex}
              sectionCount={sectionCount}
              classItemId={classItemId}
              trigger={
                <button type="button" className="st-chip" title="Export this section as PDF, MusicXML or MIDI">
                  <Download className="h-4 w-4" />
                  <span className="hidden lg:inline">Export</span>
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
            <span role="status" className="text-right text-xs tabular-nums text-muted-foreground">
              {draft.saveState === 'saving'
                ? 'Saving draft…'
                : draft.saveState === 'error'
                  ? 'Save failed'
                  : draft.pending
                    ? 'Saving soon…'
                    : draft.saveState === 'saved'
                      ? 'Draft saved'
                      : 'Autosave on'}
            </span>
            <button
              onClick={() => void draft.flush()}
              disabled={!draft.pending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{draft.saveState === 'error' ? 'Retry save' : 'Save now'}</span>
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
