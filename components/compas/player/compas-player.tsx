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
import { StaffRenderer } from './notation/renderers/staff-renderer';
import { TabRenderer } from './notation/renderers/tab-renderer';
import { FretboardRenderer } from './notation/renderers/fretboard-renderer';
import { RhythmGridRenderer } from './notation/renderers/rhythm-grid-renderer';
import {
  ViewSwitcher,
  usePersistedView,
  viewsForInstrument,
} from './notation/view-switcher';
import { useVideoTransportClock } from './state/use-video-transport-clock';
import {
  WaypointTimeMap,
  type SyncMethod,
  type Waypoint,
} from '@/components/compas/shared/time-map/time-map';
import { qnToTrackMs, trackDurationQN } from '@/lib/compas/time-mapping';
import type {
  DefaultView,
  Instrument,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';
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
  const activeInstrument = activeTrack.instrument as Instrument;

  const trackDefaultView: DefaultView =
    (activeTrack.defaultView as DefaultView | undefined) ??
    viewsForInstrument(activeInstrument)[0];
  const [view, setView] = usePersistedView(activeInstrument, trackDefaultView);

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

  // Click-on-notation → seek video.
  const handleSeek = (target: SeekTarget) => {
    if (!timeMap) return;
    const seconds = timeMap.toVideoTime(target.qn);
    clock.seek(seconds);
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
      />

      <div className="flex flex-wrap items-center gap-3">
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

        <ViewSwitcher
          instrument={activeInstrument}
          defaultView={trackDefaultView}
          value={view}
          onChange={setView}
          className="ml-auto"
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        {view === 'staff' && (
          <StaffRenderer
            score={score}
            trackIndex={activeTrackIndex}
            currentMs={cursorMs}
            onSeek={handleSeek}
          />
        )}
        {view === 'tab' && (
          <TabRenderer
            score={score}
            trackIndex={activeTrackIndex}
            currentMs={cursorMs}
            onSeek={handleSeek}
          />
        )}
        {view === 'fretboard' && (
          <FretboardRenderer
            score={score}
            trackIndex={activeTrackIndex}
            currentMs={cursorMs}
          />
        )}
        {view === 'rhythm-grid' && (
          <RhythmGridRenderer
            score={score}
            trackIndex={activeTrackIndex}
            currentMs={cursorMs}
          />
        )}
      </div>
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
