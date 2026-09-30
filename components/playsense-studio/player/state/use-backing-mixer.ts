'use client';

// Binds BackingMixer to the studio's reference <video>.
//
// It listens to the ELEMENT directly rather than to useVideoTransportClock,
// deliberately: the clock's state is React state, so `isPlaying` lags a render
// and `currentSeconds` changes every frame. Scheduling needs the synchronous
// event, where video.currentTime and ctx.currentTime can be read back-to-back.
// A useful side effect is that the clock's A/B loop wrap (which works by
// assigning video.currentTime) arrives here as an ordinary seek, for free.
//
// The one rule that matters:
//   seeking / waiting            -> TEAR DOWN, schedule nothing
//   seeked  / playing            -> SCHEDULE, tear nothing down
// Mixing those up is the classic "audio never comes back after a seek" bug.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { BackingMixer, type MixerClip } from '@/lib/playsense-studio/backing-mixer';
import { loadClipAudio } from '@/lib/playsense-studio/clip-audio-cache';
import type { UsableRegion } from '@/lib/playsense-studio/clip-schedule';

export interface MixerClipInput {
  id: string;
  url: string;
  timelineStartSeconds: number;
  trimInSeconds: number;
  trimOutSeconds: number | null;
}

/** Resync no more than this often, so a stuttering video can't machine-gun. */
const RESYNC_THROTTLE_MS = 500;
const DRIFT_CHECK_MS = 500;
/** Median filter width - video.currentTime is frame-quantised, so it is noisy. */
const DRIFT_SAMPLES = 5;

