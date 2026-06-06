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

import { AudioLines, ChevronsLeftRight, Loader2, Maximize, Repeat, UploadCloud, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type Dispatch } from 'react';
import { createClient } from '@/lib/supabase/client';
import { publishTimeMap } from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock';
import { TransportBar } from '@/components/playsense-studio/player/transport/transport-bar';
import { buildWaypoints, buildTapSeed, buildFitWaypoints } from '@/lib/playsense-studio/sync-seed';
import type { EditorAction } from '@/lib/playsense-studio/editor-state';
import type { WaveformPeaks } from '@/lib/playsense-studio/waveform';
import {
  enforceMonotonic,
  markerStateToWaypoints,
  orderedMarkers,
  reconcileMarkers,
  reinterpolateUnedited,
  seedMarkerState,
  setMarkerTime,
  setTailTime,
  shiftMarkersFrom,
  structuralSignature,
  type MarkerRef,
  type MarkerState,
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
import { SeedControls } from '@/components/playsense-studio/sync/seed-controls';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface SyncPanelProps {
  classItemId: string;
  scoreDocumentId: string;
  videoUrl: string | null;
  score: ScoreDocument;
  dispatch: Dispatch<EditorAction>;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  videoDurationSeconds: number | null;
}

const PPS_PRESETS = [20, 40, 80, 160];
const MIN_PPS = 8;
const MAX_PPS = 600;

export function SyncPanel({
  classItemId,
  scoreDocumentId,
  videoUrl,
  score,
  dispatch,
  activeTimeMap,
  videoDurationSeconds,
}: SyncPanelProps) {
  const track = score.tracks[0];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef);
  // When there's no waveform (video-less songs) the canvas can't report the
  // viewport width, so we measure the editor area directly to drive layout/zoom.
  const editorAreaRef = useRef<HTMLDivElement | null>(null);

  // --- Marker state ---
  // Priority: a published map > measures stretched across the whole audio (so
  // they always span the video) > a default fixed-tempo grid when no duration
  // is known yet.
  const [markers, setMarkers] = useState<MarkerState>(() => {
    if (activeTimeMap && activeTimeMap.waypoints.length >= 2) {
      return seedMarkerState(track, score, activeTimeMap.waypoints);
    }
    if (videoUrl && (videoDurationSeconds ?? 0) > 0) {
      return seedMarkerState(track, score, buildFitWaypoints(score, videoDurationSeconds as number));
    }
    return seedMarkerState(track, score, buildWaypoints(score, score.initialTempo, 0));
  });
  const [dirty, setDirty] = useState(false);

  // Auto-fit measures across the whole audio ONCE the real duration is known.
  // Covers the case where video_duration_seconds wasn't stored at mount — we
  // wait for the video clock to report it, then stretch the markers (unless the
  // admin already dragged them or a published map is in play).
  const didAutoFitRef = useRef<boolean>(
    (activeTimeMap != null && activeTimeMap.waypoints.length >= 2) || (videoDurationSeconds ?? 0) > 0
  );

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

  useEffect(() => {
    if (didAutoFitRef.current || dirty || !videoUrl) return;
    const dur = clock.durationSeconds;
    if (dur > 0) {
      didAutoFitRef.current = true;
      setMarkers(seedMarkerState(track, score, buildFitWaypoints(score, dur)));
    }
  }, [clock.durationSeconds, dirty, videoUrl, track, score]);

  // --- View state ---
  const [pps, setPps] = useState(40);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [selected, setSelected] = useState<MarkerRef | 'tail' | null>(null);
  // Region drag is the easy default: grabbing a measure shifts it + everything
  // after. Toolbar toggle / Alt switches to single. Applies to measure-block
  // drags and the waveform markers alike.
  const [dragAll, setDragAll] = useState(true);

  // --- Peaks decode ---
  const [peaks, setPeaks] = useState<WaveformPeaks | null>(null);
  const [decodeState, setDecodeState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  // --- Publish ---
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [isPublishing, startPublish] = useTransition();

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
    if (triedCacheRef.current || !videoUrl) return;
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
  }, [classItemId, videoUrl, runAnalysis]);

  // Fit zoom once the viewport width + a duration are known.
  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current) return;
    if (viewportWidth > 0 && timelineDuration > 0) {
      didFitRef.current = true;
      setPps(clamp(viewportWidth / timelineDuration, MIN_PPS, MAX_PPS));
    }
  }, [viewportWidth, timelineDuration]);

  // Without a video, the waveform canvas isn't mounted to report the viewport
  // width — measure the editor area ourselves so fit-zoom + scrollbar work.
  useEffect(() => {
    if (videoUrl) return;
    const el = editorAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [videoUrl]);

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

  // --- Marker interaction handlers ---
  const handleMarkerDrag = useCallback((ref: MarkerRef, videoTimeSeconds: number, mode: DragMode) => {
    setMarkers((s) => {
      if (mode === 'all-after') {
        const current = findBeatTime(s, ref);
        if (current === null) return s;
        return shiftMarkersFrom(s, ref, videoTimeSeconds - current);
      }
      return setMarkerTime(s, ref, videoTimeSeconds);
    });
    setDirty(true);
  }, []);

  const handleTailDrag = useCallback((videoTimeSeconds: number) => {
    setMarkers((s) => setTailTime(s, videoTimeSeconds));
    setDirty(true);
  }, []);

  const handleSelect = useCallback((target: DragTarget) => {
    setSelected(target.kind === 'tail' ? 'tail' : target.ref);
  }, []);

  const handleScrollByPx = useCallback(
    (dx: number) => setScrollLeft((s) => clampScroll(s + dx)),
    [clampScroll]
  );

  const applyTempoSeed = useCallback(
    (bpm: number, offset: number) => {
      setMarkers(seedMarkerState(track, score, buildWaypoints(score, bpm, offset)));
      setDirty(true);
      setSelected(null);
    },
    [track, score]
  );

  const applyTapSeed = useCallback(
    (tapTimes: number[]) => {
      const seed = buildTapSeed(score, tapTimes);
      if (seed.length < 2) return;
      setMarkers(seedMarkerState(track, score, seed));
      setDirty(true);
      setSelected(null);
    },
    [track, score]
  );

  const applyFitSeed = useCallback(() => {
    const dur = clock.durationSeconds > 0 ? clock.durationSeconds : videoDurationSeconds ?? 0;
    if (dur <= 0) return;
    const seed = buildFitWaypoints(score, dur);
    if (seed.length < 2) return;
    setMarkers(seedMarkerState(track, score, seed));
    setDirty(true);
    setSelected(null);
  }, [clock, videoDurationSeconds, track, score]);

  const toggleExpandSelected = () => {
    if (!selected || selected === 'tail') return;
    const measureNumber = selected.measureNumber;
    setMarkers((s) => ({
      ...s,
      measures: s.measures.map((m) =>
        m.measureNumber === measureNumber ? { ...m, expanded: !m.expanded } : m
      ),
    }));
  };

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
    });
  };

  if (!track) {
    return <p className="text-sm text-muted-foreground">This score has no tracks to edit.</p>;
  }

  // Video is OPTIONAL. With a video, the full "sync to audio" experience renders
  // (waveform + draggable markers + transport + Publish). Without one (standalone
  // songs), only the staff editor renders, laid out on the fixed-BPM grid the
  // markers were seeded from — no waveform, no transport, no time-map publishing.
  const showSync = !!videoUrl;

  // While the first-time decode runs, lock the panel behind a loader so it's
  // clear the page is analyzing (and nothing is half-interactive).
  const analyzing = decodeState === 'loading';

  return (
    <div className="relative space-y-4">
      <div
        className={analyzing ? 'pointer-events-none select-none opacity-50' : undefined}
        aria-busy={analyzing}
      >
      {showSync && (
        <>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sync to audio
            </h2>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              {isPublishing ? 'Publishing…' : 'Publish sync'}
            </button>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {published && (
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              Time map published. Students will see the new sync on this lesson.
            </p>
          )}
          {decodeState === 'error' && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              Couldn&apos;t read this video&apos;s audio, so the waveform is unavailable. You can still sync
              against the measure grid below.
            </p>
          )}

          <SeedControls
            initialBpm={score.initialTempo}
            hasEdits={dirty}
            getCurrentSeconds={clock.getCurrentSeconds}
            onApplyTempoSeed={applyTempoSeed}
            onApplyTapSeed={applyTapSeed}
            onApplyFitSeed={applyFitSeed}
          />
        </>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {showSync && (
          <>
            <button
              onClick={() => setDragAll((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition ${
                dragAll ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
              }`}
              title="Drag a measure (or marker) and everything after it moves together. Hold Option to move just one."
            >
              <ChevronsLeftRight className="h-4 w-4" />
              Drag region
            </button>
            <button
              onClick={toggleExpandSelected}
              disabled={!selected || selected === 'tail'}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show/hide beats
            </button>
            <button
              onClick={loopSelectedMeasure}
              disabled={!selected || selected === 'tail'}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Repeat className="h-4 w-4" />
              Loop measure
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoomBy(0.5)} className="rounded-md border border-border p-1.5 transition hover:bg-muted" title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          {PPS_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setPps(preset)}
              className={`rounded px-2 py-1 text-xs ${
                Math.abs(pps - preset) < 0.5 ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {preset}
            </button>
          ))}
          <button onClick={() => zoomBy(2)} className="rounded-md border border-border p-1.5 transition hover:bg-muted" title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={fitZoom} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 transition hover:bg-muted" title="Fit to width">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Waveform + notation */}
      <div className="space-y-1" ref={editorAreaRef}>
        {showSync && (
          <>
            <div className="flex items-center gap-3">
              {decodeState !== 'loading' && (
                <button
                  onClick={runAnalysis}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition hover:bg-muted"
                  title="Decode this video's audio to show the waveform"
                >
                  <AudioLines className="h-4 w-4" />
                  {decodeState === 'idle'
                    ? 'Analyze audio'
                    : decodeState === 'error'
                      ? 'Retry analysis'
                      : 'Re-analyze'}
                </button>
              )}
              {decodeState === 'loading' && (
                <p className="text-xs text-muted-foreground">
                  Analyzing audio… {progress > 0 ? `${Math.round(progress * 100)}%` : ''}
                </p>
              )}
            </div>
            <WaveformCanvas
              peaks={peaks}
              durationSeconds={timelineDuration}
              handles={handles}
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
            />
          </>
        )}
        <IntegratedEditor
          score={score}
          dispatch={dispatch}
          measureTimings={measureTimings}
          pixelsPerSecond={pps}
          scrollLeftPx={scrollLeft}
          viewportWidth={viewportWidth}
          onRequestZoom={(nextPps, nextScroll) => {
            setPps(clamp(nextPps, MIN_PPS, MAX_PPS));
            setScrollLeft(clampScroll(nextScroll));
          }}
          dragAll={dragAll}
          onMeasureDrag={
            showSync
              ? (measureNumber, videoTimeSeconds, mode) =>
                  handleMarkerDrag({ measureNumber, beatInMeasure: 1 }, videoTimeSeconds, mode)
              : () => {}
          }
          onMeasureDragEnd={showSync ? () => setMarkers((s) => reinterpolateUnedited(s)) : () => {}}
        />
        <ScrollBar
          scrollLeft={scrollLeft}
          maxScroll={maxScroll}
          viewportWidth={viewportWidth}
          contentWidth={timelineDuration * pps}
          onScroll={(v) => setScrollLeft(clampScroll(v))}
        />
      </div>

      {/* Video + transport */}
      {showSync && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
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
          />
          <video
            ref={videoRef}
            src={videoUrl ?? undefined}
            playsInline
            preload="metadata"
            className="max-h-48 w-full rounded-md bg-black md:w-72"
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {showSync ? (
          <>
            Drag a measure’s handle (the bar above each staff) onto the audio — by default it slides that
            measure and everything after it, so you can place the whole score at once and refine from
            there. Hold <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] text-foreground">Option</kbd>{' '}
            to move just one measure, or use the numbered waveform markers for fine per-beat tweaks.
            Markers can’t cross their neighbors, so Publish always produces a valid sync.
          </>
        ) : (
          <>
            Click a note to select it, drag it up/down to change pitch, or click empty space in a measure
            to add one. Notes are laid out on a fixed-BPM grid (set the tempo in the score settings above).
          </>
        )}
      </p>
      </div>

      {analyzing && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/75 backdrop-blur-sm">
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
  );
}

// A thin custom horizontal scrollbar over the canvas coordinate space.
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
  if (maxScroll <= 0 || contentWidth <= 0) return null;
  const thumbW = Math.max(24, (viewportWidth / contentWidth) * viewportWidth);
  const thumbX = (scrollLeft / maxScroll) * (viewportWidth - thumbW);
  return (
    <div
      className="relative h-2 w-full cursor-pointer rounded-full bg-muted"
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left - thumbW / 2;
        const frac = Math.max(0, Math.min(1, px / Math.max(1, viewportWidth - thumbW)));
        onScroll(frac * maxScroll);
      }}
    >
      <div
        className="absolute top-0 h-2 rounded-full bg-foreground/40"
        style={{ width: thumbW, left: Math.max(0, Math.min(thumbX, viewportWidth - thumbW)) }}
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
