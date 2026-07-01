'use client';

// PlaySense Studio — sync panel (top half of the unified studio).
//
// Video audio waveform with numbered draggable measure markers (expandable to
// per-beat handles), notation aligned beneath, transport + per-measure loop +
// seed controls + zoom + Publish. Output is the same `drag` time map the student
// player consumes.
//
// Receives the CURRENT score from the parent (which owns it via useEditor). When
// the score's measure structure changes, the markers are RECONCILED in place so
// dragged positions survive edits. Owns the single <video> + clock — the edit
// panel below has no preview player, so playback never re-renders the parent.

import { AudioLines, Loader2, Maximize, Music2, Repeat, Trash2, UploadCloud, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type Dispatch } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { publishTimeMap, saveSectionDraftTimeMap } from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock';
import { TransportBar } from '@/components/playsense-studio/player/transport/transport-bar';
import { buildWaypoints } from '@/lib/playsense-studio/sync-seed';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { WaveformPeaks } from '@/lib/playsense-studio/waveform';
import {
  EPS,
  enforceMonotonic,
  freeCorridor,
  markerSpan,
  markerStateToWaypoints,
  orderedMarkers,
  rangesOverlap,
  reconcileMarkers,
  reinterpolateUnedited,
  seedMarkerState,
  setMarkerTime,
  setTailTime,
  shiftMarkersFrom,
  structuralSignature,
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
  type IntegratedEditorMeasureTiming,
} from '@/components/playsense-studio/studio/integrated-editor';
import type { SelectedEventRef } from '@/components/playsense-studio/studio/editable-measure-strip';
import { PlaceScoreControl } from '@/components/playsense-studio/sync/place-score-control';
import { SectionsLane, type LaneSection } from '@/components/playsense-studio/sync/sections-lane';
import { getPercStrokes, isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import type { MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/** A note selection, mirrored out of the editor so the right rail can show it. */
export interface StudioNoteSelection {
  ref: SelectedEventRef;
  trackIndex: number;
}

const WAVE_H = 240; // waveform lane height — the sync centerpiece, so it's tall

export interface SyncPanelProps {
  classItemId: string;
  scoreDocumentId: string;
  /** When set, Publish writes into this section (its active map + video range). */
  sectionId?: string;
  /** Which owner pointer Publish updates. Defaults to 'section' when sectionId is
   *  set, else 'classItem'. 'exercise' targets class_items.exercise_time_map_id —
   *  the play-along video synced to the graded score. */
  publishTarget?: 'classItem' | 'section' | 'exercise';
  /** 'video' = sync the score to the audio; 'exercise' = no sync, demo + highway. */
  mode: 'video' | 'exercise';
  videoUrl: string | null;
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  /** True when this section already has an autosaved sync draft not yet Published. */
  hasDraft?: boolean;
  videoDurationSeconds: number | null;
  /** Fired after a successful Publish (e.g. so a section list can refresh ranges). */
  onPublished?: () => void;
  /** App-shell slot the inspector (note + sync status) portals into (left rail). */
  inspectorEl?: HTMLElement | null;
  /** App-shell slot the transport bar portals into (video mode only). */
  transportEl?: HTMLElement | null;
  /** App-shell slot the reference-video monitor portals into (left rail). Falls back to the right rail. */
  monitorEl?: HTMLElement | null;
  /** Sibling scored sections — drives the sections lane + overlap prevention. */
  sectionsContext?: {
    sections: LaneSection[];
    activeSectionId: string;
    onSelectSection: (sectionId: string) => void;
  };
}

const MIN_PPS = 8;
const MAX_PPS = 600;
const DRAFT_DEBOUNCE_MS = 1500;

export function SyncPanel({
  classItemId,
  scoreDocumentId,
  sectionId,
  publishTarget,
  mode,
  videoUrl,
  score,
  dispatch,
  activeTimeMap,
  hasDraft,
  videoDurationSeconds,
  onPublished,
  inspectorEl,
  transportEl,
  monitorEl,
  sectionsContext,
}: SyncPanelProps) {
  const track = score.tracks[0];

  // Note selection, mirrored out of the (memoized) IntegratedEditor so the right
  // rail inspector can show the selected note. The editor stays the source of
  // truth; this is a display mirror updated via a stable callback.
  const [selection, setSelection] = useState<StudioNoteSelection | null>(null);
  const handleSelectionChange = useCallback((s: StudioNoteSelection | null) => setSelection(s), []);

  // The full "sync to audio" experience (waveform + draggable markers + transport
  // + Publish) only renders for VIDEO lessons with a video. Exercises and songs
  // edit the staff on a fixed-BPM grid with no time map.
  const showSync = mode === 'video' && !!videoUrl;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef);
  // When there's no waveform (video-less songs) the canvas can't report the
  // viewport width, so we measure the editor area directly to drive layout/zoom.
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  // --- Marker state ---
  // A published map wins; otherwise lay the measures from 0 at the score's tempo.
  // The admin repositions them with Import-at-playhead and by dragging — the video
  // has no single tempo, so there's no auto-fit across the audio.
  const [markers, setMarkers] = useState<MarkerState>(() => {
    if (activeTimeMap && activeTimeMap.waypoints.length >= 2) {
      return seedMarkerState(track, score, activeTimeMap.waypoints);
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
  useEffect(() => {
    if (prevSig.current === sig) return;
    prevSig.current = sig;
    setMarkers((prev) => reconcileMarkers(prev, score.tracks[0], score));
  }, [sig, score]);

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

  // --- Publish / draft autosave ---
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [isPublishing, startPublish] = useTransition();
  // Draft autosave state (section path only). `dirty` = not yet written to the
  // draft; `hasUnpublished` = a saved draft differs from what students see live.
  const [hasUnpublished, setHasUnpublished] = useState(!!hasDraft);
  const [savingDraft, setSavingDraft] = useState(false);
  const savingDraftRef = useRef(false);
  // Autosave only the section sync path (not the legacy classItem / exercise sync).
  const draftAutosave = showSync && !!sectionId && (publishTarget ?? 'section') === 'section';

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
  const runAnalysis = useCallback(() => {
    if (!videoUrl) return;
    analyzeCancelRef.current = false;
    setDecodeState('loading');
    setProgress(0);
    (async () => {
      try {
        const { loadOrComputePeaks } = await import('@/lib/playsense-studio/waveform-decode');
        const supabase = createClient();
        const result = await loadOrComputePeaks(classItemId, videoUrl, supabase, {
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
  const handles: MarkerHandle[] = useMemo(
    () =>
      orderedMarkers(markers)
        .filter((o) => o.ref !== null)
        .map((o) => ({
          measureNumber: o.ref!.measureNumber,
          beatInMeasure: o.ref!.beatInMeasure,
          isDownbeat: o.ref!.beatInMeasure === 1,
          videoTimeSeconds: o.videoTimeSeconds,
        })),
    [markers]
  );

  // Timing-only per-measure slots — the editor zips these with extractTrackEvents
  // for the ACTIVE track inside IntegratedEditor (so track-switching doesn't churn SyncPanel).
  const measureTimings: IntegratedEditorMeasureTiming[] = useMemo(() => {
    return markers.measures.map((m, i) => {
      const next = markers.measures[i + 1];
      const endVideoTimeSeconds = next ? next.beats[0].videoTimeSeconds : markers.tailVideoTimeSeconds;
      return {
        measureNumber: m.measureNumber,
        startVideoTimeSeconds: m.beats[0].videoTimeSeconds,
        endVideoTimeSeconds,
      };
    });
  }, [markers]);

  // Note onsets (video seconds) across ALL tracks, for the faint waveform ticks.
  // Each note's cumulative QN is interpolated into its measure's audio span; all
  // tracks share the same measure grid (measureTimings, matched by measureNumber).
  const noteOnsets: number[] = useMemo(() => {
    const timingByMeasure = new Map(measureTimings.map((t) => [t.measureNumber, t]));
    const onsets: number[] = [];
    for (const t of score.tracks) {
      const blocks = extractTrackEvents(t, score.initialTimeSignature, score.initialKeyFifths ?? 0);
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const timing = timingByMeasure.get(block.measure.number);
        if (!timing) continue;
        const next = blocks[i + 1];
        const measureLenQN = next
          ? next.cumulativeQN - block.cumulativeQN
          : (block.timeSignature[0] * 4) / block.timeSignature[1];
        if (measureLenQN <= 0) continue;
        const span = timing.endVideoTimeSeconds - timing.startVideoTimeSeconds;
        for (const ev of block.events) {
          if (ev.isRest) continue;
          const fraction = (ev.qnStart - block.cumulativeQN) / measureLenQN;
          onsets.push(timing.startVideoTimeSeconds + fraction * span);
        }
      }
    }
    // Dedupe near-coincident onsets (multi-track hits on the same beat) → one tick.
    const seen = new Set<number>();
    const out: number[] = [];
    for (const s of onsets) {
      const key = Math.round(s * 1000);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    out.sort((a, b) => a - b);
    return out;
  }, [score, measureTimings]);

  // --- Marker interaction handlers ---
  // Both drags clamp against the sibling-section corridor so a section can
  // never be dragged into a neighbor's video range.
  const handleMarkerDrag = useCallback((ref: MarkerRef, videoTimeSeconds: number, mode: DragMode) => {
    setMarkers((s) => {
      const { lo, hi } = corridorRef.current;
      if (mode === 'all-after') {
        const current = findBeatTime(s, ref);
        if (current === null) return s;
        const span = markerSpan(s);
        let delta = videoTimeSeconds - current;
        delta = Math.min(delta, hi - EPS - span.endSeconds); // right wall via the tail
        delta = Math.max(delta, lo + EPS - span.startSeconds); // left wall via the first downbeat
        return shiftMarkersFrom(s, ref, delta);
      }
      // Single drags only reach a wall at the span's edges; interior markers are
      // already clamped against their neighbors inside setMarkerTime.
      const clamped = Math.min(Math.max(videoTimeSeconds, lo + EPS), hi - EPS);
      return setMarkerTime(s, ref, clamped);
    });
    setDirty(true);
  }, []);

  const handleTailDrag = useCallback((videoTimeSeconds: number) => {
    setMarkers((s) => setTailTime(s, Math.min(videoTimeSeconds, corridorRef.current.hi - EPS)));
    setDirty(true);
  }, []);

  const handleSelect = useCallback((target: DragTarget) => {
    setSelected(target.kind === 'tail' ? 'tail' : target.ref);
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

  const loopSelectedMeasure = () => {
    if (!selected || selected === 'tail') return;
    const i = markers.measures.findIndex((m) => m.measureNumber === selected.measureNumber);
    if (i === -1) return;
    const start = markers.measures[i].beats[0].videoTimeSeconds;
    const next = markers.measures[i + 1];
    const end = next ? next.beats[0].videoTimeSeconds : markers.tailVideoTimeSeconds;
    if (end <= start) return;
    clock.loadLoop(start, end);
  };

  const zoomBy = (factor: number) => {
    setPps((p) => {
      const nextPps = clamp(p * factor, MIN_PPS, MAX_PPS);
      const centerTime = (scrollLeft + viewportWidth / 2) / p;
      setScrollLeft(Math.max(0, centerTime * nextPps - viewportWidth / 2));
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

  const handlePublish = () => {
    const waypoints = enforceMonotonic(markerStateToWaypoints(markers, { includeBeats: 'edited-beats' }));
    if (waypoints.length < 2) {
      setError('Need at least two markers to publish.');
      return;
    }
    setError(null);
    setPublished(false);
    startPublish(async () => {
      const editedBeats = markers.measures.flatMap((m) =>
        m.beats
          .filter((b) => b.edited && b.beatInMeasure !== 1)
          .map((b) => ({ measure: m.measureNumber, beat: b.beatInMeasure }))
      );
      const result = await publishTimeMap({
        classItemId,
        scoreDocumentId,
        sectionId,
        target: publishTarget,
        method: 'drag',
        params: { editedBeats, pps, peaksCached: decodeState === 'ready', version: 1 },
        waypoints,
        makeActive: true,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPublished(true);
      setDirty(false);
      setHasUnpublished(false); // server consumed the draft; this is now live
      onPublished?.();
    });
  };

  // Save the current markers to the hidden draft (silent — no publish, no
  // student-facing change). Shared by the debounce + the unmount flush.
  const saveDraft = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!draftAutosave || !sectionId || savingDraftRef.current) return;
      const waypoints = enforceMonotonic(markerStateToWaypoints(markers, { includeBeats: 'edited-beats' }));
      if (waypoints.length < 2) return;
      savingDraftRef.current = true;
      if (!opts?.silent) setSavingDraft(true);
      const editedBeats = markers.measures.flatMap((m) =>
        m.beats
          .filter((b) => b.edited && b.beatInMeasure !== 1)
          .map((b) => ({ measure: m.measureNumber, beat: b.beatInMeasure }))
      );
      const result = await saveSectionDraftTimeMap({
        classItemId,
        scoreDocumentId,
        sectionId,
        method: 'drag',
        params: { editedBeats, pps, peaksCached: decodeState === 'ready', version: 1 },
        waypoints,
      });
      savingDraftRef.current = false;
      // On the unmount flush the component is gone — skip all state updates.
      if (opts?.silent) return;
      setSavingDraft(false);
      if (!result.error) {
        setDirty(false);
        setHasUnpublished(true);
      }
    },
    [draftAutosave, sectionId, markers, classItemId, scoreDocumentId, pps, decodeState]
  );

  // Debounced draft autosave: after the drag settles (and not while placing /
  // publishing), persist the markers to the draft.
  useEffect(() => {
    if (!draftAutosave || !dirty || isPublishing || placeArmed) return;
    const id = setTimeout(() => { void saveDraft(); }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draftAutosave, dirty, isPublishing, placeArmed, saveDraft]);

  // Flush a pending draft on unmount (e.g. switching sections mid-debounce) so
  // nothing in the autosave window is lost. Reads the latest markers via a ref.
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    return () => {
      if (dirtyRef.current) void saveDraftRef.current({ silent: true });
    };
  }, []);

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

  const anchorSeconds = markers.measures[0]?.beats[0]?.videoTimeSeconds ?? 0;

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

            <div className="ml-auto flex items-center gap-1.5">
              {decodeState === 'loading' && (
                <span className="text-xs text-muted-foreground">
                  Analyzing audio… {progress > 0 ? `${Math.round(progress * 100)}%` : ''}
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
                  onClick={runAnalysis}
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
                    height={WAVE_H}
                    peaks={peaks}
                    durationSeconds={timelineDuration}
                    handles={handles}
                    noteOnsets={noteOnsets}
                    showNotes={showNotes}
                    tailVideoTimeSeconds={markers.tailVideoTimeSeconds}
                    pixelsPerSecond={pps}
                    scrollLeftPx={scrollLeft}
                    dragAll={dragAll}
                    selected={selected}
                    getCurrentSeconds={clock.getCurrentSeconds}
                    onSeek={clock.seek}
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
                    <div className="st-wave-empty" style={{ height: WAVE_H }}>
                      <p className="st-wave-empty-text">
                        {decodeState === 'error'
                          ? "Couldn't read this video's audio."
                          : 'No waveform yet.'}
                      </p>
                      <button type="button" onClick={runAnalysis} className="st-btn-primary">
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
                    />
                  )}

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

                  {/* Zoom floats over the waveform — it zooms THIS lane. */}
                  <div className="st-zoom-float">
                    <ZoomSlider pps={pps} onZoomTo={zoomTo} onZoomBy={zoomBy} onFit={fitZoom} />
                  </div>
                </div>
              )}

              {/* No horizontal padding here — the staff strip must share x=0
                  with the waveform canvas above so the measure grid stays aligned. */}
              <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3${showSync ? ' border-t border-border' : ''}`}>
                <IntegratedEditor
                  score={score}
                  dispatch={dispatch}
                  measureTimings={measureTimings}
                  getCurrentSeconds={clock.getCurrentSeconds}
                  pixelsPerSecond={pps}
                  scrollLeftPx={scrollLeft}
                  viewportWidth={viewportWidth}
                  onRequestZoom={(nextPps, nextScroll) => {
                    setPps(clamp(nextPps, MIN_PPS, MAX_PPS));
                    setScrollLeft(clampScroll(nextScroll));
                  }}
                  dragAll={dragAll}
                  showDragMode={showSync}
                  onSetDragAll={setDragAll}
                  onSelectionChange={handleSelectionChange}
                  onScrollByPx={handleScrollByPx}
                  onMeasureDrag={
                    showSync
                      ? (measureNumber, videoTimeSeconds, mode) =>
                          handleMarkerDrag({ measureNumber, beatInMeasure: 1 }, videoTimeSeconds, mode)
                      : () => {}
                  }
                  onMeasureDragEnd={showSync ? () => setMarkers((s) => reinterpolateUnedited(s)) : () => {}}
                  onTailDrag={showSync ? handleTailDrag : undefined}
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
                Analyzing audio…{progress > 0 ? ` ${Math.round(progress * 100)}%` : ''}
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
          <ReferenceMonitor videoRef={videoRef} videoUrl={videoUrl} />,
          monitorEl,
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
                    selTrack
                      ? getPercStrokes(selTrack.instrument)?.find(
                          (s) =>
                            selEvent.kind === 'note' && s.midi === selEvent.midi,
                        )?.label ?? null
                      : null
                  }
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
                <div className="flex items-center justify-between">
                  <span className="st-sec-label">Sync status</span>
                  <button
                    onClick={handlePublish}
                    disabled={isPublishing || (draftAutosave && !hasUnpublished && !dirty)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    {isPublishing ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="st-pip" /> {markers.measures.length} measure
                  {markers.measures.length === 1 ? '' : 's'} on the grid
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="st-pip warn" /> Anchor at{' '}
                  <b className="font-mono tabular-nums text-foreground">{anchorSeconds.toFixed(1)}s</b> ·{' '}
                  {score.initialTempo} BPM
                </div>
                {/* Draft autosave status (section path). Students keep the last
                    Published sync until Publish promotes the draft. */}
                {draftAutosave && (
                  <div className="flex items-center gap-2 text-xs">
                    {savingDraft || dirty ? (
                      <><span className="st-pip warn" /> <span className="text-muted-foreground">Saving draft…</span></>
                    ) : hasUnpublished ? (
                      <><span className="st-pip warn" /> <span className="text-foreground">Draft saved · not live — Publish to go live</span></>
                    ) : (
                      <><span className="st-pip" /> <span className="text-muted-foreground">Live — students see this sync</span></>
                    )}
                  </div>
                )}
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                    {error}
                  </p>
                )}
                {published && !draftAutosave && (
                  <p className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
                    Published — students will see the new sync.
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
              onRestart={() => clock.seek(0)}
              onSeek={clock.seek}
              onRateChange={clock.setPlaybackRate}
              loopA={clock.loopA}
              loopB={clock.loopB}
              loopEnabled={clock.loopEnabled}
              onToggleLoop={() => clock.setLoopEnabled(!clock.loopEnabled)}
              onClearLoop={clock.clearLoop}
              bpm={score.initialTempo}
              beatsPerMeasure={score.initialTimeSignature[0]}
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

// The reference-video monitor. Kept as a tiny component so SyncPanel can portal
// it to the left rail (sections workspace) or the right rail (single-score
// fallback) — the <video> stays in SyncPanel's React tree either way, so the
// transport clock keeps driving it.
function ReferenceMonitor({
  videoRef,
  videoUrl,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
}) {
  return (
    <div>
      <span className="st-sec-label">Reference video</span>
      <div className="st-monitor mt-2">
        <div className="st-monitor-badge">
          <span className="pip" /> Reference
        </div>
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

// Read-only details for the selected note, shown in the right-rail inspector.
// Editing happens via the staff toolbar; this offers a quick Delete.
function NoteDetails({
  event,
  measureIndex,
  percussion,
  percLabel,
  onDelete,
}: {
  event: MusicalEvent;
  measureIndex: number;
  percussion: boolean;
  percLabel: string | null;
  onDelete: () => void;
}) {
  const durLabel = formatDurationQN(event.durationQN) + (event.dotted ? '.' : '') + (event.triplet ? ' ³' : '');
  let primary: string;
  if (event.kind === 'rest') {
    primary = 'Rest';
  } else if (percussion) {
    primary = percLabel ?? 'Stroke';
  } else if (event.kind === 'note') {
    primary = midiToName(event.midi);
  } else {
    primary = 'Chord';
  }
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{primary}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">m.{measureIndex + 1}</span>
      </div>
      <div className="st-prop">
        <span className="k">Kind</span>
        <span className="v capitalize">{event.kind}</span>
      </div>
      <div className="st-prop">
        <span className="k">Duration</span>
        <span className="v">{durLabel}</span>
      </div>
      <button
        onClick={onDelete}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete note
      </button>
    </>
  );
}

function formatDurationQN(qn: number): string {
  const map: Record<string, string> = {
    '4': 'whole',
    '2': 'half',
    '1': 'quarter',
    '0.5': '8th',
    '0.25': '16th',
    '0.125': '32nd',
    '0.0625': '64th',
  };
  return map[String(qn)] ?? `${qn} QN`;
}

function midiToName(midi: number): string {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${names[pc]}${octave}`;
}

// A thin custom horizontal scrollbar over the canvas coordinate space. The
// thumb is draggable (pointer capture); clicking the track jumps there and the
// same gesture keeps dragging. Geometry is fraction-based off the track's own
// rect, so it stays accurate regardless of the bar's rendered width.
function ScrollBar({
  scrollLeft,
  maxScroll,
  viewportWidth,
  contentWidth,
  onScroll,
}: {
  scrollLeft: number;
  maxScroll: number;
  viewportWidth: number;
  contentWidth: number;
  onScroll: (v: number) => void;
}) {
  const dragRef = useRef<{ pointerId: number; grabOffsetPx: number } | null>(null);
  if (maxScroll <= 0 || contentWidth <= 0) return null;

  const thumbFrac = Math.max(0.02, Math.min(1, viewportWidth / contentWidth));
  const leftFrac = (scrollLeft / maxScroll) * (1 - thumbFrac);

  const thumbPx = (rect: DOMRect) => Math.max(24, thumbFrac * rect.width);
  const scrollFromThumbLeft = (rect: DOMRect, thumbLeftPx: number) => {
    const range = Math.max(1, rect.width - thumbPx(rect));
    const frac = Math.max(0, Math.min(1, thumbLeftPx / range));
    onScroll(frac * maxScroll);
  };

  return (
    <div
      className="relative h-2.5 w-full cursor-pointer rounded-full bg-muted"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const tw = thumbPx(rect);
        const thumbLeft = leftFrac * rect.width;
        const x = e.clientX - rect.left;
        // Grab the thumb where pressed; off the thumb, center it under the cursor.
        const grabOffsetPx = x >= thumbLeft && x <= thumbLeft + tw ? x - thumbLeft : tw / 2;
        dragRef.current = { pointerId: e.pointerId, grabOffsetPx };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        scrollFromThumbLeft(rect, x - grabOffsetPx);
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        scrollFromThumbLeft(rect, e.clientX - rect.left - drag.grabOffsetPx);
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.pointerId !== e.pointerId) return;
        dragRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <div
        className="absolute top-0 h-2.5 rounded-full bg-foreground/40 transition-colors hover:bg-foreground/60"
        style={{ width: `${thumbFrac * 100}%`, minWidth: 24, left: `${leftFrac * 100}%` }}
      />
    </div>
  );
}

function findBeatTime(state: MarkerState, ref: MarkerRef): number | null {
  const m = state.measures.find((mm) => mm.measureNumber === ref.measureNumber);
  if (!m) return null;
  const beat = m.beats.find((b) => b.beatInMeasure === ref.beatInMeasure);
  return beat ? beat.videoTimeSeconds : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

/**
 * Drag-to-zoom timeline control. The knob position is a log mapping of the
 * current pixels-per-second between MIN_PPS and MAX_PPS, so dragging feels even
 * across the whole zoom range. The −/＋ buttons nudge by a fixed factor and the
 * last button fits the whole timeline to the viewport.
 */
function ZoomSlider({
  pps,
  onZoomTo,
  onZoomBy,
  onFit,
}: {
  pps: number;
  onZoomTo: (pps: number) => void;
  onZoomBy: (factor: number) => void;
  onFit: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = Math.log(MAX_PPS / MIN_PPS);
  const fraction = clamp(Math.log(pps / MIN_PPS) / span, 0, 1);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = clamp((clientX - r.left) / r.width, 0, 1);
    onZoomTo(MIN_PPS * Math.exp(f * span));
  };
  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const onUp = (e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="st-zoom" title="Zoom timeline (drag)">
      <button type="button" className="st-zoom-btn" onClick={() => onZoomBy(1 / 1.5)} aria-label="Zoom out">
        <ZoomOut className="h-[15px] w-[15px]" />
      </button>
      <div
        ref={trackRef}
        className="st-zoom-track"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="slider"
        aria-label="Zoom level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <div className="fill" style={{ width: `${fraction * 100}%` }} />
        <div className="knob" style={{ left: `${fraction * 100}%` }} />
      </div>
      <button type="button" className="st-zoom-btn" onClick={() => onZoomBy(1.5)} aria-label="Zoom in">
        <ZoomIn className="h-[15px] w-[15px]" />
      </button>
      <button type="button" className="st-iconbtn" onClick={onFit} title="Fit to width" style={{ marginLeft: 2 }}>
        <Maximize className="h-[15px] w-[15px]" />
      </button>
    </div>
  );
}