export function useBackingMixer(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  clips: MixerClipInput[];
  enabled: ReadonlySet<string>;
  /** Authored per-track levels, 0..1. Separate from `enabled`, which is a
   *  transient audition mute. */
  levels?: Record<string, number>;
  usable: UsableRegion;
  /** True while a clip is being dragged. Re-cueing on every pointermove would
   *  restart the clip from a new offset dozens of times a second - a machine
   *  gun. Stop the dragged clip on grab, re-cue once on release. */
  suspended?: boolean;
}) {
  const { videoRef, clips, enabled, levels, usable, suspended = false } = options;

  const mixerRef = useRef<BackingMixer | null>(null);


  // Read by the ratechange listener, which only takes pitch preservation off
  // when there is backing to keep in key with the video.
  const hasClipsRef = useRef(clips.length > 0);
  useEffect(() => {
    hasClipsRef.current = clips.length > 0;
  }, [clips.length]);

  const [readyIds, setReadyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [retry, setRetry] = useState(0);
  const buffersRef = useRef(new Map<string, AudioBuffer>());

  // Create before all dependent effects, including React's setup/cleanup replay.
  useEffect(() => {
    const mixer = new BackingMixer();
    mixerRef.current = mixer;
    return () => {
      mixer.close();
      if (mixerRef.current === mixer) mixerRef.current = null;
      buffersRef.current.clear();
    };
  }, []);


  // The element mounts late (it is portalled), so poll the ref each commit the
  // way useVideoTransportClock does; the updater bails when unchanged.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    setVideoEl((prev) => (prev === videoRef.current ? prev : videoRef.current));
  });

  // ---- Decode ------------------------------------------------------------
  const urlsKey = clips.map((c) => `${c.id}:${c.url}`).join(' ');
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || clips.length === 0) return;
    let cancelled = false;
    setReadyIds(new Set());
    setFailedIds(new Set());
    const controller = new AbortController();

    void (async () => {
      const ctx = mixer.ensureContext();
      for (const clip of clips) {
        if (cancelled) return;
        try {
          const buffer = buffersRef.current.get(clip.url) ?? await loadClipAudio(ctx, clip.url, controller.signal);
          if (cancelled) return;
          buffersRef.current.set(clip.url, buffer);
          setReadyIds((prev) => {
            const next = new Set(prev);
            next.add(clip.id);
            return next;
          });
        } catch {
          if (!cancelled) setFailedIds(prev => new Set([...prev, clip.id]));
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, retry]);

  // ---- Keep the mixer's view of the clips current ------------------------
  const clipsKey = clips
    .map((c) => `${c.id}:${c.url}:${c.timelineStartSeconds}:${c.trimInSeconds}:${c.trimOutSeconds}`)
    .join(',');
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const resolved: MixerClip[] = [];
    for (const clip of clips) {
      const buffer = buffersRef.current.get(clip.url);
      if (!buffer) continue;
      resolved.push({
        id: clip.id,
        url: clip.url,
        buffer,
        timelineStartSeconds: clip.timelineStartSeconds,
        trimInSeconds: clip.trimInSeconds,
        trimOutSeconds: clip.trimOutSeconds,
        sourceDurationSeconds: buffer.duration,
      });
    }
    mixer.setClips(resolved);

    // Placement changed while playing: re-cue from a fresh anchor. Skipped
    // mid-drag; the release flips `suspended` and re-runs this effect.
    const video = videoRef.current;
    if (!suspended && mixer.isRunning && video && !video.paused) {
      mixer.start(video.currentTime, video.playbackRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipsKey, readyIds, suspended]);

  useEffect(() => {
    mixerRef.current?.setEnabled(enabled);
  }, [enabled]);

  // Volatile input, own effect, imperative setter — same rule as the rest.
  const levelsKey = levels
    ? Object.entries(levels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, v]) => `${id}:${v}`)
        .join(',')
    : '';
  useEffect(() => {
    mixerRef.current?.setLevels(levels ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey]);

  useEffect(() => {
    mixerRef.current?.setUsableRegion(usable);
  }, [usable.startSeconds, usable.endSeconds]);

  // ---- Transport wiring --------------------------------------------------
  useEffect(() => {
    const mixer = mixerRef.current;
    const video = videoEl;
    if (!mixer || !video) return;

    let lastResyncAt = 0;
    const samples: number[] = [];

    const restart = () => {
      if (video.paused || video.ended || video.seeking) return;
      mixer.start(video.currentTime, video.playbackRate);
      samples.length = 0;
      lastResyncAt = Date.now();
    };

    const onPlay = () => {
      const ctx = mixer.ensureContext();
      // This handler runs off a real user gesture (the transport button), the
      // only reliable place to lift the autoplay suspension.
      if (ctx.state !== 'running') void ctx.resume().then(() => { if (!mixer.isRunning) restart(); }).catch(() => {});
      else if (!mixer.isRunning) restart();
    };
    const onPause = () => mixer.teardown();
    const onTeardown = () => mixer.teardown();
    const onResume = () => {
      if (!video.paused && !mixer.isRunning) restart();
    };
    const onRateChange = () => {
      // AudioBufferSourceNode.playbackRate resamples (pitch moves) while the
      // element time-stretches by default. Turning preservesPitch off keeps the
      // video and the backing tracks in the same key - everything slows like
      // tape together, which is coherent; the alternative is a fifth apart.
      // With no backing there is nothing to keep in key, so the video keeps
      // whatever pitch setting its owner chose (the Studio's Loop speed).
      if (hasClipsRef.current) video.preservesPitch = false;
      if (!video.paused) restart();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('playing', onResume);
    video.addEventListener('seeked', onResume);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onTeardown);
    video.addEventListener('seeking', onTeardown);
    video.addEventListener('waiting', onTeardown);
    // A stalled download is not a stalled playback clock. `waiting` handles
    // actual buffer exhaustion; stopping here creates an artificial dropout.
    video.addEventListener('ratechange', onRateChange);
    // The portalled video may already be playing when this effect attaches.
    if (!video.paused && !video.ended) onPlay();

    // Drift: the dominant cause of audible desync is the element rebuffering
    // while the context keeps running, which the waiting/playing pair already
    // handles. This catches the slow residue.
    const interval = setInterval(() => {
      if (video.paused) return;
      const error = mixer.drift(video.currentTime);
      if (error == null) return;
      samples.push(error);
      if (samples.length < DRIFT_SAMPLES) return;
      if (samples.length > DRIFT_SAMPLES) samples.shift();
      const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
      if (Math.abs(median) <= BackingMixer.driftToleranceSeconds) return;
      if (Date.now() - lastResyncAt < RESYNC_THROTTLE_MS) return;
      restart();
    }, DRIFT_CHECK_MS);

    // RAF stops while backgrounded, so the clock and the audio can part ways.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !video.paused) restart();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onResume);
      video.removeEventListener('seeked', onResume);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onTeardown);
      video.removeEventListener('seeking', onTeardown);
      video.removeEventListener('waiting', onTeardown);

      video.removeEventListener('ratechange', onRateChange);
      mixer.teardown();
      try {
        video.preservesPitch = true;
      } catch {
        /* not supported */
      }
    };
  }, [videoEl]);

  return {
    /** Clips whose audio is decoded and can actually sound. */
    readyIds,
    failedIds,
    /** Call from an actual click: unmuting must also unlock browser audio. */
    unlock: () => {
      if (failedIds.size) setRetry(n => n + 1);
      const mixer=mixerRef.current;
      if (!mixer) return;
      const ctx=mixer.ensureContext();
      const resume=()=>{const video=videoRef.current;if(video && !video.paused && !video.ended && !mixer.isRunning)mixer.start(video.currentTime,video.playbackRate);};
      if(ctx.state !== 'running') void ctx.resume().then(resume).catch(()=>{});
      else resume();
    },
    /** Stop one clip while its handle is dragged; re-cue on release. */
    stopClip: (id: string) => mixerRef.current?.stopClip(id),
    rescheduleClip: (id: string) => mixerRef.current?.rescheduleClip(id),
  };
}
