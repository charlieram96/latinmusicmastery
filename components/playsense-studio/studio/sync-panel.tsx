'use client';

// PlaySense Studio — sync panel (top half of the unified studio).
//
// Video audio waveform with numbered draggable measure markers (expandable to
// per-beat handles), notation aligned beneath, transport + per-measure loop +
// seed controls + zoom. Output is the same `drag` timing the student player
// eventually gets — this panel hands it to the host's draft; Publish
// (elsewhere in the Studio) is what makes it live.
//
// Receives the CURRENT score from the parent (which owns it via useEditor). When
// the score's measure structure changes, the markers are RECONCILED in place so
// dragged positions survive edits. Owns the single <video> + clock — the edit
// panel below has no preview player, so playback never re-renders the parent.

import { AudioLines, ChevronsLeftRight, FilePlus2, Loader2, Move, Music2, Repeat, Undo2, Wand2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { clampToTrim, trimRange, type MediaTrim } from '@/lib/playsense-studio/clip-model';
import { secondsToQn } from '@/lib/playsense-studio/metronome-anchor';
import { beatGridFromAnchor } from '@/lib/playsense-studio/beat-grid';
import {
  readStoredClickVolume,
  writeStoredClickVolume,
} from '@/lib/playsense-studio/click-track';
import { useVideoClickTrack } from '@/components/playsense-studio/player/state/use-video-click-track';
import { timingPatchFromMarkers } from '@/lib/playsense-studio/drafts/timing-patch';
import type { StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock';
import { TransportBar } from '@/components/playsense-studio/player/transport/transport-bar';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import { clampSectionShift } from '@/lib/playsense-studio/section-drag';
import { SNAP_PX, barFlags, firstAttackTime, flagText, snapBarTime, snapSectionShift } from '@/lib/playsense-studio/hits';
import { autoPlaceBars, windowWithinCorridor } from '@/lib/playsense-studio/auto-place';
import { useMarkerTween } from './use-marker-tween';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { WaveformPeaks } from '@/lib/playsense-studio/waveform';
import {
  EPS,
  clearNudge,
  freeCorridor,
  gridTime,
  markerSpan,
  markerStateToWaypoints,
  noteTicks,
  noteTime,
  nudgeDelta,
  nudgeList,
  orderedMarkers,
  rangesOverlap,
  reconcileMarkers,
  reinterpolateUnedited,
  seedMarkerState,
  setMarkerTime,
  setNoteDelta,
  setNoteTime,
  setTailTime,
  shiftMarkersFrom,
  structuralSignature,
  syncOnsets,
  type MarkerRef,
  type MarkerState,
  type TimeRange,
} from '@/components/playsense-studio/sync/marker-model';
import {
  WaveformCanvas,
  type DragMode,
  type DragTarget,
  type MarkerHandle,
} from '@/components/playsense-studio/sync/waveform-canvas';
import {
  IntegratedEditor,
  isTypingTarget,
  type IntegratedEditorMeasureTiming,
} from '@/components/playsense-studio/studio/integrated-editor';
import type { SelectedEventRef } from '@/components/playsense-studio/studio/editable-measure-strip';
import { PlaceScoreControl } from '@/components/playsense-studio/sync/place-score-control';
import { SectionsLane, type LaneSection } from '@/components/playsense-studio/sync/sections-lane';
import { resolvePercStroke, isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { collectOnsets, onsetForSelection } from '@/lib/playsense-studio/note-onsets';
import { isStructuralAction } from '@/lib/playsense-studio/measure-edits';
import { stripCopyTags, writeMeasureClipboard } from '@/lib/playsense-studio/measure-clipboard';
import { clipFromMeasures, prepareStructuralEdit } from '@/components/playsense-studio/sync/structural-timing';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { MidiRecordingSource } from './midi-record-button';
import { ReferenceMonitor } from '@/components/playsense-studio/sync/reference-monitor';
import { formatTime, NoteDetails, type NoteTimingProps } from '@/components/playsense-studio/studio/note-details';
import { ScrollBar } from '@/components/playsense-studio/sync/scroll-bar';
import { ZoomSlider } from '@/components/playsense-studio/sync/zoom-slider';
import { stableTimings } from '@/components/playsense-studio/studio/stable-timings';
import { clamp, MAX_PPS, MIN_PPS } from '@/components/playsense-studio/sync/zoom-range';
import { StageSplitter, clampWaveHeight, WAVE_DEFAULT } from '@/components/playsense-studio/studio/shell/stage-splitter';

/** A note selection, mirrored out of the editor so the right rail can show it. */
export interface StudioNoteSelection {
  ref: SelectedEventRef;
  trackIndex: number;
}

export interface SyncPanelProps {
  classItemId: string;
  /** The section being synced, when this panel edits one section's video timing —
   *  scopes the click anchor to it. */
  sectionId?: string;
  /** Scopes the click anchor when there's no `sectionId`: 'exercise' anchors to
   *  the class item's own play-along sync. */
  publishTarget?: 'classItem' | 'section' | 'exercise';
  /** 'video' = sync the score to the audio; 'exercise' = no sync, demo + highway. */
  mode: 'video' | 'exercise';
  videoUrl: string | null;
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  /** Hands a timing (and/or click-anchor) edit to the host's draft — the panel
   *  never writes timing live itself. */
  onTimingChange: (patch: Partial<StudioTiming>) => void;
  videoDurationSeconds: number | null;
  /** Fired once a timing edit has been handed off to the draft (`dirty` clears) —
   *  e.g. so a host can react without waiting on the debounced autosave. */
  onTimingSaved?: () => void;
  /** The host draft's `registerPreFlush` — lets Publish (or any flush) pull in
   *  a still-debounced drag or anchor edit before it snapshots and saves,
   *  instead of racing this panel's own 1.5 s / 500 ms timers. */
  registerTimingFlush?: (fn: () => void) => () => void;
  /** App-shell slot the inspector (note + sync status) portals into (left rail). */
  inspectorEl?: HTMLElement | null;
  /** App-shell slot the transport bar portals into (video mode only). */
  transportEl?: HTMLElement | null;
  /** Body slot of the floating PiP (FloatingVideo) the reference-video monitor
   *  portals into. Falls back to the inspector rail when absent. */
  monitorEl?: HTMLElement | null;
  /** App-bar slot for score-level actions this panel owns ("Add score"), so the
   *  appended measures get their timing through the panel's structural path. */
  scoreActionsEl?: HTMLElement | null;
  /** Sibling scored sections — drives the sections lane + overlap prevention. */
  sectionsContext?: {
    sections: LaneSection[];
    activeSectionId: string;
    onSelectSection: (sectionId: string) => void;
  };
  /** Optional lanes rendered under the waveform, sharing its coordinate space.
   *  A render prop rather than data props: this panel serves all three studios
   *  and has no business knowing what a backing track is. */
  renderBackingLanes?: (view: TimelineView) => ReactNode;
  /** One video second known to land on a beat — the phase reference for the
   *  student click track. Initial value; this panel owns it from then on
   *  (ScoreSectionEditor is keyed per section, so it remounts on a switch). */
  initialMetronomeAnchorSeconds?: number | null;
  /** Usable region of the media. Playback clamps to it and the canvas greys the
   *  rest out; sync waypoints keep their absolute positions either way. */
  trim?: MediaTrim;
  onTrimDrag?: (edge: 'in' | 'out', videoTimeSeconds: number) => void;
}

/** What a lane needs to draw in the same space as the waveform. */
export interface TimelineView {
  /** The reference media element, so lanes can slave audio to the same clock.
   *  A ref rather than the element: it mounts late, through a portal. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Usable region of the main track, in timeline seconds. */
  usableRegion: { startSeconds: number; endSeconds: number };
  pixelsPerSecond: number;
  scrollLeftPx: number;
  timelineDurationSeconds: number;
  viewportWidth: number;
  /** Measure downbeats, for Shift-snap. */
  snapTimes: number[];
  getCurrentSeconds: () => number;
  isPlaying: boolean;
  playbackRate: number;
  onScrollByPx: (dx: number) => void;
  onZoomBy: (factor: number, anchorPx?: number) => void;
}

const VIDEO_MUTED_KEY = 'playsense.studioVideoMuted';
const VIDEO_VOLUME_KEY = 'playsense.studioVideoVolume';

/** localStorage can throw (private windows, blocked site data) — never let a
 *  monitoring preference stop the panel rendering. */
function readStoredFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}
function readStoredLevel(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw == null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
  } catch {
    return fallback;
  }
}
function writeStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* not persisting is fine */
  }
}

const TIMING_DEBOUNCE_MS = 1500;
/** Stable empty array so `peaks?.hits ?? EMPTY_HITS` never churns deps with a
 *  fresh `[]` every render when there are no detected hits yet. */
const EMPTY_HITS: number[] = [];

function findBeatTime(state: MarkerState, ref: MarkerRef): number | null {
  const m = state.measures.find((mm) => mm.measureNumber === ref.measureNumber);
  if (!m) return null;
  const beat = m.beats.find((b) => b.beatInMeasure === ref.beatInMeasure);
  return beat ? beat.videoTimeSeconds : null;
}

