'use client';

// Compás top-level player.
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { TransportBar } from './transport/transport-bar';
import { VideoStage } from './video/video-stage';
import {
  StaffRenderer,
  type SelectedRange,
} from './notation/renderers/staff-renderer';
import { StaffScrubBar } from './notation/staff-scrub-bar';
import { ClipsPanel } from './clips/clips-panel';
import { useVideoTransportClock } from './state/use-video-transport-clock';
import { logCompasEvent, type CompasClip } from '@/app/actions/compas';
import {
  WaypointTimeMap,
  type SyncMethod,
  type Waypoint,
} from '@/components/compas/shared/time-map/time-map';
import { qnToTrackMs, trackDurationQN } from '@/lib/compas/time-mapping';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';
import type { SeekTarget } from '@/lib/compas/renderer';
import { updateClassItemPosition } from '@/app/actions/progress';

export interface CompasPlayerScoreTrack {
  id: string;
  trackIndex: number;
  instrument: string;
  displayName: string;
  tuning: string[] | null;
  stringMultiplicity: number;
  defaultView: string | null;
}

export interface CompasPlayerTimeMap {
  id: string;
  method: string;
  waypoints: Array<{
    musicalPositionQN: number;
    videoTimeSeconds: number;
    measureNumber: number | null;
    beatInMeasure: number | null;
  }>;
}

export interface CompasPlayerProps {
  classItemId: string;
  videoUrl: string;
  posterUrl?: string;
  score: ScoreDocument;
  tracks: CompasPlayerScoreTrack[];
  activeTimeMap: CompasPlayerTimeMap | null;
  /** When true, cursor + render proceed but the position-tracking server action is skipped. */
  readOnly?: boolean;
}

const POSITION_SAVE_INTERVAL_MS = 5000;

export function CompasPlayer({
  classItemId,
  videoUrl,
  posterUrl,
  score,
  tracks,
  activeTimeMap,
  readOnly,
}: CompasPlayerProps) {
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
      void logCompasEvent({
        eventType: 'compas_view_switched',
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
      void logCompasEvent({
        eventType: 'compas_seek_via_notation',
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
  // logCompasEvent so they can't block the UI.
  const sentLoadedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    if (sentLoadedRef.current) return;
    sentLoadedRef.current = true;
    void logCompasEvent({
      eventType: 'compas_player_loaded',
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
      void logCompasEvent({
        eventType: 'compas_play',
        classItemId,
        metadata: { from_seconds: clock.currentSeconds, rate: clock.playbackRate },
      });
    }
    wasPlayingRef.current = clock.isPlaying;
  }, [clock.isPlaying, clock.currentSeconds, clock.playbackRate, classItemId, readOnly]);

  return (
    <div className="space-y-4">
      <VideoStage
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl}
        className="aspect-video"
        onFirstPlay={() => clock.play()}
      />

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

      {tracks.length > 1 && (
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
      )}

      <div className="bg-card border border-border rounded-lg p-4 overflow-hidden space-y-3">
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

        {trackDurationMs > 0 && (
          <StaffScrubBar
            durationMs={trackDurationMs}
            viewMs={viewMs}
            playbackMs={cursorMs}
            isFollowing={isFollowing}
            onScrub={handleStaffScrub}
            onFollow={handleFollow}
          />
        )}
      </div>

      {!readOnly && (
        <ClipsPanel
          classItemId={classItemId}
          loopA={clock.loopA}
          loopB={clock.loopB}
          playbackRate={clock.playbackRate}
          onLoadClip={(clip: CompasClip) => {
            clock.loadLoop(clip.startSeconds, clip.endSeconds, {
              rate: clip.playbackRate,
            });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeMap construction
// ---------------------------------------------------------------------------

function buildTimeMap(
  score: ScoreDocument,
  trackIndex: number,
  payload: CompasPlayerTimeMap | null,
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
