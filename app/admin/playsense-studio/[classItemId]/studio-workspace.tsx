'use client';

// PlaySense Studio — the unified workspace. One screen where an admin builds a
// score and (when there's a video) syncs it to the audio. Used in TWO places off
// the SAME code: course class-items (optionally video-synced) and standalone
// songs (no video, fixed-BPM only). The owner prop discriminates the two.
//
// This parent owns the SCORE (useEditor — the single source of truth) and
// autosaves it (plus the timing) to a draft row via useStudioDraft, never
// straight to the live rows students read — see components/playsense-studio/
// studio/drafts/use-studio-draft.ts. undo/redo and the app-shell chrome are
// owned here too. The score's video clock lives inside SyncPanel, which renders
// the stage in the center column and PORTALS its inspector (right rail) and
// transport (bottom dock) into slots this shell provides — that keeps the
// <video> + clock inside SyncPanel's React tree while they appear in sibling
// regions. HighwayPreview (the student falling-notes view) lives in a
// collapsible bottom drawer toggled from the app-bar.
//
// Wrapped in its own StudioDraftsProvider (a no-op seed when a host, e.g.
// ExerciseStudio, already has one higher up — see drafts-context.tsx) so it
// can be mounted standalone from a page.tsx.

import { ArrowLeft, Activity, Copy, Eye, FileUp, Film, MonitorPlay, Music, PanelBottom, Redo2, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  updateExerciseVideoTrim,
  updateSongMeta,
  type ExerciseMedia,
  type SongDifficulty,
} from '@/app/actions/playsense-studio';
import type { StudioDraft } from '@/app/actions/studio-drafts';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { useEditor } from '@/lib/playsense-studio/editor-state';
import { useStudioDraft } from '@/components/playsense-studio/studio/drafts/use-studio-draft';
import { StudioDraftsProvider } from '@/components/playsense-studio/studio/drafts/drafts-context';
import { PublishControl } from '@/components/playsense-studio/studio/drafts/publish-control';
import { HistoryPanel } from '@/components/playsense-studio/studio/drafts/history-panel';
import { workspaceSeed } from '@/lib/playsense-studio/drafts/seed';
import { EMPTY_TIMING, timingToTimeMap, type StudioPlay, type StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import { buildExerciseGrid, scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise';
import { generateExpectedTimestamps } from '@/lib/play-sense/exercise-utils';
import { gridQNAtSeconds } from '@/lib/play-sense/grid';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { SyncPanel } from '@/components/playsense-studio/studio/sync-panel';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { ScoreMetaEditor } from '@/components/playsense-studio/studio/score-meta-editor';
import { HighwayPreview } from '@/components/playsense-studio/studio/highway-preview';
import { ExerciseMediaPanel } from '@/components/playsense-studio/studio/exercise-media-panel';
import { BackingLanesPanel } from '@/components/playsense-studio/studio/backing-lanes-panel';
import { HoverRail } from '@/components/playsense-studio/studio/shell/hover-rail';
import { FloatingVideo } from '@/components/playsense-studio/studio/shell/floating-video';
import { setTrimIn, setTrimOut, type MediaTrim } from '@/lib/playsense-studio/clip-model';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { copySectionScore } from '@/lib/playsense-studio/copy-section';
import { StudentPreviewDialog } from '@/components/playsense-studio/studio/student-preview-dialog';

/** A graded part with no placement yet: bar 1 at the trim-in, a 1-bar
 *  count-in, pre-roll on (the migration 044 defaults). */
const DEFAULT_PLAY: StudioPlay = { bar1Seconds: null, countInBars: 1, preroll: true };

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
  /** Class-item authoring: where the app-bar back link lands (the owning course's overview). */
  backHref?: string;
  /** Class-item authoring mode. Songs (no video) ignore this — defaults to 'video'. */
  mode?: StudioMode;
  title: string;
  videoUrl: string | null;
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  videoDurationSeconds: number | null;
  /** Extra app-bar content (e.g. the exercise Watch/Exercise part toggle). */
  appBarExtra?: React.ReactNode;
  /** EXERCISE class items: the play-part media (optional cropped video + backing tracks). */
  exerciseMedia?: ExerciseMedia | null;
  /** This owner's unpublished draft (score + timing), or null when there is none. */
  studioDraft?: StudioDraft | null;
  /** The latest content actually sent to (or pending for, at unmount) this
   *  owner's draft — lets a host (e.g. ExerciseStudio) cache it locally so
   *  switching back to this part later reseeds from it without a refetch. */
  onDraftContent?: (c: { score: ScoreDocument; timing: StudioTiming }) => void;
  /** EXERCISE items only (Studio rework P5): the Watch sections' scores,
   *  offered by "Copy notes from a Watch section" in the exercise score stage. */
  copySources?: Array<{ id: string; title: string; score: ScoreDocument }>;
}

/** The draft owner a StudioWorkspace saves under: a class item's own score
 *  (EXERCISE items and legacy single-score items alike) or a song. */
function draftOwnerOf(owner: StudioOwner): { kind: 'exercise' | 'song'; id: string } {
  return owner.kind === 'song' ? { kind: 'song', id: owner.songId } : { kind: 'exercise', id: owner.classItemId };
}

export function StudioWorkspace(props: StudioWorkspaceProps) {
  const { owner, mode = 'video', title, studioDraft } = props;
  const draftOwner = draftOwnerOf(owner);
  // The exercise score's draft label is always "Exercise" (there's only one
  // per class item); other owners (legacy single-score lessons, songs) use
  // their own title.
  const isExercise = mode === 'exercise' && owner.kind === 'classItem';
  const label = isExercise ? 'Exercise' : title;
  return (
    <StudioDraftsProvider owners={[{ owner: draftOwner, label, unpublished: !!studioDraft }]}>
      <StudioWorkspaceBody {...props} />
    </StudioDraftsProvider>
  );
}

function StudioWorkspaceBody({
  owner,
  backHref: classItemBackHref = '/admin/courses',
  mode = 'video',
  title,
  videoUrl,
  scoreDocumentId,
  initialScore,
  activeTimeMap,
  videoDurationSeconds,
  appBarExtra,
  exerciseMedia,
  studioDraft,
  onDraftContent,
  copySources = [],
}: StudioWorkspaceProps) {
  const draftOwner = draftOwnerOf(owner);

  // The exercise studio shows the highway inline (under the notation) and the
  // play-part media panel in the rail; other modes keep the preview drawer.
  const isExercise = mode === 'exercise' && owner.kind === 'classItem';

  // What this workspace opens on: the owner's unpublished draft, else live.
  // Mount-only — a later prop change (e.g. a parent refetch) doesn't reseed an
  // already-mounted editor; hosts remount this component (by key) instead.
  const seed = useMemo(
    () => workspaceSeed({ owner, mode, initialScore, activeTimeMap, exerciseMedia, studioDraft }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { state, dispatch, undo, redo, canUndo, canRedo, markClean, replaceScore } = useEditor(seed.score);
  const draft = useStudioDraft({
    owner: draftOwner,
    label: isExercise ? 'Exercise' : title,
    score: state.score,
    isDirty: state.isDirty,
    markClean,
    replaceScore,
    initialTiming: seed.timing,
    onDraftContent,
  });

  // How long the graded score runs at its own tempo — the exercise video's crop
  // window size. Tracks live edits (add/remove measures, tempo changes).
  const scoreLengthSeconds = useMemo(() => {
    const wps = buildWaypoints(state.score, state.score.initialTempo, 0);
    return wps.length ? wps[wps.length - 1].videoTimeSeconds : 0;
  }, [state.score]);

  // Portal targets the SyncPanel renders its inspector + transport into. State
  // (not refs) so the portal re-renders once the slot nodes mount.
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null);
  const [transportEl, setTransportEl] = useState<HTMLElement | null>(null);
  // App-bar slot SyncPanel portals its "Add score" chip into.
  const [scoreActionsEl, setScoreActionsEl] = useState<HTMLElement | null>(null);
  // Portal slot the floating PiP's body renders into; SyncPanel portals the
  // reference monitor there instead of the inspector.
  const [monitorEl, setMonitorEl] = useState<HTMLDivElement | null>(null);

  // Student "highway" preview, as a collapsible bottom drawer.
  const [highwayOpen, setHighwayOpen] = useState(false);

  // Exercise center-stage sub-view: edit the score, or sync the optional
  // play-along video to it. The video URL is lifted here (seeded from props,
  // updated by ExerciseMediaPanel) so the toggle + sync stage react
  // immediately to an upload/removal without a remount.
  const [exerciseStage, setExerciseStage] = useState<'score' | 'syncVideo'>('score');
  const [exerciseVideoUrl, setExerciseVideoUrl] = useState<string | null>(
    exerciseMedia?.videoUrl ?? null
  );
  // SyncPanel seeds follow the draft, not the mount-time `seed`, so restoring
  // or discarding (which replaces draft.timing wholesale and bumps
  // draft.timingEpoch) remounts SyncPanel on the adopted timing. SyncPanel
  // reads these only on mount, so drags in between don't reseed it.
  const draftTimeMap = useMemo(() => timingToTimeMap(draft.timing), [draft.timing]);
  const showExerciseSync = isExercise && exerciseStage === 'syncVideo' && !!exerciseVideoUrl;

  // Usable region of the play-along video. Owned here, next to the video URL,
  // because it belongs to the class item rather than to any one sync session.
  const [exerciseTrim, setExerciseTrim] = useState<MediaTrim>({
    trimInSeconds: exerciseMedia?.videoStartSeconds ?? 0,
    trimOutSeconds: exerciseMedia?.videoTrimOutSeconds ?? null,
  });

  // --- Graded play-along (Studio rework P5) ---
  // The exercise's play settings live in the draft's `timing.play`; bar 1
  // falls back to the trim-in point until the admin places it. The graded
  // onsets (one loop, seconds from bar 1, one per distinct onset — a chord is
  // one onset) are what Auto-align and the "notes on a hit" readout measure.
  // A draft saved before P5 has no `play` (publish reads that as "keep live"),
  // so it shows the live settings rather than the defaults.
  const exercisePlay: StudioPlay = draft.timing.play ?? exerciseMedia?.play ?? DEFAULT_PLAY;
  const handlePlayChange = useCallback(
    (patch: Partial<StudioPlay>) => draft.setTiming({ play: { ...exercisePlay, ...patch } }),
    [draft, exercisePlay]
  );
  const gradedGrid = useMemo(
    () => (isExercise && state.score.tracks[0] ? buildExerciseGrid(state.score, state.score.tracks[0]) : null),
    [isExercise, state.score]
  );
  const gradedOnsets = useMemo(() => {
    if (!isExercise) return [];
    const exercise = scoreToExerciseDefinition(state.score);
    const out: number[] = [];
    for (const e of generateExpectedTimestamps({ ...exercise, loopCount: 1 })) {
      if (!out.length || e.timestamp - out[out.length - 1] > 1e-6) out.push(e.timestamp);
    }
    return out;
  }, [isExercise, state.score]);
  const gradedBar1 = exercisePlay.bar1Seconds ?? exerciseTrim.trimInSeconds;
  // Backing clips record position_qn on the tempo grid from bar 1.
  const mediaToQN = useCallback(
    (mediaSeconds: number) => (gradedGrid ? gridQNAtSeconds(gradedGrid, mediaSeconds - gradedBar1) : 0),
    [gradedGrid, gradedBar1]
  );

  // --- Student preview (Studio rework P5, Task 7) ---
  // The real ScoreExerciseGame, in preview mode, over the draft's own score,
  // play settings, current (possibly unsaved) media and backing tracks — so
  // the preview can never drift from what students see.
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewExercise = useMemo(() => scoreToExerciseDefinition(state.score), [state.score]);
  const previewVideo = useMemo(
    () =>
      exerciseVideoUrl
        ? {
            url: exerciseVideoUrl,
            startSeconds: exerciseTrim.trimInSeconds,
            trimOutSeconds: exerciseTrim.trimOutSeconds,
            timeMap: null,
          }
        : null,
    [exerciseVideoUrl, exerciseTrim]
  );

  // --- Copy notes from a Watch section (Studio rework P5, Task 7) ---
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const applyCopiedSection = useCallback(
    (source: ScoreDocument, sectionTitle: string) => {
      if (!window.confirm(`Replace the exercise notes with "${sectionTitle}"? You can undo this.`)) return;
      const current = state.score;
      dispatch({ type: 'apply-structural-score', score: copySectionScore(source, current), expectedScore: current });
      setCopyMenuOpen(false);
    },
    [dispatch, state.score]
  );

  // Uploading/removing the play-along video invalidates any prior placement —
  // bar 1 and any trim were measured against the old file's timeline. This
  // must reach the draft: setTiming (not replaceTiming) marks it dirty so the
  // reset itself autosaves — otherwise a stale placement could still be
  // published for a video that no longer matches it (or, for a removal, is gone).
  const handleExerciseVideoChange = (url: string | null) => {
    setExerciseVideoUrl(url);
    setExerciseTrim({ trimInSeconds: 0, trimOutSeconds: null });
    draft.setTiming({ ...EMPTY_TIMING, anchor: draft.timing.anchor, play: { ...exercisePlay, bar1Seconds: null } });
    if (!url) setExerciseStage('score');
  };

  // Trim handles report a raw timeline position; the pure model clamps it, and
  // the write is debounced at the same 500ms the crop slider it replaces used.
  // This is a scalar write, not a time-map publish, so it doesn't need 1500ms.
  const exerciseTrimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exerciseTrimRef = useRef(exerciseTrim);
  exerciseTrimRef.current = exerciseTrim;

  const persistExerciseTrim = useCallback(() => {
    if (owner.kind !== 'classItem') return;
    const trim = exerciseTrimRef.current;
    void updateExerciseVideoTrim({
      classItemId: owner.classItemId,
      trimInSeconds: trim.trimInSeconds,
      trimOutSeconds: trim.trimOutSeconds,
    });
  }, [owner]);

  const handleExerciseTrimDrag = useCallback(
    (edge: 'in' | 'out', videoTimeSeconds: number) => {
      setExerciseTrim((prev) =>
        edge === 'in'
          ? setTrimIn(prev, null, videoTimeSeconds)
          : setTrimOut(prev, null, videoTimeSeconds)
      );
      if (exerciseTrimTimer.current) clearTimeout(exerciseTrimTimer.current);
      exerciseTrimTimer.current = setTimeout(persistExerciseTrim, 500);
    },
    [persistExerciseTrim]
  );

  // Flush a pending trim if the stage unmounts mid-drag.
  useEffect(
    () => () => {
      if (exerciseTrimTimer.current) {
        clearTimeout(exerciseTrimTimer.current);
        persistExerciseTrim();
      }
    },
    [persistExerciseTrim]
  );

  // SyncPanel uses this only on video paths (waveform cache key + publish). For
  // songs there's no video, so the value is never read.
  const mediaOwnerId = owner.kind === 'classItem' ? owner.classItemId : owner.songId;
  const backHref = owner.kind === 'classItem' ? classItemBackHref : '/admin/play-sense';

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

        {appBarExtra}

        {/* Exercise: switch the center stage between the graded score and syncing
            the optional play-along video to it. Only shown once a video exists. */}
        {isExercise && exerciseVideoUrl && (
          <div className="st-seg" role="radiogroup" aria-label="Exercise stage">
            <button
              type="button"
              role="radio"
              aria-checked={exerciseStage === 'score'}
              className={exerciseStage === 'score' ? 'is-on' : ''}
              onClick={() => setExerciseStage('score')}
              title="Edit the graded score students play on the highway"
            >
              <Music className="h-3.5 w-3.5" />
              Score
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={exerciseStage === 'syncVideo'}
              className={exerciseStage === 'syncVideo' ? 'is-on' : ''}
              onClick={() => setExerciseStage('syncVideo')}
              title="Sync the play-along video to the score's beats"
            >
              <Film className="h-3.5 w-3.5" />
              Sync video
            </button>
          </div>
        )}

        {/* Exercise score stage only: replace the graded notes wholesale with
            a Watch section's (Studio rework P5, Task 7). */}
        {isExercise && exerciseStage === 'score' && (
          <div className="relative">
            <button
              type="button"
              className="st-chip"
              onClick={() => setCopyMenuOpen((v) => !v)}
              disabled={copySources.length === 0}
              aria-haspopup="true"
              aria-expanded={copyMenuOpen}
              title={
                copySources.length === 0
                  ? 'No Watch sections to copy notes from yet'
                  : "Replace the exercise notes with a Watch section's"
              }
            >
              <Copy className="h-4 w-4" />
              <span className="hidden lg:inline">Copy notes from a Watch section</span>
            </button>
            {copyMenuOpen && copySources.length > 0 && (
              <>
                <div className="st-pop-scrim" onClick={() => setCopyMenuOpen(false)} />
                <div className="st-pop">
                  <span className="st-pop-label">Copy notes from a Watch section</span>
                  {copySources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="st-pop-item"
                      onClick={() => applyCopiedSection(s.score, s.title)}
                    >
                      <span className="tx">
                        <span className="t">{s.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {owner.kind === 'song' && <SongMetaControls owner={owner} />}

        <div className="ml-auto flex items-center gap-2">
          {/* Exercise mode shows the highway inline under the notation instead. */}
          {!isExercise && (
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
          )}

          {/* Runs the real student game in preview mode (exercises and jam
              sessions alike — Studio rework P5, Task 7). */}
          {isExercise && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="st-chip"
              title="Preview the exercise the way a student plays it"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Student preview</span>
            </button>
          )}

          {owner.kind === 'classItem' && <span ref={setScoreActionsEl} className="contents" />}
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

          <PublishControl />

          <HistoryPanel owner={draftOwner} />

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
        </div>
      </header>

      {/* ---- Body: hover rail (meta + inspector) · center stage ---- */}
      <div className="st-work">
        <HoverRail
          sections={[
            { id: 'score', label: 'Score', icon: Music, content: <ScoreMetaEditor score={state.score} dispatch={dispatch} /> },
            ...(isExercise && exerciseMedia && owner.kind === 'classItem'
              ? [{
                  id: 'media', label: 'Play-along media', icon: MonitorPlay,
                  content: (
                    <ExerciseMediaPanel
                      classItemId={owner.classItemId}
                      scoreLengthSeconds={scoreLengthSeconds}
                      initialMedia={exerciseMedia}
                      hasTimeMap={exercisePlay.bar1Seconds != null}
                      onVideoChange={handleExerciseVideoChange}
                    />
                  ),
                }]
              : []),
            { id: 'sync', label: 'Sync status', icon: Activity, content: <div ref={setInspectorEl} className="flex flex-col gap-3" /> },
          ]}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          {draft.error && (
            <p className="mb-3 shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {draft.error}
            </p>
          )}

          {showExerciseSync ? (
            // Place the play-along video under the graded score: bar 1 on the
            // tempo grid (timing.play), never a drag map. Legacy waypoints or an
            // anchor on an old exercise draft are ignored here.
            <SyncPanel
              key={draft.timingEpoch}
              classItemId={mediaOwnerId}
              mode="graded"
              publishTarget="exercise"
              videoUrl={exerciseVideoUrl}
              score={state.score}
              dispatch={dispatch}
              activeTimeMap={null}
              videoDurationSeconds={null}
              trim={exerciseTrim}
              onTrimDrag={handleExerciseTrimDrag}
              initialMetronomeAnchorSeconds={null}
              play={exercisePlay}
              onPlayChange={handlePlayChange}
              gradedOnsets={gradedOnsets}
              renderBackingLanes={(v) =>
                owner.kind === 'classItem' && exerciseMedia ? (
                  <BackingLanesPanel
                    classItemId={owner.classItemId}
                    tracks={exerciseMedia.backingTracks}
                    timeMap={null}
                    mediaToQN={mediaToQN}
                    view={v}
                  />
                ) : null
              }
              inspectorEl={inspectorEl}
              transportEl={transportEl}
              monitorEl={monitorEl}
              scoreActionsEl={scoreActionsEl}
              onTimingChange={draft.setTiming}
              onTimingSaved={() => setExerciseStage('syncVideo')}
              registerTimingFlush={draft.registerPreFlush}
            />
          ) : (
            <>
              <SyncPanel
                key={draft.timingEpoch}
                classItemId={mediaOwnerId}
                mode={mode}
                videoUrl={videoUrl}
                score={state.score}
                dispatch={dispatch}
                // Exercise mode's score stage has no video of its own — it
                // must not seed its markers from the play-along map that the
                // draft timing holds for this owner+mode. Only non-exercise
                // modes (video lessons, songs) open on the draft's timing.
                activeTimeMap={isExercise ? activeTimeMap : draftTimeMap}
                initialMetronomeAnchorSeconds={isExercise ? null : (draft.timing.anchor?.seconds ?? null)}
                videoDurationSeconds={videoDurationSeconds}
                inspectorEl={inspectorEl}
                transportEl={transportEl}
                monitorEl={monitorEl}
                scoreActionsEl={scoreActionsEl}
                onTimingChange={draft.setTiming}
                registerTimingFlush={draft.registerPreFlush}
              />

              {/* Exercise mode: the student's falling-notes view lives right under
                  the notation — the author sees both at once. */}
              {isExercise && (
                <div className="mt-3 shrink-0">
                  <HighwayPreview
                    score={state.score}
                    scoreDocumentId={scoreDocumentId}
                    title={state.score.title}
                    trackIndex={0}
                  />
                </div>
              )}
            </>
          )}
        </main>

        {/* Only render the PiP when the mounted SyncPanel will actually
            portal a monitor into it (mirrors its own showSync gate) — never
            in the exercise score stage, whose SyncPanel has mode="exercise"
            and shows no monitor at all. */}
        {(showExerciseSync ? !!exerciseVideoUrl : mode === 'video' && !!videoUrl) && (
          <FloatingVideo label={isExercise ? 'Play-along' : 'Reference'} onBodyEl={setMonitorEl} />
        )}
      </div>

      {/* ---- Bottom: transport dock + highway drawer ---- */}
      <div ref={setTransportEl} className="shrink-0" />

      {!isExercise && highwayOpen && (
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

      {isExercise && previewOpen && (
        <StudentPreviewDialog
          exercise={previewExercise}
          score={state.score}
          exerciseVideo={previewVideo}
          play={exercisePlay}
          backingTracks={exerciseMedia?.backingTracks}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

// Song-only metadata strip: difficulty (drives grading tolerance) + visibility.
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
        title={isPublished ? 'Visible — students can find this song' : "Hidden — students can't find this song"}
      >
        {isPublished ? 'Visible' : 'Hidden'}
      </button>
    </div>
  );
}