export function SyncPanel({
  classItemId,
  sectionId,
  publishTarget,
  mode,
  videoUrl,
  score,
  dispatch,
  activeTimeMap,
  onTimingChange,
  videoDurationSeconds,
  onTimingSaved,
  registerTimingFlush,
  inspectorEl,
  transportEl,
  monitorEl,
  scoreActionsEl,
  sectionsContext,
  renderBackingLanes,
  initialMetronomeAnchorSeconds,
  trim,
  onTrimDrag,
}: SyncPanelProps) {
  const track = score.tracks[0];

  // Note selection, mirrored out of the (memoized) IntegratedEditor so the right
  // rail inspector can show the selected note. The editor stays the source of
  // truth; this is a display mirror updated via a stable callback.
  const [selection, setSelection] = useState<StudioNoteSelection | null>(null);
  const handleSelectionChange = useCallback((s: StudioNoteSelection | null) => setSelection(s), []);

  // The full "sync to audio" experience (waveform + draggable markers +
  // transport) only renders for VIDEO lessons with a video. Exercises and
  // songs edit the staff on a fixed-BPM grid with no time map.
  const showSync = mode === 'video' && !!videoUrl;

  // Waveform lane height — the admin trades it against the measure strip with
  // the StageSplitter. Per-viewer, so it's read/written to localStorage.
  const [waveH, setWaveH] = useState(WAVE_DEFAULT);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('playsense-studio:wave-height');
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) setWaveH(clampWaveHeight(n));
      }
    } catch { /* storage unavailable */ }
  }, []);
  const changeWaveH = useCallback((h: number) => {
    setWaveH(h);
    try { localStorage.setItem('playsense-studio:wave-height', String(h)); } catch { /* storage unavailable */ }
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef);
  // When there's no waveform (video-less songs) the canvas can't report the
  // viewport width, so we measure the editor area directly to drive layout/zoom.
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  // --- Marker state ---
  // `activeTimeMap` is the host's SEED — the draft's timing when there is one,
  // else the published map — and wins when it has one; otherwise lay the
  // measures from 0 at the score's tempo. The admin repositions them with
  // Import-at-playhead and by dragging — the video has no single tempo, so
  // there's no auto-fit across the audio.
  const [markers, setMarkers] = useState<MarkerState>(() => {
    if (activeTimeMap && activeTimeMap.waypoints.length >= 2) {
      return seedMarkerState(track, score, activeTimeMap.waypoints, activeTimeMap.nudges ?? []);
    }
    return seedMarkerState(track, score, buildWaypoints(score, score.initialTempo, 0));
  });
  const [dirty, setDirty] = useState(false);
  // Faint note-onset ticks over the waveform — default on (they're low-opacity).
  const [showNotes, setShowNotes] = useState(true);

  // Reconcile markers when the score's MEASURE STRUCTURE changes (add/delete
  // measure, time-signature/tempo change). Note edits don't change the
  // signature, so they don't churn the markers.
  const sig = useMemo(() => structuralSignature(score), [score]);
  const prevSig = useRef(sig);
  const previousScore = useRef(score);
  const recordingMarkerHistory = useRef(new WeakMap<ScoreDocument, MarkerState>());
  const anchorRefreshRef = useRef(false);
  // A refused structural edit (or one that would overlap a sibling section).
  const [editNotice, setEditNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!editNotice) return;
    const id = setTimeout(() => setEditNotice(null), 4500);
    return () => clearTimeout(id);
  }, [editNotice]);
  useEffect(() => {
    if (previousScore.current === score) return;
    recordingMarkerHistory.current.set(previousScore.current, markersRef.current);
    previousScore.current = score;
    const recordedMarkers = recordingMarkerHistory.current.get(score);
    const structureChanged = prevSig.current !== sig;
    prevSig.current = sig;
    if (recordedMarkers || structureChanged) {
      setMarkers((prev) => recordedMarkers ?? reconcileMarkers(prev, score.tracks[0], score));
      setDirty(true);
      // The qn axis moved under the click anchor: keep its SECOND and re-derive
      // its qn before the next timing hand-off (see saveTiming), or a later
      // publish's qn-based rebase would slide the click along the video.
      anchorRefreshRef.current = true;
    }
  }, [sig, score]);

  // Note edits (add/delete/duration) move onsets without touching the structural
  // signature, so the markers' onset lists are refreshed on EVERY score change.
  // syncOnsets returns the same reference when nothing changed, so this stays
  // silent for pitch edits and never churns the autosave.
  const onsets = useMemo(() => collectOnsets(score), [score]);
  useEffect(() => {
    setMarkers((prev) => {
      const next = syncOnsets(prev, onsets);
      if (next !== prev) setDirty(true);
      return next;
    });
  }, [onsets]);

  // --- View state ---
  const [pps, setPps] = useState(40);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [selected, setSelected] = useState<MarkerRef | 'tail' | null>(null);
  // Region drag is the easy default: grabbing a measure shifts it + everything
  // after. Toolbar toggle / Alt switches to single. Applies to measure-block
  // drags and the waveform markers alike.
  const [dragAll, setDragAll] = useState(true);

  // --- Sibling sections (overlap prevention + sections lane) ---
  // The active section's own stored range is excluded: re-syncing over its old
  // footprint is always allowed, and its live span renders from the markers.
  const siblingRanges: TimeRange[] = useMemo(
    () =>
      (sectionsContext?.sections ?? [])
        .filter(
          (s) =>
            s.sectionId !== sectionsContext!.activeSectionId &&
            s.startSeconds != null &&
            s.endSeconds != null
        )
        .map((s) => ({ startSeconds: s.startSeconds!, endSeconds: s.endSeconds! }))
        .sort((a, b) => a.startSeconds - b.startSeconds),
    [sectionsContext]
  );

  // The open corridor the current span may move within, mirrored into a ref so
  // the canvas's pointer listeners (which depend on the drag callbacks) never
  // re-bind mid-drag.
  const corridor = useMemo(() => freeCorridor(markerSpan(markers), siblingRanges), [markers, siblingRanges]);
  const corridorRef = useRef(corridor);
  corridorRef.current = corridor;

  // --- Place-at-playhead (two-step, with a live ghost preview) ---
  const [placeArmed, setPlaceArmed] = useState(false);
  // How long the score runs at its own tempo (honors per-measure tempo changes)
  // — i.e. how much waveform the placed section will occupy.
  const scoreSpanSeconds = useMemo(() => {
    const wps = buildWaypoints(score, score.initialTempo, 0);
    return wps.length ? wps[wps.length - 1].videoTimeSeconds : 0;
  }, [score]);
  // clock.currentSeconds is React state, so the ghost tracks scrubbing/playback.
  const ghostRange: TimeRange | null = placeArmed
    ? { startSeconds: clock.currentSeconds, endSeconds: clock.currentSeconds + scoreSpanSeconds }
    : null;
  const ghostConflict = ghostRange !== null && siblingRanges.some((r) => rangesOverlap(ghostRange, r));

  // --- Peaks decode ---
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [decodeState, setDecodeState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  // Detected hits + the live zoom, mirrored into refs so the drag callbacks
  // (read by the canvas/lane's pointer handlers, which never re-bind mid-drag)
  // always see the latest values without becoming a dep of those callbacks.
  // Assigned in an effect, not at render time: this repo's eslint (react-hooks
  // v7 / React Compiler rules) rejects a ref write during render.
  const hits = peaks?.hits ?? EMPTY_HITS;
  const hitsRef = useRef(hits);
  const ppsRef = useRef(pps);
  useLayoutEffect(() => {
    hitsRef.current = hits;
    ppsRef.current = pps;
  }, [hits, pps]);

  // --- Active timing autosave ---
  const [error, setError] = useState<string | null>(null);

  // Track the exact snapshot so edits arriving during a save remain pending.
  const markersRef = useRef(markers);
  const scoreRef = useRef(score);
  markersRef.current = markers;
  scoreRef.current = score;

  // Structural edits (insert / delete / paste / append / repeat) change the
  // score AND the markers together: the timing is computed here from the live
  // markers, registered for the resulting score object, and adopted by the
  // reconcile effect — the same channel the MIDI recorder uses, so undo/redo
  // keep restoring exact markers. Everything else passes straight through.
  const studioDispatch = useCallback<Dispatch<EditorAction>>((action) => {
    if (action.type === 'copy-measures') {
      const current = scoreRef.current;
      if (!current.tracks[action.trackIndex]) return;
      writeMeasureClipboard(clipFromMeasures(markersRef.current, current, action.trackIndex, action.start, action.count));
      return;
    }
    if (action.type === 'duplicate-measures') {
      const current = scoreRef.current;
      if (!current.tracks[action.trackIndex]) return;
      const clip = clipFromMeasures(markersRef.current, current, action.trackIndex, action.start, action.count);
      clip.measures = clip.measures.map((m) => stripCopyTags(JSON.parse(JSON.stringify(m))));
      studioDispatchRef.current({ type: 'paste-measures', trackIndex: action.trackIndex, index: action.start + action.count, clip });
      return;
    }
    if (!isStructuralAction(action)) {
      dispatch(action);
      return;
    }
    const current = scoreRef.current;
    const result = prepareStructuralEdit(markersRef.current, current, action);
    if (!result.ok) {
      setEditNotice(result.problem);
      return;
    }
    if (showSync) {
      const span = markerSpan(result.markers);
      const blocker = (sectionsContext?.sections ?? []).find(
        (sec) =>
          sec.sectionId !== sectionsContext?.activeSectionId &&
          sec.startSeconds != null &&
          sec.endSeconds != null &&
          rangesOverlap(span, { startSeconds: sec.startSeconds, endSeconds: sec.endSeconds })
      );
      if (blocker) {
        setEditNotice(`These measures would run into the section “${blocker.label}”. Move that section first.`);
        return;
      }
    }
    recordingMarkerHistory.current.set(result.score, result.markers);
    setSelected(null); // marker selection is keyed by measure number
    dispatch({ type: 'apply-structural-score', score: result.score, expectedScore: current });
  }, [dispatch, showSync, sectionsContext]);
  // studioDispatch calls itself (duplicate-measures re-enters as paste-measures);
  // useCallback would otherwise close over a stale version of itself, so the
  // recursive call goes through a ref that's always current.
  const studioDispatchRef = useRef(studioDispatch);
  studioDispatchRef.current = studioDispatch;
  // Every video sync target hands its timing to the host's draft (onTimingChange);
  // nothing reaches the live map until Publish.
  const timingAutosave = showSync;
  // Editing a failed snapshot allows autosave to try again.
  useEffect(() => { setError(null); }, [markers, score]);

  const timelineDuration = Math.max(
    peaks?.durationSeconds ?? 0,
    clock.durationSeconds,
    markers.tailVideoTimeSeconds,
    videoDurationSeconds ?? 0,
    1
  );

  const maxScroll = Math.max(0, timelineDuration * pps - viewportWidth);
  const clampScroll = useCallback(
    (v: number) => Math.max(0, Math.min(v, Math.max(0, timelineDuration * pps - viewportWidth))),
    [timelineDuration, pps, viewportWidth]
  );

  // Decode the video's audio ON DEMAND (only when the user clicks "Analyze
  // audio"). Cached in storage for next time. The grid + markers are fully
  // usable before analysis, so we don't pay the fetch/decode cost on entry.
  const analyzeCancelRef = useRef(false);
  // `force` skips the cache read (see loadOrComputePeaks).
  const runAnalysis = useCallback((opts?: { force?: boolean }) => {
    if (!videoUrl) return;
    analyzeCancelRef.current = false;
    setDecodeState('loading');
    setProgress(0);
    (async () => {
      try {
        const { loadOrComputePeaks } = await import('@/lib/playsense-studio/waveform-decode');
        const supabase = createClient();
        const result = await loadOrComputePeaks(classItemId, videoUrl, supabase, {
          force: opts?.force,
          onProgress: (f) => !analyzeCancelRef.current && setProgress(f),
        });
        if (!analyzeCancelRef.current) {
          setPeaks(result);
          setDecodeState('ready');
        }
      } catch {
        if (!analyzeCancelRef.current) setDecodeState('error');
      }
    })();
  }, [classItemId, videoUrl]);

  // The user's Analyze / Re-analyze. Peaks from before hits existed (the legacy
  // v2 cache) would just be read back from the cache, so decode afresh; that
  // writes the v3 cache, with hits. Never automatic on open: the entry effect
  // below only decodes on a full cache miss.
  const reanalyze = useCallback(() => {
    runAnalysis({ force: peaks !== null && peaks.hits === undefined });
  }, [runAnalysis, peaks]);

  // Cancel any in-flight decode on unmount.
  useEffect(() => () => { analyzeCancelRef.current = true; }, []);

  // On entry: restore a previously-cached waveform instantly (cheap fetch, no
  // decode). On a cache MISS, kick off the decode automatically so the first
  // visit doesn't require a click — the UI shows an "analyzing" overlay while it
  // runs, and the result is cached for next time.
  const triedCacheRef = useRef(false);
  useEffect(() => {
    if (triedCacheRef.current || !showSync) return;
    triedCacheRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { loadCachedPeaks } = await import('@/lib/playsense-studio/waveform-decode');
        const supabase = createClient();
        const cached = await loadCachedPeaks(classItemId, videoUrl, supabase);
        if (cancelled) return;
        if (cached) {
          setPeaks(cached);
          setDecodeState('ready');
        } else {
          runAnalysis(); // first time on this video — decode now
        }
      } catch {
        if (!cancelled) runAnalysis();
      }
    })();
    return () => { cancelled = true; };
  }, [classItemId, showSync, runAnalysis]);

  // Fit zoom once the viewport width + a duration are known.
  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current) return;
    if (viewportWidth > 0 && timelineDuration > 0) {
      didFitRef.current = true;
      setPps(clamp(viewportWidth / timelineDuration, MIN_PPS, MAX_PPS));
    }
  }, [viewportWidth, timelineDuration]);

  // Without the waveform (exercises + songs), the canvas isn't mounted to report
  // the viewport width — measure the editor area ourselves so fit-zoom + scrollbar work.
  useEffect(() => {
    if (showSync) return;
    const el = editorAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showSync]);

  // Auto-scroll so the playhead stays in view during playback.
  useEffect(() => {
    if (!clock.isPlaying || viewportWidth === 0) return;
    const x = clock.currentSeconds * pps - scrollLeft;
    if (x < viewportWidth * 0.1 || x > viewportWidth * 0.85) {
      setScrollLeft(clampScroll(clock.currentSeconds * pps - viewportWidth * 0.15));
    }
  }, [clock.currentSeconds, clock.isPlaying, pps, scrollLeft, viewportWidth, clampScroll]);

  // --- Derived draw data ---
  // Bars whose first note or tempo looks off the recording (spec §7). Empty
  // (no flags, no dots, Auto-place disabled) whenever there are no hits yet.
  const flags = useMemo(() => barFlags(markers, hits), [markers, hits]);

  const handles: MarkerHandle[] = useMemo(
    () =>
      orderedMarkers(markers)
        .filter((o) => o.ref !== null)
        .map((o) => ({
          measureNumber: o.ref!.measureNumber,
          beatInMeasure: o.ref!.beatInMeasure,
          isDownbeat: o.ref!.beatInMeasure === 1,
          videoTimeSeconds: o.videoTimeSeconds,
          flagged: flags.has(o.ref!.measureNumber) && o.ref!.beatInMeasure === 1,
        })),
    [markers, flags]
  );

  // --- Main-track trim -----------------------------------------------------
  // The usable region. Playback clamps to it; the canvas greys out the rest.
  // Waypoints are NOT rebased — they keep their absolute media positions.
  const effectiveTrim: MediaTrim = trim ?? { trimInSeconds: 0, trimOutSeconds: null };
  const trimmed = trim != null;
  const trimWindow = useMemo(
    () => trimRange(effectiveTrim, videoDurationSeconds ?? clock.durationSeconds ?? null),
    [effectiveTrim.trimInSeconds, effectiveTrim.trimOutSeconds, videoDurationSeconds, clock.durationSeconds]
  );

  /** Every seek entry point goes through here so trim can't be stepped over. */
  const seekClamped = useCallback(
    (seconds: number) => {
      clock.seek(
        trimmed
          ? clampToTrim(seconds, effectiveTrim, videoDurationSeconds ?? clock.durationSeconds ?? null)
          : seconds
      );
    },
    [clock, trimmed, effectiveTrim.trimInSeconds, effectiveTrim.trimOutSeconds, videoDurationSeconds, clock.durationSeconds]
  );

  // Stop at the out-point. currentSeconds is published at RAF rate while
  // playing, so this lands within a frame. Deliberately NOT in the transport
  // clock: that hook is shared with LessonVideoPlayer and the student player,
  // and a trim concept there would regress all three at once. (The A/B loop
  // machinery is also wrong for this — loops wrap, a trim stops.)
  useEffect(() => {
    if (!trimmed || !clock.isPlaying) return;
    if (!Number.isFinite(trimWindow.endSeconds)) return;
    if (clock.currentSeconds >= trimWindow.endSeconds) {
      clock.pause();
      clock.seek(trimWindow.endSeconds);
    }
  }, [trimmed, clock, clock.isPlaying, clock.currentSeconds, trimWindow.endSeconds]);

  // --- Auto-place bars (spec §7) --------------------------------------------
  // Fits one steady tempo to the detected hits, lays every bar on it, then lets
  // each bar settle onto the hit under its first note (autoPlaceBars, pure).
  // Tweens to the result over 300 ms (skipped under reduced motion) and keeps
  // the pre-placement markers around for a one-step undo. Timing still reaches
  // the draft only through the existing setMarkers + setDirty(true) path below.
  const [autoPlaceUndo, setAutoPlaceUndo] = useState<MarkerState | null>(null);
  const placedRef = useRef<MarkerState | null>(null);
  const [autoPlaceNotice, setAutoPlaceNotice] = useState<string | null>(null);
  // The tween writes plain values and yields to any other marker write (see
  // useMarkerTween). Called before the undo-retiring effect below, so a
  // foreign write has already stopped the tween when that effect looks.
  const { start: startTween, cancel: cancelTween, finish: finishTween, running: tweenRunning, active: tweenActive } = useMarkerTween({
    markers,
    setMarkers,
    onDone: () => setDirty(true),
  });

  // The undo chip is a one-step affordance: it retires as soon as the markers
  // change by anything OTHER than the placement landing (which sets markers to
  // the very object autoPlaceBars produced), and it must NOT retire mid-tween,
  // since every tween frame calls setMarkers with a freshly-lerped object.
  useEffect(() => {
    if (tweenRunning.current) return;
    if (autoPlaceUndo && markers !== placedRef.current) setAutoPlaceUndo(null);
  }, [markers, autoPlaceUndo, tweenRunning]);

  // The failure notice is transient: gone after 6 s, or sooner if anything else
  // moves the markers.
  useEffect(() => {
    if (!autoPlaceNotice) return;
    const id = setTimeout(() => setAutoPlaceNotice(null), 6000);
    return () => clearTimeout(id);
  }, [autoPlaceNotice]);
  useEffect(() => {
    setAutoPlaceNotice(null);
  }, [markers]);

  const runAutoPlace = useCallback(() => {
    // A tween is already animating toward a placement — ignore a second click
    // rather than racing it (undo would otherwise point at the wrong "before").
    if (tweenRunning.current) return;
    // The duration is 0 (not null) before the video's metadata loads, and
    // `videoDurationSeconds ?? clock.durationSeconds ?? …` wouldn't catch
    // that (0 isn't nullish) — trust a duration only once it's actually > 0,
    // so the window stays unbounded instead of collapsing to zero-width.
    const knownDuration =
      videoDurationSeconds && videoDurationSeconds > 0
        ? videoDurationSeconds
        : clock.durationSeconds > 0
          ? clock.durationSeconds
          : null;
    const trimBounds = trimRange(
      { trimInSeconds: effectiveTrim.trimInSeconds, trimOutSeconds: effectiveTrim.trimOutSeconds },
      knownDuration
    );
    // Never place a bar over a sibling section: narrow the trim window to the
    // free corridor around this section's OWN current span.
    const win = windowWithinCorridor(
      { start: trimBounds.startSeconds, end: trimBounds.endSeconds },
      markerSpan(markersRef.current),
      siblingRanges
    );
    const res = autoPlaceBars(markersRef.current, hits, win);
    if (!res) {
      setAutoPlaceNotice('Not enough clear hits to place the bars.');
      return;
    }
    const from = markersRef.current;
    setAutoPlaceUndo(from);
    placedRef.current = res.state;

    // Ends by writing res.state and setDirty(true) (onDone); reduced motion
    // jumps straight there.
    startTween(from, res.state);
  }, [hits, effectiveTrim.trimInSeconds, effectiveTrim.trimOutSeconds, videoDurationSeconds, clock, siblingRanges, startTween, tweenRunning]);

  const undoAutoPlace = useCallback(() => {
    if (!autoPlaceUndo) return;
    cancelTween();
    setMarkers(autoPlaceUndo);
    setDirty(true);
    setAutoPlaceUndo(null);
  }, [autoPlaceUndo, cancelTween]);

  // Timing-only per-measure slots — the editor zips these with extractTrackEvents
  // for the ACTIVE track inside IntegratedEditor (so track-switching doesn't churn SyncPanel).
  // Value-stable: beat and nudge drags change markers but no bar's start or end,
  // so the previous array is reused and the strip's staff doesn't redraw.
  const measureTimingsRef = useRef<IntegratedEditorMeasureTiming[] | null>(null);
  const measureTimings: IntegratedEditorMeasureTiming[] = useMemo(() => {
    const fresh = markers.measures.map((m, i) => {
      const next = markers.measures[i + 1];
      const endVideoTimeSeconds = next ? next.beats[0].videoTimeSeconds : markers.tailVideoTimeSeconds;
      const flag = flags.get(m.measureNumber);
      return {
        measureNumber: m.measureNumber,
        startVideoTimeSeconds: m.beats[0].videoTimeSeconds,
        endVideoTimeSeconds,
        flag: flag ? flagText(flag) : null,
      };
    });
    const stable = stableTimings(measureTimingsRef.current, fresh);
    measureTimingsRef.current = stable;
    return stable;
  }, [markers, flags]);

  const recordingSource = useMemo<MidiRecordingSource>(() => ({
    videoUrl, videoRef, onPosition: clock.seek,
    waypoints: markerStateToWaypoints(markers, { includeBeats: 'edited-beats' }),
    onInsert: (next, waypoints, expected) => {
      if (scoreRef.current !== expected) throw new Error('The score changed. Reopen the recorder before adding this take.');
      const nextMarkers = seedMarkerState(next.tracks[0], next, waypoints, nudgeList(markersRef.current));
      if (showSync && siblingRanges.some(range => rangesOverlap(markerSpan(nextMarkers), range))) {
        throw new Error('This take overlaps another scored section. Record a shorter take or move that section first.');
      }
      recordingMarkerHistory.current.set(next, nextMarkers);
      dispatch({ type: 'apply-midi-score', score: next, expectedScore: expected });
    },
  }), [videoUrl, clock.seek, markers, showSync, siblingRanges, dispatch]);

  // Note onsets (video seconds, all tracks) at their EFFECTIVE time — the
  // anchor grid plus any per-note nudge — for the waveform ticks.
  const ticks = useMemo(() => noteTicks(markers), [markers]);

  // The selected note's onset (null for rests). Mirrored into a ref so the
  // canvas drag callback keeps a stable identity.
  const selectedOnset = useMemo(
    () => (selection ? onsetForSelection(score, selection.trackIndex, selection.ref) : null),
    [score, selection]
  );
  const selectedOnsetRef = useRef(selectedOnset);
  selectedOnsetRef.current = selectedOnset;
  const selectedNoteTime = selectedOnset ? noteTime(markers, selectedOnset.qn) : null;
  const selectedNoteDelta = selectedOnset ? nudgeDelta(markers, selectedOnset.qn) : 0;
  // Stable identity: the canvas repaints its wave layer when this changes, and
  // SyncPanel re-renders at frame rate during playback.
  const selectedNoteHandle = useMemo(
    () => (selectedNoteTime === null ? null : { videoTimeSeconds: selectedNoteTime }),
    [selectedNoteTime]
  );

  const handleNoteDrag = useCallback((videoTimeSeconds: number) => {
    const onset = selectedOnsetRef.current;
    if (!onset) return;
    setMarkers((s) => setNoteTime(s, onset.qn, videoTimeSeconds));
    setDirty(true);
  }, []);

  const nudgeSelected = useCallback((deltaMs: number) => {
    const onset = selectedOnsetRef.current;
    if (!onset) return;
    setMarkers((s) => setNoteDelta(s, onset.qn, nudgeDelta(s, onset.qn) + deltaMs / 1000));
    setDirty(true);
  }, []);

  const snapSelectedToPlayhead = useCallback(() => {
    const onset = selectedOnsetRef.current;
    if (!onset) return;
    const at = clock.getCurrentSeconds();
    setMarkers((s) => setNoteTime(s, onset.qn, at));
    setDirty(true);
  }, [clock]);

  const resetSelected = useCallback(() => {
    const onset = selectedOnsetRef.current;
    if (!onset) return;
    setMarkers((s) => clearNudge(s, onset.qn));
    setDirty(true);
  }, []);

  // The selected note's timing (video-synced lessons only) — one object
  // shared by the inspector's NoteDetails and the zoom's More ▾ → Timing tab.
  const noteTiming: NoteTimingProps | undefined = useMemo(
    () =>
      showSync && selectedOnset
        ? {
            offsetMs: selectedNoteDelta * 1000,
            gridSeconds: gridTime(markers, selectedOnset.qn),
            actualSeconds: selectedNoteTime ?? 0,
            onNudge: nudgeSelected,
            onSnap: snapSelectedToPlayhead,
            onReset: resetSelected,
          }
        : undefined,
    [showSync, selectedOnset, selectedNoteDelta, markers, selectedNoteTime, nudgeSelected, snapSelectedToPlayhead, resetSelected]
  );

  // `[` / `]` nudge the selected note by 5 ms (Shift: 20 ms). Unused by the
  // notation editor's own key map.
  const nudgeKeysActive = showSync && selectedOnset !== null;
  useEffect(() => {
    if (!nudgeKeysActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key !== '[' && e.key !== ']' && e.key !== '{' && e.key !== '}') return;
      e.preventDefault();
      const step = e.shiftKey ? 20 : 5;
      nudgeSelected(e.key === '[' || e.key === '{' ? -step : step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeKeysActive, nudgeSelected]);

  // --- Marker interaction handlers ---
  // Both drags clamp against the sibling-section corridor so a section can
  // never be dragged into a neighbor's video range.
  const handleMarkerDrag = useCallback((ref: MarkerRef, videoTimeSeconds: number, mode: DragMode, mods?: { snap: boolean }) => {
    setMarkers((s) => {
      // Snap first, then run every existing clamp below on the snapped value —
      // a snap must never itself break the corridor or neighbour clamps.
      let proposed = videoTimeSeconds;
      if (mods?.snap !== false && hitsRef.current.length) {
        const mi = s.measures.findIndex((m) => m.measureNumber === ref.measureNumber);
        const barStart = mi >= 0 ? s.measures[mi].beats[0].videoTimeSeconds : null;
        // Only downbeats snap to their first attacked note; an expanded beat
        // handle snaps only to its own bar line.
        const first = ref.beatInMeasure === 1 && mi >= 0 ? firstAttackTime(s, mi) : null;
        const offset = first !== null && barStart !== null ? first - barStart : null;
        proposed = snapBarTime(videoTimeSeconds, offset, hitsRef.current, SNAP_PX / ppsRef.current).time;
      }
      const { lo, hi } = corridorRef.current;
      if (mode === 'all-after') {
        const current = findBeatTime(s, ref);
        if (current === null) return s;
        const span = markerSpan(s);
        let delta = proposed - current;
        delta = Math.min(delta, hi - EPS - span.endSeconds); // right wall via the tail
        delta = Math.max(delta, lo + EPS - span.startSeconds); // left wall via the first downbeat
        return shiftMarkersFrom(s, ref, delta);
      }
      // Single drags only reach a wall at the span's edges; interior markers are
      // already clamped against their neighbors inside setMarkerTime.
      const clamped = Math.min(Math.max(proposed, lo + EPS), hi - EPS);
      return setMarkerTime(s, ref, clamped);
    });
    setDirty(true);
  }, []);

  const handleTailDrag = useCallback((videoTimeSeconds: number) => {
    setMarkers((s) => setTailTime(s, Math.min(videoTimeSeconds, corridorRef.current.hi - EPS)));
    setDirty(true);
  }, []);

  // Dragging the whole active section along the video (the sections lane).
  // The corridor is captured once, at drag start, next to the base markers —
  // not read live from corridorRef — so a sibling's range can't shift under
  // the drag mid-gesture (the live corridor moves as `markers` itself moves).
  const sectionDragBase = useRef<{ base: MarkerState; corridor: { lo: number; hi: number } } | null>(null);
  const onSectionDrag = useCallback((delta: number, phase: 'move' | 'end', mods?: { snap: boolean }) => {
    if (!sectionDragBase.current) {
      const base = markersRef.current;
      sectionDragBase.current = { base, corridor: freeCorridor(markerSpan(base), siblingRanges) };
    }
    const { base, corridor } = sectionDragBase.current;
    const first = base.measures[0];
    if (first) {
      // Snap first (the section's first attacked note onto a hit), then run
      // the existing corridor/duration clamp on the snapped delta.
      let d = delta;
      if (mods?.snap !== false && hitsRef.current.length) {
        const idx = base.measures.findIndex((m) => m.onsetQNs.length > 0);
        const firstNote = idx >= 0 ? firstAttackTime(base, idx) : base.measures[0].beats[0].videoTimeSeconds;
        if (firstNote !== null) d = snapSectionShift(firstNote, delta, hitsRef.current, SNAP_PX / ppsRef.current);
      }
      const shift = clampSectionShift(markerSpan(base), corridor, videoDurationSeconds ?? null, d);
      setMarkers(shiftMarkersFrom(base, { measureNumber: first.measureNumber, beatInMeasure: 1 }, shift));
    }
    if (phase === 'end') {
      sectionDragBase.current = null;
      setDirty(true);
    }
  }, [videoDurationSeconds, siblingRanges]);

  const handleSelect = useCallback((target: DragTarget) => {
    // Explicit per-kind: an unhandled kind used to fall through to
    // `target.ref` and set `selected` to undefined.
    if (target.kind === 'marker') setSelected(target.ref);
    else if (target.kind === 'tail') setSelected('tail');
    // A note handle keeps the staff selection that created it; trim grips are
    // not part of the marker selection model.
  }, []);

  const handleScrollByPx = useCallback(
    (dx: number) => setScrollLeft((s) => clampScroll(s + dx)),
    [clampScroll]
  );

  // Confirm a placement: lay the score's measures from the playhead, spaced at
  // the score's own tempo (the single tempo source). The admin then drags to align.
  const confirmPlacement = useCallback(() => {
    if (ghostConflict) return;
    if (
      dirty &&
      !window.confirm('Placing re-lays the measures from the playhead and replaces your dragged positions. Continue?')
    ) {
      return;
    }
    setMarkers(seedMarkerState(track, score, buildWaypoints(score, score.initialTempo, clock.getCurrentSeconds())));
    setDirty(true);
    setSelected(null);
    setPlaceArmed(false);
  }, [track, score, dirty, ghostConflict, clock]);

  // Per-beat handles follow the selection: selecting a measure (or one of its
  // beats) reveals that measure's beat markers; everything else stays collapsed.
  // Edited beats are anchors regardless of visibility, so nothing is lost.
  useEffect(() => {
    const num = selected && selected !== 'tail' ? selected.measureNumber : null;
    setMarkers((s) => {
      if (s.measures.every((m) => m.expanded === (m.measureNumber === num))) return s;
      return {
        ...s,
        measures: s.measures.map((m) => ({ ...m, expanded: m.measureNumber === num })),
      };
    });
  }, [selected]);

  // A/B loop over bars start..end (from the first bar's downbeat to the next
  // bar's, or the tail). Asking for the range already looping clears it.
  const { loopEnabled, loopA, loopB, loadLoop, clearLoop } = clock;
  const loopMeasures = useCallback((start: number, end: number) => {
    const a = markers.measures[start]?.beats[0]?.videoTimeSeconds;
    const b = markers.measures[end + 1]?.beats[0]?.videoTimeSeconds ?? markers.tailVideoTimeSeconds;
    if (a === undefined || b <= a) return;
    if (loopEnabled && loopA !== null && Math.abs(loopA - a) < 1e-3 && loopB !== null && Math.abs(loopB - b) < 1e-3) clearLoop();
    else loadLoop(a, b);
  }, [markers, loopEnabled, loopA, loopB, loadLoop, clearLoop]);
  // Which bars the current loop covers: the bar whose downbeat is A through the
  // bar that ends at B. Null when no loop runs or it doesn't sit on bar lines.
  const loopedRange = useMemo<[number, number] | null>(() => {
    if (!loopEnabled || loopA === null || loopB === null) return null;
    const near = (x: number, y: number) => Math.abs(x - y) < 1e-3;
    const start = markers.measures.findIndex((m) => { const t = m.beats[0]?.videoTimeSeconds; return t !== undefined && near(t, loopA); });
    if (start === -1) return null;
    for (let i = start; i < markers.measures.length; i++) {
      const end = markers.measures[i + 1]?.beats[0]?.videoTimeSeconds ?? markers.tailVideoTimeSeconds;
      if (near(end, loopB)) return [start, i];
    }
    return null;
  }, [markers, loopEnabled, loopA, loopB]);
  const loopSelectedMeasure = () => {
    if (!selected || selected === 'tail') return;
    const i = markers.measures.findIndex((m) => m.measureNumber === selected.measureNumber);
    if (i !== -1) loopMeasures(i, i);
  };

  const zoomBy = (factor: number, anchorPx = viewportWidth / 2) => {
    setPps((p) => {
      const nextPps = clamp(p * factor, MIN_PPS, MAX_PPS);
      const centerTime = (scrollLeft + anchorPx) / p;
      setScrollLeft(clamp(centerTime * nextPps - anchorPx, 0, Math.max(0, timelineDuration * nextPps - viewportWidth)));
      return nextPps;
    });
  };

  const fitZoom = () => {
    if (viewportWidth === 0 || timelineDuration === 0) return;
    setPps(clamp(viewportWidth / timelineDuration, MIN_PPS, MAX_PPS));
    setScrollLeft(0);
  };

  // Set an absolute zoom (used by the drag slider), keeping the timeline centered.
  const zoomTo = (nextPps: number) => {
    setPps((p) => {
      const np = clamp(nextPps, MIN_PPS, MAX_PPS);
      const centerTime = (scrollLeft + viewportWidth / 2) / p;
      setScrollLeft(Math.max(0, centerTime * np - viewportWidth / 2));
      return np;
    });
  };

  const timelineView: TimelineView = {
    videoRef,
    usableRegion: trimWindow,
    pixelsPerSecond: pps,
    scrollLeftPx: scrollLeft,
    timelineDurationSeconds: timelineDuration,
    viewportWidth,
    snapTimes: handles.filter((h) => h.isDownbeat).map((h) => h.videoTimeSeconds),
    getCurrentSeconds: clock.getCurrentSeconds,
    isPlaying: clock.isPlaying,
    playbackRate: clock.playbackRate,
    onScrollByPx: handleScrollByPx,
    onZoomBy: zoomBy,
  };

  // --- Metronome anchor state ----------------------------------------------
  // Declared ahead of saveTiming (below), which folds a pending anchor edit
  // into the same patch handed to the draft — see anchorTimingPatch.
  //
  // One beat of the recording. With the section's notated tempo it defines the
  // student click's phase, so the click lands on the performance instead of on
  // whenever the student pressed play.
  const [metronomeAnchor, setMetronomeAnchor] = useState<number | null>(
    initialMetronomeAnchorSeconds ?? null
  );
  const anchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef(metronomeAnchor);
  anchorRef.current = metronomeAnchor;

  /** The pending anchor as a timing patch, computed from the LIVE markers
   *  (what the admin is looking at) rather than the last-saved map. */
  const anchorTimingPatch = useCallback((): Pick<StudioTiming, 'anchor'> => {
    const seconds = anchorRef.current;
    if (seconds == null) return { anchor: null };
    const qn = secondsToQn(
      markerStateToWaypoints(markersRef.current, { includeBeats: 'edited-beats' }).map((w) => ({
        musicalPositionQN: w.musicalPositionQN,
        videoTimeSeconds: w.videoTimeSeconds,
      })),
      seconds
    );
    return { anchor: { seconds, qn } };
  }, []);

  // Hand the live timing (and any pending anchor move) to the host's draft —
  // this panel never writes it live. Publish, elsewhere in the Studio, is what
  // eventually makes it visible to students.
  // `snapshot` hands off an explicit state instead of this render's `markers`:
  // a flush that just finished the Auto-place tween (finishLandingTween) has
  // the final placement before React has re-rendered with it.
  const saveTiming = useCallback((opts?: { silent?: boolean; snapshot?: MarkerState }) => {
    if (!timingAutosave) return;
    const snapshot = opts?.snapshot ?? markers;
    const patch = timingPatchFromMarkers(snapshot, { pps, peaksCached: decodeState === 'ready' });
    if (!patch) {
      if (!opts?.silent) setError('Add a measure before saving its timing.');
      return;
    }
    // Structure changed since the anchor was last saved: re-derive its qn from
    // the markers being handed off so a later rebase keeps its second.
    const anchorPatch = anchorRefreshRef.current ? anchorTimingPatch() : null;
    anchorRefreshRef.current = false;
    onTimingChange({ ...patch, ...(anchorPatch ?? {}) });
    if (opts?.silent) return;
    if (markersRef.current === snapshot) {
      setDirty(false);
      onTimingSaved?.();
    }
  }, [timingAutosave, markers, pps, decodeState, onTimingChange, onTimingSaved, anchorTimingPatch]);

  // The pending debounce's timer id, so a registered pre-flush (below) can
  // cancel it and hand the timing off immediately instead of racing it.
  const timingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!timingAutosave || !dirty || placeArmed || error) return;
    const id = setTimeout(() => { timingTimerRef.current = null; saveTiming(); }, TIMING_DEBOUNCE_MS);
    timingTimerRef.current = id;
    return () => {
      clearTimeout(id);
      timingTimerRef.current = null;
    };
  }, [timingAutosave, dirty, placeArmed, error, saveTiming]);

  // Best-effort flush when switching sections; browser shutdown may interrupt it.
  const saveTimingRef = useRef(saveTiming);
  useEffect(() => {
    saveTimingRef.current = saveTiming;
  });
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  const placeArmedRef = useRef(placeArmed);
  useEffect(() => {
    placeArmedRef.current = placeArmed;
  });
  // A flush mustn't hand off a half-drawn Auto-place frame: land the tween on
  // its final placement first. It counts as an edit (dirty), and the refs are
  // brought up to date by hand because React hasn't re-rendered yet. Returns
  // the placement to hand off, or undefined when no tween was running.
  const finishLandingTween = useCallback((): MarkerState | undefined => {
    const landed = finishTween();
    if (!landed) return undefined;
    markersRef.current = landed;
    dirtyRef.current = true;
    return landed;
  }, [finishTween]);
  useEffect(() => {
    return () => {
      const landed = finishLandingTween();
      if (dirtyRef.current) saveTimingRef.current({ silent: true, snapshot: landed });
    };
  }, [finishLandingTween]);

  const seededAnchorSeconds = markers.measures[0]?.beats[0]?.videoTimeSeconds ?? 0;

  // --- Metronome anchor ----------------------------------------------------
  // Who owns the anchor on this stage. A scored section has its own row; an
  // EXERCISE reaches this panel with no sectionId, so its anchor lives on the
  // class item. Everything below gates on this rather than on sectionId, which
  // is what kept the whole feature invisible to exercises.
  const anchorOwner = useMemo<{ kind: 'section' | 'classItem'; id: string } | null>(
    () =>
      sectionId
        ? { kind: 'section', id: sectionId }
        : publishTarget === 'exercise'
          ? { kind: 'classItem', id: classItemId }
          : null,
    [sectionId, publishTarget, classItemId]
  );

  const persistAnchor = useCallback(() => {
    if (!anchorOwner) return;
    onTimingChange(anchorTimingPatch());
  }, [anchorOwner, onTimingChange, anchorTimingPatch]);

  const scheduleAnchorSave = useCallback(() => {
    if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    anchorTimerRef.current = setTimeout(() => { anchorTimerRef.current = null; persistAnchor(); }, 500);
  }, [persistAnchor]);

  const handleAnchorDrag = useCallback(
    (videoTimeSeconds: number) => {
      setMetronomeAnchor(Math.max(0, videoTimeSeconds));
      scheduleAnchorSave();
    },
    [scheduleAnchorSave]
  );

  const setAnchorAtPlayhead = useCallback(() => {
    setMetronomeAnchor(Math.max(0, clock.getCurrentSeconds()));
    scheduleAnchorSave();
  }, [clock, scheduleAnchorSave]);

  // Flush a pending anchor if the section unmounts mid-edit.
  const persistAnchorRef = useRef(persistAnchor);
  persistAnchorRef.current = persistAnchor;
  useEffect(
    () => () => {
      if (anchorTimerRef.current) {
        clearTimeout(anchorTimerRef.current);
        persistAnchorRef.current();
      }
    },
    []
  );

  // Let the host's draft (registerTimingFlush = draft.registerPreFlush) pull
  // in a still-debounced drag or anchor edit right before it snapshots and
  // saves — e.g. so pressing Publish right after a drag publishes that drag
  // instead of racing its 1.5 s / 500 ms timers. Refs throughout so this
  // closure, registered once, always acts on the latest state.
  useEffect(() => {
    if (!registerTimingFlush) return;
    return registerTimingFlush(() => {
      if (timingTimerRef.current) {
        clearTimeout(timingTimerRef.current);
        timingTimerRef.current = null;
      }
      const landed = finishLandingTween();
      if (dirtyRef.current && !placeArmedRef.current) {
        saveTimingRef.current({ snapshot: landed });
      }
      if (anchorTimerRef.current) {
        clearTimeout(anchorTimerRef.current);
        anchorTimerRef.current = null;
        persistAnchorRef.current();
      }
    });
  }, [registerTimingFlush, finishLandingTween]);

  /** What the click actually uses — the stored anchor, else the score's start. */
  const anchorSeconds = metronomeAnchor ?? seededAnchorSeconds;

  // --- Studio click --------------------------------------------------------
  // The transport has always rendered a "Click track" button here, but nothing
  // was ever wired to it — the engine only existed in the student player. So an
  // admin could not hear what they were aligning the anchor to, which is the
  // one thing this stage is for.
  //
  // The grid is built from the LIVE markers rather than the seeded map, so
  // dragging a marker or the anchor is audible immediately.
  const [clickOn, setClickOn] = useState(false);
  const [clickVolume, setClickVolume] = useState(readStoredClickVolume);

  // The reference video's own audio. It used to play at full system volume with
  // no way to touch it, while the student's copy of the same video is hard-muted
  // — so the admin was balancing backing tracks and a click against an
  // uncontrollable voice. Per-viewer, since it is a monitoring preference.
  const [videoMuted, setVideoMuted] = useState(() => readStoredFlag(VIDEO_MUTED_KEY, false));
  const [videoVolume, setVideoVolume] = useState(() => readStoredLevel(VIDEO_VOLUME_KEY, 1));
  const handleVideoMutedChange = useCallback((muted: boolean) => {
    setVideoMuted(muted);
    writeStoredValue(VIDEO_MUTED_KEY, muted ? '1' : '0');
  }, []);
  const handleVideoVolumeChange = useCallback((volume: number) => {
    setVideoVolume(volume);
    writeStoredValue(VIDEO_VOLUME_KEY, String(volume));
    // Nudging the slider off zero is an unmute; otherwise you'd drag and hear
    // nothing and assume it was broken.
    if (volume > 0 && videoMuted) handleVideoMutedChange(false);
  }, [videoMuted, handleVideoMutedChange]);

  // The element is portalled, so set the property rather than relying on a prop
  // surviving the move.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = videoMuted;
    video.volume = videoVolume;
  }, [videoMuted, videoVolume, videoUrl]);
  const handleClickVolumeChange = useCallback((v: number) => {
    setClickVolume(v);
    writeStoredClickVolume(v);
  }, []);

  const liveSpan = markerSpan(markers);
  const clickGrid = useMemo(
    () =>
      beatGridFromAnchor(
        anchorSeconds,
        score.initialTempo,
        liveSpan.startSeconds,
        liveSpan.endSeconds
      ),
    [anchorSeconds, score.initialTempo, liveSpan.startSeconds, liveSpan.endSeconds]
  );

  useVideoClickTrack({
    videoRef,
    grid: showSync ? clickGrid : [],
    enabled: clickOn && showSync,
    volume: clickVolume,
  });

  // A single anchor plus a constant tempo cannot follow a performance that
  // pauses or changes tempo. The published spacing already tells us when that
  // is the case, so say so rather than shipping a confidently wrong click.
  const mapImpliedBpm = useMemo(() => {
    // Measured across the WHOLE section, not the first two bars: one sloppily
    // dragged marker near the start shouldn't change the verdict.
    const first = markers.measures[0];
    if (!first) return null;
    const qnSpan = markers.tailQN - first.downbeatQN;
    const secSpan = markers.tailVideoTimeSeconds - first.beats[0].videoTimeSeconds;
    if (!(qnSpan > 0) || !(secSpan > 0)) return null;
    return (60 * qnSpan) / secSpan;
  }, [markers]);
  const tempoDisagrees =
    mapImpliedBpm != null &&
    Math.abs(mapImpliedBpm - score.initialTempo) / score.initialTempo > 0.03;

  if (!track) {
    return <p className="text-sm text-muted-foreground">This score has no tracks to edit.</p>;
  }

  // While the first-time decode runs, lock the panel behind a loader so it's
  // clear the page is analyzing (and nothing is half-interactive).
  const analyzing = decodeState === 'loading';

  // Resolve the mirrored note selection into a concrete event for the inspector.
  const selTrack = selection ? score.tracks[selection.trackIndex] : null;
  const selEvent =
    selection && selTrack
      ? selTrack.measures[selection.ref.measureIndex]?.voices[0]?.events[selection.ref.eventIndex] ?? null
      : null;



  return (
    <>
      {/* ============ CENTER: context bar + unified stage ============ */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {/* Context bar — placement · drag mode · loop/analyze (sync only) */}
        {showSync && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-sm">
            <PlaceScoreControl
              armed={placeArmed}
              conflict={ghostConflict}
              spanLabel={ghostRange ? `${formatTime(ghostRange.startSeconds)} – ${formatTime(ghostRange.endSeconds)}` : null}
              onArm={() => setPlaceArmed(true)}
              onConfirm={confirmPlacement}
              onCancel={() => setPlaceArmed(false)}
            />

            {/* The anchor can't conflict with anything, so unlike placement it
                needs no arm/confirm step — one click sets it at the playhead. */}
            {anchorOwner && (
              <button
                type="button"
                onClick={setAnchorAtPlayhead}
                className="st-chip"
                title="Mark this moment as a beat, so the student's click locks to the recording"
              >
                <AudioLines className="h-4 w-4" />
                <span className="hidden lg:inline">Anchor at playhead</span>
              </button>
            )}

            <button
              type="button"
              onClick={runAutoPlace}
              disabled={!hits.length || tweenActive}
              className="st-chip"
              title={
                hits.length
                  ? 'Fit the bars to the recording — place the first bar near its note first'
                  : 'Re-analyze audio to find the hits'
              }
            >
              <Wand2 className="h-4 w-4" />
              <span className="hidden lg:inline">Auto-place bars</span>
            </button>
            {autoPlaceUndo && (
              <button type="button" onClick={undoAutoPlace} className="st-chip" title="Put the bars back where they were">
                <Undo2 className="h-4 w-4" />
                Undo auto-place
              </button>
            )}
            {autoPlaceNotice && (
              <span className="text-xs text-muted-foreground" role="status">
                {autoPlaceNotice}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {decodeState === 'loading' && (
                <span className="text-xs text-muted-foreground">
                  {progress >= 1 ? 'Processing audio…' : `Downloading audio… ${progress > 0 ? `${Math.round(progress * 100)}%` : ''}`}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className={`st-iconbtn${showNotes ? ' text-primary' : ''}`}
                title={showNotes ? 'Hide note overlay on the waveform' : 'Show note overlay on the waveform'}
                aria-pressed={showNotes}
              >
                <Music2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={loopSelectedMeasure}
                disabled={!selected || selected === 'tail'}
                className="st-iconbtn"
                title="Loop the selected measure"
              >
                <Repeat className="h-4 w-4" />
              </button>
              {decodeState !== 'loading' && (
                <button
                  type="button"
                  onClick={reanalyze}
                  className="st-chip"
                  title={
                    decodeState === 'idle'
                      ? 'Analyze audio — decode this video so the waveform appears'
                      : decodeState === 'error'
                        ? 'Retry audio analysis'
                        : 'Re-analyze audio'
                  }
                >
                  <AudioLines className="h-4 w-4" />
                  {decodeState === 'idle'
                    ? 'Analyze audio'
                    : decodeState === 'error'
                      ? 'Retry analysis'
                      : 'Re-analyze'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* The unified stage — waveform lane + notation lane share one grid */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className={`st-stage flex-1${analyzing ? ' pointer-events-none select-none opacity-50' : ''}`} aria-busy={analyzing}>
            {/* Timeline track — measured for the no-waveform width fallback */}
            <div className="st-stage-track" ref={editorAreaRef}>
              {showSync && (
                <div className="st-wave-lane relative flex-shrink-0">
                  <WaveformCanvas
                    bare
                    height={waveH}
                    peaks={peaks}
                    durationSeconds={timelineDuration}
                    handles={handles}
                    noteTicks={ticks}
                    showNotes={showNotes}
                    selectedNote={selectedNoteHandle}
                    onNoteDrag={handleNoteDrag}
                    tailVideoTimeSeconds={markers.tailVideoTimeSeconds}
                    pixelsPerSecond={pps}
                    scrollLeftPx={scrollLeft}
                    dragAll={dragAll}
                    selected={selected}
                    getCurrentSeconds={clock.getCurrentSeconds}
                    onSeek={seekClamped}
                    trimInSeconds={trim?.trimInSeconds}
                    trimOutSeconds={trim?.trimOutSeconds ?? null}
                    mediaDurationSeconds={videoDurationSeconds ?? clock.durationSeconds}
                    onTrimDrag={onTrimDrag}
                    metronomeAnchorSeconds={anchorOwner ? anchorSeconds : undefined}
                    onAnchorDrag={anchorOwner ? handleAnchorDrag : undefined}
                    onSelect={handleSelect}
                    onMarkerDrag={handleMarkerDrag}
                    onTailDrag={handleTailDrag}
                    onDragEnd={() => setMarkers((s) => reinterpolateUnedited(s))}
                    onScrollByPx={handleScrollByPx}
                    onViewportWidth={setViewportWidth}
                    onZoomBy={zoomBy}
                  />

                  {/* No-waveform / error state, shown right over the lane so it's
                      visible even when the left-rail inspector is hidden. */}
                  {decodeState !== 'loading' && (!peaks || decodeState === 'error') && (
                    <div className="st-wave-empty" style={{ height: waveH }}>
                      <p className="st-wave-empty-text">
                        {decodeState === 'error'
                          ? "Couldn't read this video's audio."
                          : 'No waveform yet.'}
                      </p>
                      <button type="button" onClick={reanalyze} className="st-btn-primary">
                        <AudioLines className="h-4 w-4" />
                        {decodeState === 'error' ? 'Retry analysis' : 'Analyze audio'}
                      </button>
                    </div>
                  )}

                  {sectionsContext && (
                    <SectionsLane
                      sections={sectionsContext.sections}
                      activeSectionId={sectionsContext.activeSectionId}
                      activeRange={markerSpan(markers)}
                      ghostRange={ghostRange}
                      ghostConflict={ghostConflict}
                      pixelsPerSecond={pps}
                      scrollLeftPx={scrollLeft}
                      onSelectSection={sectionsContext.onSelectSection}
                      onDragActive={onSectionDrag}
                    />
                  )}

                  {/* Backing-track lanes share the waveform's x-space. */}
                  {renderBackingLanes?.(timelineView)}

                  {/* Ghost of the armed placement, across the waveform + lane. */}
                  {ghostRange && (
                    <div
                      className={`st-ghost-overlay${ghostConflict ? ' is-conflict' : ''}`}
                      style={{
                        left: ghostRange.startSeconds * pps - scrollLeft,
                        width: Math.max((ghostRange.endSeconds - ghostRange.startSeconds) * pps, 2),
                      }}
                    />
                  )}

                  {/* Zoom and the marker drag mode float over the waveform — they
                      act on THIS lane (its number chips use dragAll). */}
                  <div className="st-zoom-float">
                    <div className="st-seg" role="radiogroup" aria-label="Drag mode">
                      <button
                        type="button"
                        className={dragAll ? 'is-on' : ''}
                        onClick={() => setDragAll(true)}
                        title="Ripple — dragging a measure moves it and everything after it (hold Option to move just one)"
                      >
                        <ChevronsLeftRight className="h-3.5 w-3.5" />
                        Ripple
                      </button>
                      <button
                        type="button"
                        className={!dragAll ? 'is-on' : ''}
                        onClick={() => setDragAll(false)}
                        title="Single — dragging moves only that measure or marker (hold Option to ripple)"
                      >
                        <Move className="h-3.5 w-3.5" />
                        Single
                      </button>
                    </div>
                    <ZoomSlider pps={pps} onZoomTo={zoomTo} onZoomBy={zoomBy} onFit={fitZoom} />
                  </div>
                </div>
              )}

              {showSync && <StageSplitter height={waveH} onChange={changeWaveH} />}

              {/* No horizontal padding here — the staff strip must share x=0
                  with the waveform canvas above so the measure grid stays aligned. */}
              <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3${showSync ? ' border-t border-border' : ''}`}>
                <IntegratedEditor
                  score={score}
                  dispatch={studioDispatch}
                  notice={editNotice}
                  measureTimings={measureTimings}
                  getCurrentSeconds={clock.getCurrentSeconds}
                  recordingSource={recordingSource}
                  pixelsPerSecond={pps}
                  scrollLeftPx={scrollLeft}
                  viewportWidth={viewportWidth}
                  onRequestZoom={(nextPps, nextScroll) => {
                    const zoom = clamp(nextPps, MIN_PPS, MAX_PPS);
                    setPps(zoom);
                    setScrollLeft(clamp(nextScroll, 0, Math.max(0, timelineDuration * zoom - viewportWidth)));
                  }}
                  onSelectionChange={handleSelectionChange}
                  onScrollByPx={handleScrollByPx}
                  onLoopMeasures={showSync ? loopMeasures : undefined}
                  loopedRange={showSync ? loopedRange : null}
                  noteTiming={noteTiming}
                />
              </div>

              {/* Stage bottom bar — the timeline scrollbar (zoom floats on the
                  waveform; without one, songs/exercises keep it down here). */}
              <div className="st-stage-bottombar">
                <div className="min-w-0 flex-1">
                  <ScrollBar
                    scrollLeft={scrollLeft}
                    maxScroll={maxScroll}
                    viewportWidth={viewportWidth}
                    contentWidth={timelineDuration * pps}
                    onScroll={(v) => setScrollLeft(clampScroll(v))}
                  />
                </div>
                {!showSync && <ZoomSlider pps={pps} onZoomTo={zoomTo} onZoomBy={zoomBy} onFit={fitZoom} />}
              </div>
            </div>
          </div>

          {analyzing && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-background/75 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {progress >= 1 ? 'Processing audio…' : `Downloading audio…${progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}`}
              </p>
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Decoding this video’s audio so the waveform lines up with the score. This happens once —
                the result is cached for next time.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ============ MONITOR (portal): dedicated slot, else with the inspector ============ */}
      {showSync &&
        monitorEl &&
        createPortal(
          <ReferenceMonitor videoRef={videoRef} videoUrl={videoUrl} bare />,
          monitorEl,
        )}

      {/* ============ APP BAR (portal): "Add score" appends an import through the structural path ============ */}
      {scoreActionsEl &&
        createPortal(
          <ScoreImportDialog
            classItemId={classItemId}
            mode="append"
            onConfirm={async (imported) => {
              studioDispatch({ type: 'append-score', score: imported });
              return {};
            }}
            onImported={() => {}}
            trigger={
              <button type="button" className="st-chip" title="Add measures from another file after the last measure">
                <FilePlus2 className="h-4 w-4" />
                <span className="hidden lg:inline">Add score</span>
              </button>
            }
          />,
          scoreActionsEl,
        )}

      {/* ============ INSPECTOR (portal): selected note + sync status, left rail ============ */}
      {inspectorEl &&
        createPortal(
          <>
            {showSync ? (
              !monitorEl && <ReferenceMonitor videoRef={videoRef} videoUrl={videoUrl} />
            ) : (
              // Keep the video element mounted for the clock even off the sync path.
              <video ref={videoRef} src={videoUrl ?? undefined} preload="metadata" className="hidden" />
            )}

            {/* (Exercise mode: the demo video lives in the Watch part; the play-part
                video + backing tracks are authored in the rail's media panel.) */}

            {/* Selected note */}
            <div className="st-icard">
              <span className="st-sec-label">Selected note</span>
              {selEvent && selection ? (
                <NoteDetails
                  event={selEvent}
                  measureIndex={selection.ref.measureIndex}
                  percussion={!!selTrack && isPercussion(selTrack.instrument)}
                  percLabel={
                    selTrack && selEvent.kind === 'note'
                      ? resolvePercStroke(selTrack.instrument, selEvent)?.label ?? 'Imported notation'
                      : null
                  }
                  timing={noteTiming}
                  onDelete={() => {
                    dispatch({
                      type: 'delete-event',
                      trackIndex: selection.trackIndex,
                      measureIndex: selection.ref.measureIndex,
                      eventIndex: selection.ref.eventIndex,
                    });
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click a note on the staff to inspect it.
                </p>
              )}
            </div>

            {/* Sync status */}
            {showSync && (
              <div className="st-icard">
                <div className="flex items-center gap-2 text-xs">
                  <span className="st-status-pip" /> {markers.measures.length} measure
                  {markers.measures.length === 1 ? '' : 's'} on the grid
                </div>
                {flags.size > 0 && (
                  <p className="text-xs text-destructive">
                    {flags.size === 1 ? '1 bar looks off' : `${flags.size} bars look off`}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="st-status-pip warn" /> Anchor at{' '}
                  <b className="font-mono tabular-nums text-foreground">{anchorSeconds.toFixed(1)}s</b> ·{' '}
                  {score.initialTempo} BPM
                </div>
                {anchorOwner && metronomeAnchor == null && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    No click anchor yet — it will default to the score&rsquo;s start.
                  </p>
                )}
                {anchorOwner && tempoDisagrees && mapImpliedBpm != null && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    The click runs at the score&rsquo;s{' '}
                    <b className="text-foreground">{score.initialTempo} BPM</b>, but this sync
                    plays at{' '}
                    <b className="text-foreground">~{Math.round(mapImpliedBpm)} BPM</b>. Set the
                    score&rsquo;s tempo to match if you want the click to sit on the recording.
                  </p>
                )}
                {/* Only shown while there's something to say — once the timing
                    is handed off to the draft, the host's app-bar autosave
                    status ("Draft saved" etc.) is authoritative. */}
                {timingAutosave && (error || dirty) && (
                  <div className="flex items-center gap-2 text-xs">
                    {error ? (
                      <><span className="st-status-pip warn" /> <span>Timing not saved</span></>
                    ) : (
                      <><span className="st-status-pip warn" /> <span className="text-muted-foreground">Saving to draft…</span></>
                    )}
                  </div>
                )}
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}
                {decodeState === 'error' && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600">
                    Couldn’t read this video’s audio. You can still sync against the measure grid.
                  </p>
                )}
              </div>
            )}
          </>,
          inspectorEl,
        )}

      {/* ============ BOTTOM (portal): transport ============ */}
      {showSync &&
        transportEl &&
        createPortal(
          <div className="st-transport">
            <TransportBar
              currentSeconds={clock.currentSeconds}
              durationSeconds={clock.durationSeconds}
              isPlaying={clock.isPlaying}
              playbackRate={clock.playbackRate}
              onToggle={clock.toggle}
              onRestart={() => clock.seek(trimWindow.startSeconds)}
              onSeek={seekClamped}
              onRateChange={clock.setPlaybackRate}
              loopA={clock.loopA}
              loopB={clock.loopB}
              loopEnabled={clock.loopEnabled}
              onToggleLoop={() => clock.setLoopEnabled(!clock.loopEnabled)}
              onClearLoop={clock.clearLoop}
              bpm={score.initialTempo}
              beatsPerMeasure={score.initialTimeSignature[0]}
              clickOn={clickOn}
              onClickOnChange={setClickOn}
              clickAligned={metronomeAnchor != null}
              clickVolume={clickVolume}
              onClickVolumeChange={handleClickVolumeChange}
              videoMuted={videoMuted}
              onVideoMutedChange={handleVideoMutedChange}
              videoVolume={videoVolume}
              onVideoVolumeChange={handleVideoVolumeChange}
              sectionMarkers={sectionsContext?.sections
                .filter((s) => s.startSeconds != null)
                .map((s) => ({ startSeconds: s.startSeconds!, endSeconds: s.endSeconds, label: s.label }))}
            />
          </div>,
          transportEl,
        )}
    </>
  );
}
