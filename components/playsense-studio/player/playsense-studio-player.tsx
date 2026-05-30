'use client';

// PlaySense Studio top-level player.
//
// Wires:
//   <video> ──> useVideoTransportClock ──> currentSeconds
//                                              │
//                                              v
//   TimeMap.toMusicalPosition(seconds) ──> QN ──> score-internal ms
//                                                      │
//                                                      v
//                                             StaffRenderer.currentMs
//                                                      │
//                                                      v
//                                          (click-to-seek emits QN back)
//                                                      │
//                                                      v
//                                          TimeMap.toVideoTime(QN)
//                                                      │
//                                                      v
//                                          video.currentTime = seconds
//
// When no TimeMap is attached to the class item, synthesize a default map
// from the score's tempo (2 waypoints: start and end). This makes the player
// usable as soon as a score document is attached, with sync polish coming
// from M7's authoring tools.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import { TransportBar } from './transport/transport-bar';
import { VideoStage } from './video/video-stage';
import {
  StaffRenderer,
  type SelectedRange,
} from './notation/renderers/staff-renderer';
import { StaffScrubBar } from './notation/staff-scrub-bar';
import { ClipsPanel } from './clips/clips-panel';
import { useVideoTransportClock } from './state/use-video-transport-clock';
import { logPlaysenseStudioEvent, type PlaysenseStudioClip } from '@/app/actions/playsense-studio';
import {
  WaypointTimeMap,
  type SyncMethod,
  type Waypoint,
} from '@/components/playsense-studio/shared/time-map/time-map';
import { qnToTrackMs, trackDurationQN } from '@/lib/playsense-studio/time-mapping';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { SeekTarget } from '@/lib/playsense-studio/renderer';
import { updateClassItemPosition } from '@/app/actions/progress';

export interface PlaysenseStudioPlayerScoreTrack {
  id: string;
  trackIndex: number;
  instrument: string;
  displayName: string;
  tuning: string[] | null;
  stringMultiplicity: number;
  defaultView: string | null;
}

export interface PlaysenseStudioPlayerTimeMap {
  id: string;
  method: string;
  waypoints: Array<{
    musicalPositionQN: number;
    videoTimeSeconds: number;
    measureNumber: number | null;
    beatInMeasure: number | null;
  }>;
}

export interface PlaysenseStudioPlayerProps {
  classItemId: string;
  videoUrl: string;
  posterUrl?: string;
  score: ScoreDocument;
  tracks: PlaysenseStudioPlayerScoreTrack[];
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  /** When true, cursor + render proceed but the position-tracking server action is skipped. */
  readOnly?: boolean;
  /**
   * 'stack' (default) — video, transport, then staff in a single column.
   * 'split' — video pane next to the PlaySense notation pane, resizable with a
   * diagonal corner knob and a side-by-side ↔ stacked orientation toggle.
   */
  layout?: 'stack' | 'split';
}

const POSITION_SAVE_INTERVAL_MS = 5000;

