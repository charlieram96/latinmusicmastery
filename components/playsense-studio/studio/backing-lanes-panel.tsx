'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — stateful owner of the backing-track lanes.
//
// Holds the clip list, persists placement, and owns the (ephemeral) audition
// set and the studio mixer. Lives under components/ rather than in the route
// directory so it may import server actions directly — the route-dir files pass
// data down instead (see exercise-studio.tsx's Turbopack note).
//
// Two separate ideas per lane, multiplied in the mixer:
//   level   -- the balance the admin authors, persisted per track and shipped
//              to students as the mix
//   enabled -- an ephemeral audition mute, so you can listen past a track
// Muting to hear what is underneath must never destroy the level you set.

import { AlertCircle, Loader2, Volume2, VolumeX, Link2, Unlink } from 'lucide-react';
import { FlexMap } from '@/lib/playsense-studio/flex';
import { useFlexBackingAudio } from '@/lib/playsense-studio/use-flex-backing-audio';
const IDENTITY_FLEX = new FlexMap([]);
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackingLanes,
  LANE_H,
  type ClipDragPart,
  type LaneClip,
} from '@/components/playsense-studio/sync/backing-lanes';
import {
  lanePeaksEntry,
  useLanePeaks,
} from '@/components/playsense-studio/sync/use-lane-peaks';
import { useBackingMixer } from '@/components/playsense-studio/player/state/use-backing-mixer';
import {
  WaypointTimeMap,
  type SyncMethod,
} from '@/components/playsense-studio/shared/time-map/time-map';
import type { TimelineView } from '@/components/playsense-studio/studio/sync-panel';
import { normalizeClip, type Clip } from '@/lib/playsense-studio/clip-model';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import {
  updateBackingTrackDuration,
  updateBackingTrackGain,
  updateBackingTrackPlacement,
  type BackingTrack,
} from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';

const PLACEMENT_DEBOUNCE_MS = 600;
/** Most lanes we show before the stack scrolls vertically. */
const MAX_VISIBLE_LANES = 4;

export interface BackingLanesPanelProps {
  classItemId: string;
  tracks: BackingTrack[];
  /** The exercise video's active time map, for recording musical positions. */
  timeMap: PlaysenseStudioPlayerTimeMap | null;
  /** Graded owners (no time map): media seconds → quarter notes from bar 1,
   *  through the score's tempo grid. When given it is what position_qn records,
   *  and no time map id is stored. Undefined skips the position_qn write. */
  mediaToQN?: (mediaSeconds: number) => number | undefined;
  view: TimelineView;
}

