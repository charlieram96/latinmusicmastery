'use client';

// Binds ClickTrack to a <video>, so the click lands on the recording's beats.
//
// Listens to the ELEMENT, not to useVideoTransportClock, for the same reason
// use-backing-mixer does: the clock's state is React state, so `isPlaying` lags
// a render and `currentSeconds` changes every frame, whereas scheduling needs
// the synchronous event where video.currentTime and ctx.currentTime can be read
// back-to-back. The clock's A/B loop wrap arrives here for free, since it is
// implemented by assigning video.currentTime.
//
// The rule that matters, copied deliberately:
//   seeking / waiting / stalled / pause / ended -> TEAR DOWN, schedule nothing
//   play / playing / seeked / ratechange        -> SCHEDULE, tear nothing down
// Inverting those is the classic "audio never comes back after a seek" bug.
//
// The structural rule that keeps it that way: the effect that binds media
// listeners depends on [videoEl] and NOTHING else. Every volatile input (grid,
// enabled, volume, offset) goes through its own effect calling an imperative
// setter. That is what the old chronometer got wrong -- its run effect listed
// `effectiveBpm`, so it tore the metronome down and restarted it on every
// tempo change, which reset the phase on every section crossing.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ClickTrack } from '@/lib/playsense-studio/click-track';

/** Correct above this much error. Tighter than the backing mixer's 80ms: that
 *  corrects by restarting a sustained stream, which is audible, while a click
 *  re-anchors silently between beats. */
const DRIFT_TOLERANCE_SECONDS = 0.025;
const DRIFT_CHECK_MS = 500;
const RESYNC_THROTTLE_MS = 500;
/** video.currentTime is frame-quantised, so a single sample is noisy. */
const DRIFT_SAMPLES = 5;

/** A cheap key over EVERY beat, rounded to the millisecond: a flex edit moves
 *  interior beats only, so length + ends alone would miss it (FNV-1a). */
export function clickGridKey(grid: readonly number[]): string {
  let h = 0x811c9dc5;
  for (const t of grid) {
    const ms = Math.round(t * 1000);
    h = Math.imul(h ^ (ms & 0xffff), 0x01000193);
    h = Math.imul(h ^ ((ms >>> 16) & 0xffff), 0x01000193);
  }
  return `${grid.length}:${(h >>> 0).toString(36)}`;
}

export function useVideoClickTrack(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Beat times in MEDIA seconds. Empty = nothing to play. */
  grid: readonly number[];
  enabled: boolean;
  volume?: number;
  /** Nudge for the offset between the element's audio path and the context's. */
  offsetSeconds?: number;
}) {
  const { videoRef, grid, enabled, volume = 0.2, offsetSeconds = 0 } = options;

  const trackRef = useRef<ClickTrack | null>(null);
  if (trackRef.current === null && typeof window !== 'undefined') {
    trackRef.current = new ClickTrack();
  }

  // The element mounts late through a portal, so poll the ref each commit; the
  // updater bails when unchanged, so this costs nothing once bound.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    setVideoEl((prev) => (prev === videoRef.current ? prev : videoRef.current));
  });

  // ---- Volatile inputs, each through its own imperative setter -----------
  const gridKey = clickGridKey(grid);
  useEffect(() => {
    trackRef.current?.setGrid(grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey]);

  useEffect(() => {
    trackRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    trackRef.current?.setOffsetSeconds(offsetSeconds);
  }, [offsetSeconds]);

  // ---- Transport wiring: depends on [videoEl, enabled] only ---------------
  useEffect(() => {
    const track = trackRef.current;
    const video = videoEl;
    if (!track || !video) return;

    if (!enabled) {
      track.teardown();
      return;
    }

    let lastResyncAt = 0;
    const samples: number[] = [];

    const schedule = () => {
      track.start(video.currentTime, video.playbackRate);
      samples.length = 0;
      lastResyncAt = Date.now();
    };

    const resumeThenSchedule = () => {
      const ctx = track.ensureContext();
      // Toggling the click on, and pressing play, are both real user gestures --
      // the only reliable place to lift the autoplay suspension.
      if (ctx.state !== 'running') void ctx.resume().then(schedule).catch(() => {});
      else schedule();
    };

    const onResume = () => {
      if (!video.paused) resumeThenSchedule();
    };
    const onTeardown = () => track.teardown();

    // Turning the click on mid-playback should start it immediately.
    if (!video.paused) resumeThenSchedule();

    video.addEventListener('play', resumeThenSchedule);
    video.addEventListener('playing', onResume);
    video.addEventListener('seeked', onResume);
    video.addEventListener('ratechange', onResume);
    video.addEventListener('pause', onTeardown);
    video.addEventListener('ended', onTeardown);
    video.addEventListener('seeking', onTeardown);
    video.addEventListener('waiting', onTeardown);
    video.addEventListener('stalled', onTeardown);

    const interval = setInterval(() => {
      if (video.paused || !track.isRunning) return;
      const error = track.drift(video.currentTime);
      if (error == null) return;
      samples.push(error);
      if (samples.length < DRIFT_SAMPLES) return;
      if (samples.length > DRIFT_SAMPLES) samples.shift();
      const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
      if (Math.abs(median) <= DRIFT_TOLERANCE_SECONDS) return;
      if (Date.now() - lastResyncAt < RESYNC_THROTTLE_MS) return;
      // Re-anchor, never restart: restarting resets the cursor and could replay
      // a beat we already fired.
      track.reanchor(video.currentTime, video.playbackRate);
      samples.length = 0;
      lastResyncAt = Date.now();
    }, DRIFT_CHECK_MS);

    // Timers are throttled while backgrounded, so the mapping goes stale even
    // though the element keeps playing.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !video.paused) schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      video.removeEventListener('play', resumeThenSchedule);
      video.removeEventListener('playing', onResume);
      video.removeEventListener('seeked', onResume);
      video.removeEventListener('ratechange', onResume);
      video.removeEventListener('pause', onTeardown);
      video.removeEventListener('ended', onTeardown);
      video.removeEventListener('seeking', onTeardown);
      video.removeEventListener('waiting', onTeardown);
      video.removeEventListener('stalled', onTeardown);
      track.teardown();
    };
  }, [videoEl, enabled]);

  // Close the context on unmount; a leaked one keeps the tab's audio alive.
  useEffect(
    () => () => {
      trackRef.current?.close();
      trackRef.current = null;
    },
    []
  );
}