export function PlaysenseStudioPlayer({
  classItemId,
  videoUrl,
  posterUrl,
  score,
  tracks,
  activeTimeMap,
  readOnly,
  layout = 'stack',
}: PlaysenseStudioPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef);

  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const activeTrack = score.tracks[activeTrackIndex] ?? score.tracks[0];

  // Track view-switch events. We only count it as a switch after the
  // first render so the initial mount doesn't create a spurious event.
  const previousTrackRef = useRef(activeTrackIndex);
  useEffect(() => {
    if (readOnly) return;
    if (previousTrackRef.current !== activeTrackIndex) {
      previousTrackRef.current = activeTrackIndex;
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_view_switched',
        classItemId,
        metadata: {
          to_track_index: activeTrackIndex,
          to_instrument: score.tracks[activeTrackIndex]?.instrument,
        },
      });
    }
  }, [activeTrackIndex, classItemId, readOnly, score]);

  // Build (or synthesize) the WaypointTimeMap for the active track.
  const timeMap = useMemo(() => {
    return buildTimeMap(score, activeTrackIndex, activeTimeMap, clock.durationSeconds);
  }, [score, activeTrackIndex, activeTimeMap, clock.durationSeconds]);

  // Convert video seconds → score-internal ms for the staff cursor.
  const cursorMs = useMemo(() => {
    if (!timeMap) return 0;
    const qn = timeMap.toMusicalPosition(clock.currentSeconds);
    return qnToTrackMs(activeTrack, score, qn);
  }, [clock.currentSeconds, timeMap, activeTrack, score]);

  // Loop markers in the staff are placed at the score-internal ms
  // corresponding to the (video-time) loop endpoints — same translation
  // path the playhead takes.
  const loopAMs = useMemo(() => {
    if (!timeMap || clock.loopA === null) return null;
    const qn = timeMap.toMusicalPosition(clock.loopA);
    return qnToTrackMs(activeTrack, score, qn);
  }, [timeMap, clock.loopA, activeTrack, score]);
  const loopBMs = useMemo(() => {
    if (!timeMap || clock.loopB === null) return null;
    const qn = timeMap.toMusicalPosition(clock.loopB);
    return qnToTrackMs(activeTrack, score, qn);
  }, [timeMap, clock.loopB, activeTrack, score]);

  // Independent staff view position. When isFollowing is true, the view
  // tracks playback (cursorMs); when false, viewMs is held wherever the
  // user dragged the scroll bar last.
  const [viewMs, setViewMs] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);
  const [trackDurationMs, setTrackDurationMs] = useState(0);

  useEffect(() => {
    if (isFollowing) setViewMs(cursorMs);
  }, [cursorMs, isFollowing]);

  // Reset view + follow flag when the active track changes — different
  // tracks have different durations, and a scrub position from one doesn't
  // make sense for another.
  useEffect(() => {
    setIsFollowing(true);
    setViewMs(0);
  }, [activeTrackIndex]);

  // Click-on-staff → seek the video. Importantly we do NOT re-engage
  // follow here: the user wants the orange line to land at the click
  // position, not the staff to jump so the click position becomes the
  // anchor. If they want follow back, they hit the Follow button.
  const handleSeek = (target: SeekTarget) => {
    if (!timeMap) return;
    const seconds = timeMap.toVideoTime(target.qn);
    clock.seek(seconds);
    if (!readOnly) {
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_seek_via_notation',
        classItemId,
        metadata: { qn: target.qn, video_seconds: seconds },
      });
    }
  };

  // Drag-on-staff → set A/B and arm the loop.
  const handleSelectRange = (range: SelectedRange) => {
    if (!timeMap) return;
    const startSec = timeMap.toVideoTime(range.startQn);
    const endSec = timeMap.toVideoTime(range.endQn);
    if (endSec <= startSec) return;
    clock.setLoopA(startSec);
    clock.setLoopB(endSec);
    clock.setLoopEnabled(true);
  };

  const handleStaffScrub = (ms: number) => {
    setIsFollowing(false);
    setViewMs(ms);
  };

  const handleFollow = () => {
    setIsFollowing(true);
    setViewMs(cursorMs);
  };

  // Save last position periodically and on unmount.
  useEffect(() => {
    if (readOnly) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    timer = setInterval(() => {
      const seconds = clock.getCurrentSeconds();
      if (seconds > 0) {
        void updateClassItemPosition(classItemId, Math.floor(seconds));
      }
    }, POSITION_SAVE_INTERVAL_MS);
    return () => {
      if (timer) clearInterval(timer);
      const seconds = clock.getCurrentSeconds();
      if (seconds > 0) {
        void updateClassItemPosition(classItemId, Math.floor(seconds));
      }
    };
  }, [classItemId, clock, readOnly]);

  // Analytics — one event on first mount + one each time playback transitions
  // from paused to playing. Fire-and-forget; errors are swallowed inside
  // logPlaysenseStudioEvent so they can't block the UI.
  const sentLoadedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    if (sentLoadedRef.current) return;
    sentLoadedRef.current = true;
    void logPlaysenseStudioEvent({
      eventType: 'playsense_studio_player_loaded',
      classItemId,
      metadata: {
        track_count: tracks.length,
        has_time_map: activeTimeMap !== null,
      },
    });
  }, [classItemId, tracks.length, activeTimeMap, readOnly]);
  useEffect(() => {
    if (readOnly) return;
    if (clock.isPlaying && !wasPlayingRef.current) {
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_play',
        classItemId,
        metadata: { from_seconds: clock.currentSeconds, rate: clock.playbackRate },
      });
    }
    wasPlayingRef.current = clock.isPlaying;
  }, [clock.isPlaying, clock.currentSeconds, clock.playbackRate, classItemId, readOnly]);

  // ---- Split-layout resize state (only used when layout === 'split') ----
  const [orient, setOrient] = useState<'row' | 'column'>('row');
  const [split, setSplit] = useState(55); // % given to the video pane
  const [workspaceH, setWorkspaceH] = useState(560);
  const [knobDragging, setKnobDragging] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const isRow = orient === 'row';

  const SPLIT_MIN = 28;
  const SPLIT_MAX = 72;
  const H_MIN = 360;
  const hMax = () =>
    Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.92);

  const resetSize = useCallback(() => {
    setSplit(isRow ? 55 : 60);
    setWorkspaceH(560);
  }, [isRow]);

  // Delta-based 2-axis drag: primary axis rebalances the split, the other axis
  // changes the overall workspace height.
  const startKnob = useCallback(
    (e: ReactMouseEvent | ReactTouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point = 'touches' in e ? e.touches[0] : e;
      const sx = point.clientX;
      const sy = point.clientY;
      const start = { sx, sy, split, h: workspaceH, w: rect.width, ht: rect.height };
      setKnobDragging(true);
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const p = 'touches' in ev ? ev.touches[0] : ev;
        const dx = p.clientX - start.sx;
        const dy = p.clientY - start.sy;
        if (isRow) {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dx / start.w) * 100))
          );
          setWorkspaceH(Math.max(H_MIN, Math.min(hMax(), start.h + dy)));
        } else {
          setSplit(
            Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, start.split + (dy / start.ht) * 100))
          );
          setWorkspaceH(Math.max(H_MIN, Math.min(hMax(), start.h + dx)));
        }
      };
      const onUp = () => {
        setKnobDragging(false);
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
    },
    [isRow, split, workspaceH]
  );

  // ---- Shared building blocks (reused by both layouts) ----
  const videoEl = (
    <VideoStage
      ref={videoRef}
      src={videoUrl}
      poster={posterUrl}
      className={
        layout === 'split'
          ? 'h-full w-full [&_video]:object-contain'
          : 'aspect-video'
      }
      onFirstPlay={() => clock.play()}
    />
  );

  const transportEl = (
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
  );

  const tracksEl =
    tracks.length > 1 ? (
      <div className="flex flex-wrap gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground self-center mr-1">
          Track
        </span>
        {score.tracks.map((t, i) => (
          <button
            key={t.index}
            onClick={() => setActiveTrackIndex(i)}
            className={`px-2.5 py-1 rounded-md text-xs border transition ${
              i === activeTrackIndex
                ? 'bg-secondary text-secondary-foreground border-secondary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            {t.displayName}
          </button>
        ))}
      </div>
    ) : null;

  const staffEl = (
    <StaffRenderer
      score={score}
      trackIndex={activeTrackIndex}
      currentMs={cursorMs}
      viewMs={viewMs}
      loopAMs={loopAMs}
      loopBMs={loopBMs}
      onSeek={handleSeek}
      onSelectRange={handleSelectRange}
      onDurationKnown={setTrackDurationMs}
    />
  );

  const scrubEl =
    trackDurationMs > 0 ? (
      <StaffScrubBar
        durationMs={trackDurationMs}
        viewMs={viewMs}
        playbackMs={cursorMs}
        isFollowing={isFollowing}
        onScrub={handleStaffScrub}
        onFollow={handleFollow}
      />
    ) : null;

  const clipsEl =
    !readOnly ? (
      <ClipsPanel
        classItemId={classItemId}
        loopA={clock.loopA}
        loopB={clock.loopB}
        playbackRate={clock.playbackRate}
        onLoadClip={(clip: PlaysenseStudioClip) => {
          clock.loadLoop(clip.startSeconds, clip.endSeconds, {
            rate: clip.playbackRate,
          });
        }}
      />
    ) : null;

  // ---- Split layout: resizable video | notation panes ----
  if (layout === 'split') {
    const measures = score.tracks[activeTrackIndex]?.measures.length ?? 0;
    const meta = [
      measures > 0 ? `${measures} measures` : null,
      `${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]}`,
      `♩=${Math.round(score.initialTempo)}`,
    ]
      .filter(Boolean)
      .join('  ·  ');

    return (
      <div className="space-y-4">
        <div
          ref={workspaceRef}
          className="relative overflow-visible rounded-xl border border-border bg-black"
          style={{ height: workspaceH }}
        >
          <div
            className="flex h-full items-stretch"
            style={{ flexDirection: isRow ? 'row' : 'column' }}
          >
            {/* Video pane */}
            <div
              className="flex min-h-0 min-w-0 flex-col bg-black"
              style={{ flex: `${split} 1 0` }}
            >
              <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
                {videoEl}
              </div>
              <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2">
                {transportEl}
              </div>
            </div>

            {/* Notation pane */}
            <div
              className="flex min-h-0 min-w-0 flex-col bg-[hsl(0_0%_5.5%)]"
              style={{
                flex: `${100 - split} 1 0`,
                borderLeft: isRow ? '1px solid hsl(var(--border))' : 'none',
                borderTop: isRow ? 'none' : '1px solid hsl(var(--border))',
              }}
            >
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-gradient-to-b from-[hsl(0_0%_8%)] to-[hsl(0_0%_6.5%)] px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-primary">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(30_85%_55%/0.7)]" />
                    PlaySense Studio
                  </div>
                  <div className="mt-1 truncate font-heading text-[13.5px] font-bold tracking-tight">
                    {score.title || 'Notation'}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground">
                    {meta}
                  </div>
                </div>
                <OrientationToggle value={orient} onChange={setOrient} />
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
                {tracksEl}
                {staffEl}
                {scrubEl}
              </div>
            </div>
          </div>

          {/* Single diagonal corner knob — resizes split + height together. */}
          <button
            type="button"
            onMouseDown={startKnob}
            onTouchStart={startKnob}
            onDoubleClick={resetSize}
            aria-label="Resize"
            title="Drag to adjust the split and height · double-click to reset"
            className={[
              'absolute z-[12] grid h-[30px] w-[30px] place-items-center rounded-full border bg-[hsl(0_0%_14%)] text-[hsl(0_0%_60%)] shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-colors hover:border-primary hover:bg-primary hover:text-white',
              isRow ? 'cursor-[nwse-resize]' : 'cursor-[ns-resize]',
              knobDragging ? 'border-primary bg-primary text-white' : 'border-white/10',
            ].join(' ')}
            style={
              isRow
                ? { left: `${split}%`, bottom: -15, transform: 'translateX(-50%)' }
                : { top: `${split}%`, right: -15, transform: 'translateY(-50%)' }
            }
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: isRow ? 'rotate(45deg)' : 'rotate(90deg)' }}
            >
              <polyline points="7 5 2 12 7 19" />
              <polyline points="17 5 22 12 17 19" />
            </svg>
          </button>
        </div>

        {clipsEl}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videoEl}
      {transportEl}
      {tracksEl}
      <div className="bg-card border border-border rounded-lg p-4 overflow-hidden space-y-3">
        {staffEl}
        {scrubEl}
      </div>
      {clipsEl}
    </div>
  );
}

// Icon-only orientation toggle: side-by-side ↔ stacked.
function OrientationToggle({
  value,
  onChange,
}: {
  value: 'row' | 'column';
  onChange: (v: 'row' | 'column') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-border bg-[hsl(0_0%_10%)] p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange('row')}
        title="Side by side"
        aria-label="Side by side"
        className={`grid h-[30px] w-8 place-items-center rounded-full transition-colors ${
          value === 'row'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Columns2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('column')}
        title="Stacked"
        aria-label="Stacked"
        className={`grid h-[30px] w-8 place-items-center rounded-full transition-colors ${
          value === 'column'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Rows2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeMap construction
// ---------------------------------------------------------------------------

function buildTimeMap(
  score: ScoreDocument,
  trackIndex: number,
  payload: PlaysenseStudioPlayerTimeMap | null,
  videoDurationSeconds: number
): WaypointTimeMap | null {
  // 1) Real waypoints provided by an authored TimeMap (from M7 sync tools).
  if (payload && payload.waypoints.length >= 2) {
    const waypoints: Waypoint[] = payload.waypoints.map((w) => ({
      musicalPositionQN: w.musicalPositionQN,
      videoTimeSeconds: w.videoTimeSeconds,
      measureNumber: w.measureNumber,
      beatInMeasure: w.beatInMeasure,
    }));
    return new WaypointTimeMap(payload.id, payload.method as SyncMethod, waypoints);
  }

  // 2) Synthesized default — assume the video plays at the score's tempo.
  //    The score's first event is at video t=0; the score's last beat is at
  //    either (a) the video's actual duration if known, or (b) the score's
  //    tempo-derived duration. Whichever is larger to avoid clamping.
  const track = score.tracks[trackIndex];
  if (!track || track.measures.length === 0) return null;

  const totalQN = trackDurationQN(track, score);
  if (totalQN <= 0) return null;

  const tempoBasedSeconds = qnToTrackMs(track, score, totalQN) / 1000;
  const endVideoSeconds =
    videoDurationSeconds > 0
      ? Math.max(videoDurationSeconds, tempoBasedSeconds)
      : tempoBasedSeconds;

  if (endVideoSeconds <= 0) return null;

  const waypoints: Waypoint[] = [
    {
      musicalPositionQN: 0,
      videoTimeSeconds: 0,
      measureNumber: track.measures[0].number,
      beatInMeasure: 1,
    },
    {
      musicalPositionQN: totalQN,
      videoTimeSeconds: endVideoSeconds,
      measureNumber: track.measures[track.measures.length - 1].number,
      beatInMeasure: 1,
    },
  ];

  return new WaypointTimeMap('synthetic', 'tempo', waypoints);
}