export function BackingLanesPanel({
  classItemId,
  tracks,
  timeMap,
  mediaToQN,
  view,
}: BackingLanesPanelProps) {
  const st = useStudioText();
  const warp = view.flexMap ?? IDENTITY_FLEX;
  const warped = !warp.isIdentity;
  const linked = useMemo(() => new Set(view.backingFlexLinks ?? []), [view.backingFlexLinks]);
  // Clip state, seeded from the server rows and owned here from then on.
  const [clips, setClips] = useState<Record<string, Clip>>(() => seedClips(tracks));
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  // Non-null while a clip is under the pointer, so the mixer can hold off
  // re-cueing until the drag ends.
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  // Ephemeral: which tracks you're auditioning. Never persisted.
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(() => new Set());
  // Authored levels, seeded from the rows and owned here from then on.
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(tracks.map((t) => [t.id, t.gain ?? 1]))
  );

  // Adopt rows for tracks we haven't seen (added/removed in the rail panel)
  // without clobbering a clip the admin is mid-drag on.
  const trackKey = tracks.map((t) => t.id).join(',');
  useEffect(() => {
    setClips((prev) => {
      const next: Record<string, Clip> = {};
      let changed = false;
      for (const track of tracks) {
        if (prev[track.id]) next[track.id] = prev[track.id];
        else {
          next[track.id] = clipOf(track);
          changed = true;
        }
      }
      if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
      return next;
    });
    setEnabled((prev) => {
      const next = new Set([...prev].filter((id) => tracks.some((t) => t.id === id)));
      return next.size === prev.size ? prev : next;
    });
    setLevels((prev) => {
      const next: Record<string, number> = {};
      for (const track of tracks) next[track.id] = prev[track.id] ?? track.gain ?? 1;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  const map = useMemo(() => {
    if (!timeMap || timeMap.waypoints.length < 2) return null;
    try {
      return new WaypointTimeMap(timeMap.id, timeMap.method as SyncMethod, timeMap.waypoints);
    } catch {
      // Non-monotonic/duplicate waypoints — positions stay seconds-only.
      return null;
    }
  }, [timeMap]);

  const durationOf = useCallback(
    (track: BackingTrack) => durations[track.id] ?? track.sourceDurationSeconds ?? null,
    [durations]
  );

  // ---- Peaks --------------------------------------------------------------
  const onDurationProbed = useCallback(
    (trackId: string, durationSeconds: number) => {
      setDurations((prev) =>
        prev[trackId] === durationSeconds ? prev : { ...prev, [trackId]: durationSeconds }
      );
      const track = tracks.find((t) => t.id === trackId);
      if (track && track.sourceDurationSeconds == null) {
        // Fire-and-forget: the action only writes when the column is still null,
        // so it can never clobber a trim being edited right now.
        void updateBackingTrackDuration({ trackId, sourceDurationSeconds: durationSeconds });
      }
    },
    [tracks]
  );

  const peaks = useLanePeaks({
    ownerId: classItemId,
    tracks: tracks.map((t) => ({ id: t.id, audioUrl: t.audioUrl })),
    onDurationProbed,
  });

  // ---- Persistence --------------------------------------------------------
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  const persist = useCallback(
    (trackId: string) => {
      const clip = clipsRef.current[trackId];
      if (!clip) return;
      const track = tracks.find((t) => t.id === trackId);
      const sourceDurationSeconds = durations[trackId] ?? track?.sourceDurationSeconds ?? null;

      // Record what the position MEANT musically alongside where it sits, so a
      // later republish of the time map can keep the clip glued to the music
      // instead of silently sliding against it.
      // Graded owners measure it on the tempo grid from bar 1 instead.
      const positionQn = mediaToQN
        ? mediaToQN(clip.timelineStartSeconds)
        : map
          ? map.toMusicalPosition(clip.timelineStartSeconds)
          : null;

      void queueStudioSave(`backing-track:${trackId}`, () =>
        updateBackingTrackPlacement({
          trackId,
          timelineStartSeconds: clip.timelineStartSeconds,
          trimInSeconds: clip.trimInSeconds,
          trimOutSeconds: clip.trimOutSeconds,
          sourceDurationSeconds,
          positionQn,
          timeMapId: !mediaToQN && map ? map.id : null,
        })
      );
    },
    [tracks, durations, map, mediaToQN]
  );

  const schedulePersist = useCallback(
    (trackId: string) => {
      clearTimeout(timersRef.current[trackId]);
      timersRef.current[trackId] = setTimeout(() => persist(trackId), PLACEMENT_DEBOUNCE_MS);
    },
    [persist]
  );

  // Flush anything pending on unmount so a quick drag-then-navigate isn't lost.
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(
    () => () => {
      for (const [trackId, timer] of Object.entries(timersRef.current)) {
        clearTimeout(timer);
        persistRef.current(trackId);
      }
    },
    []
  );

  const handleClipChange = useCallback((trackId: string, next: Clip) => {
    setClips((prev) => ({ ...prev, [trackId]: next }));
  }, []);

  const handleClipCommit = useCallback(
    (trackId: string, _part: ClipDragPart, moved: boolean) => {
      setDraggingTrackId(null);
      if (moved) schedulePersist(trackId);
    },
    [schedulePersist]
  );

  // Levels persist on their own cadence — dragging a fader shouldn't re-send
  // position and trim, which is why this is a separate action.
  const gainTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const persistGain = useCallback((trackId: string) => {
    const gain = levelsRef.current[trackId];
    if (gain == null) return;
    void updateBackingTrackGain({ trackId, gain });
  }, []);

  const handleLevelChange = useCallback(
    (trackId: string, value: number) => {
      setLevels((prev) => ({ ...prev, [trackId]: value }));
      clearTimeout(gainTimersRef.current[trackId]);
      gainTimersRef.current[trackId] = setTimeout(() => persistGain(trackId), 400);
    },
    [persistGain]
  );

  const persistGainRef = useRef(persistGain);
  persistGainRef.current = persistGain;
  useEffect(
    () => () => {
      for (const [trackId, timer] of Object.entries(gainTimersRef.current)) {
        clearTimeout(timer);
        persistGainRef.current(trackId);
      }
    },
    []
  );



  // ---- Lane models --------------------------------------------------------
  const laneClips: LaneClip[] = useMemo(
    () =>
      tracks.map((track) => {
        const sourceDurationSeconds = durationOf(track);
        const entry = lanePeaksEntry(peaks, track.id);
        const clip = normalizeClip(clips[track.id] ?? clipOf(track), { sourceDurationSeconds });
        return {
          ...clip,
          trackId: track.id,
          warp: linked.has(track.id) ? warp : undefined,
          label: track.label,
          sourceDurationSeconds,
          peaks: entry.peaks,
          loading: entry.status === 'loading',
          progress: entry.progress,
          failed: entry.status === 'error',
          enabled: enabled.has(track.id),
        };
      }),
    [tracks, clips, peaks, enabled, durationOf, linked, warp]
  );

  // ---- Studio monitoring --------------------------------------------------
  // Slaved to the same <video> the waveform is drawn from, so what you line up
  // is what you hear. Binary audition only -- no faders, nothing persisted.
  const mixerClips = useMemo(
    () =>
      tracks.map((track) => {
        const clip = clips[track.id] ?? clipOf(track);
        return {
          id: track.id,
          url: track.audioUrl,
          timelineStartSeconds: clip.timelineStartSeconds,
          trimInSeconds: clip.trimInSeconds,
          trimOutSeconds: clip.trimOutSeconds,
        };
      }),
    [tracks, clips]
  );

  const mixer = useBackingMixer({
    videoRef: view.videoRef,
    clips: warped ? [] : mixerClips,
    enabled,
    levels,
    usable: view.usableRegion,
    suspended: draggingTrackId != null,
  });

  const flexAudio = useFlexBackingAudio({active:warped,usable:view.usableRegion,videoRef:view.videoRef,map:warp,clips:mixerClips,linked,enabled,levels,suspended:draggingTrackId != null});
  const playback = warped ? flexAudio : mixer;

  const toggleEnabled = useCallback((trackId: string) => {
    if (!enabled.has(trackId)) playback.unlock();
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, [enabled, playback]);

  // Dragging re-cues a clip from a new offset on every pointermove, which
  // sounds like a machine gun. Stop the dragged clip on grab, re-cue on release.
  const handleSelectForDrag = useCallback(
    (trackId: string) => {
      setSelectedTrackId(trackId);
      setDraggingTrackId(trackId);
      mixer.stopClip(trackId);
    },
    [mixer]
  );

  if (tracks.length === 0) return null;

  return (
    <div>
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1 text-xs">
      <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted" onClick={()=>setEnabled(new Set())}><VolumeX className="h-3.5 w-3.5"/>{st('Mute all MP3s')}</button>
      <button type="button" className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted" onClick={()=>{playback.unlock();setEnabled(new Set(tracks.map(t=>t.id)));}}><Volume2 className="h-3.5 w-3.5"/>{st('Enable all MP3s')}</button>
    </div>
    {view.onBackingFlexLinksChange && <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-1 text-xs">
      <span>{st("Link MP3s to video Flex")}</span>
      <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => view.onBackingFlexLinksChange?.(tracks.map(t => t.id))}>{st("Link all")}</button>
      <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => view.onBackingFlexLinksChange?.([])}>{st("Unlink all")}</button>
      {tracks.map(t => <button key={t.id} type="button" aria-pressed={linked.has(t.id)}
        className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted aria-pressed:text-primary"
        title={st(linked.has(t.id) ? "Follows video Flex" : "Independent timing")}
        onClick={() => {const next = new Set(linked); if(next.has(t.id))next.delete(t.id);else next.add(t.id);view.onBackingFlexLinksChange?.([...next]);}}>
        {linked.has(t.id) ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}{t.label}
      </button>)}
    </div>}
    <div
      className="st-backing-stack"
      style={{ maxHeight: MAX_VISIBLE_LANES * LANE_H }}
      aria-label={st("Backing tracks on the timeline")}
    >
      <BackingLanes
        clips={laneClips}
        pixelsPerSecond={view.pixelsPerSecond}
        scrollLeftPx={view.scrollLeftPx}
        selectedTrackId={selectedTrackId}
        snapTimes={view.snapTimes}
        getCurrentSeconds={view.getCurrentSeconds}
        isPlaying={view.isPlaying}
        onSelect={handleSelectForDrag}
        onClipChange={handleClipChange}
        onClipCommit={handleClipCommit}
        onScrollByPx={view.onScrollByPx}
        onZoomBy={view.onZoomBy}
      />

      {/* Audition toggles, pinned to the left gutter so they never move with
          the timeline. Keyboard-reachable; the canvas below is not. */}
      <div className="st-backing-toggles">
        {laneClips.map((clip) => (
          <div key={clip.trackId} className="st-backing-lane-controls" style={{ height: LANE_H }}>
            <button
              type="button"
              className={`st-backing-toggle${clip.enabled ? ' is-on' : ''}`}
              onClick={() => toggleEnabled(clip.trackId)}
              aria-pressed={clip.enabled}
              title={playback.failedIds?.has(clip.trackId) ? `${clip.label}: ${st('Audio could not load. Mute and unmute to retry.')}` : st(`${clip.enabled ? 'Mute' : 'Audition'} ${clip.label}`)}
            >
              {playback.failedIds?.has(clip.trackId) ? (
                <AlertCircle className="h-3 w-3 text-destructive" />
              ) : (clip.enabled && !warped && !mixer.readyIds?.has(clip.trackId)) ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : clip.enabled ? (
                <Volume2 className="h-3 w-3" />
              ) : (
                <VolumeX className="h-3 w-3" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={levels[clip.trackId] ?? 1}
              onChange={(e) => handleLevelChange(clip.trackId, Number(e.target.value))}
              className="st-backing-fader"
              aria-label={st(`${clip.label} level`)}
              title={st(`${clip.label} — ${Math.round((levels[clip.trackId] ?? 1) * 100)}%`)}
            />
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

const clipOf = (track: BackingTrack): Clip => ({
  timelineStartSeconds: track.timelineStartSeconds,
  trimInSeconds: track.trimInSeconds,
  trimOutSeconds: track.trimOutSeconds,
});

function seedClips(tracks: BackingTrack[]): Record<string, Clip> {
  const out: Record<string, Clip> = {};
  for (const track of tracks) out[track.id] = clipOf(track);
  return out;
}
