'use client';

// PlaySense Studio — video-anchored transport clock.
//
// The clock follows an HTMLVideoElement: it listens to the video's events
// (timeupdate/seeking/seeked/play/pause/ratechange/loadedmetadata/ended)
// and RAF-interpolates between timeupdate ticks (which fire at ~4-5 Hz on
// most browsers — too coarse for smooth cursor motion alone).
//
// The video is the source of truth. play/pause/seek/setRate methods on the
// returned clock mutate the video; the resulting events flow back into clock
// state. This avoids two-way sync drift.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface VideoTransportClock {
  currentSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  durationSeconds: number;
  isReady: boolean;
  play: () => Promise<void> | void;
  pause: () => void;
  toggle: () => Promise<void> | void;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  /** Imperative read. Useful inside RAF loops without a React subscription. */
  getCurrentSeconds: () => number;

  // A/B loop
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  setLoopA: (seconds: number | null) => void;
  setLoopB: (seconds: number | null) => void;
  setLoopEnabled: (enabled: boolean) => void;
  clearLoop: () => void;
  /** Apply both endpoints + enabled in one call (used when loading a saved clip). */
  loadLoop: (a: number, b: number, options?: { rate?: number }) => void;
}

const MIN_RATE = 0.25;
const MAX_RATE = 4;

export function useVideoTransportClock(
  videoRef: RefObject<HTMLVideoElement | null>,
  options?: { onEnded?: () => void }
): VideoTransportClock {
  // Keep the callback in a ref so the wiring effect never re-binds listeners
  // when the parent passes a fresh closure.
  const onEndedRef = useRef(options?.onEnded);
  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  });
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const [loopA, setLoopAState] = useState<number | null>(null);
  const [loopB, setLoopBState] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabledState] = useState(false);

  // Anchor: wall-clock time + video time at the most recent video event.
  // While playing, currentSeconds = anchorVideoSec + (now - anchorWall) * rate.
  const anchorWallRef = useRef(0);
  const anchorVideoRef = useRef(0);
  const isPlayingRef = useRef(false);
  const rateRef = useRef(1);
  const durationRef = useRef(0);
  const currentRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Loop refs read from the RAF loop without re-binding tick on each change.
  const loopARef = useRef<number | null>(null);
  const loopBRef = useRef<number | null>(null);
  const loopEnabledRef = useRef(false);

  const reanchor = useCallback((video: HTMLVideoElement) => {
    anchorWallRef.current = performance.now();
    anchorVideoRef.current = video.currentTime;
    currentRef.current = video.currentTime;
    setCurrentSeconds(video.currentTime);
  }, []);

  const startRaf = useCallback(() => {
    if (rafIdRef.current !== null) return;
    const tick = () => {
      if (!isPlayingRef.current) {
        rafIdRef.current = null;
        return;
      }
      const elapsedSec = (performance.now() - anchorWallRef.current) / 1000;
      const interpolated = anchorVideoRef.current + elapsedSec * rateRef.current;
      const clamped = Math.min(interpolated, durationRef.current || interpolated);

      // Loop wrap. We do this BEFORE publishing the time so the cursor
      // never visibly overshoots. Pre-seek a hair before B isn't necessary
      // here since RAF sees the actual instantaneous time and the seek is
      // synchronous on the video element.
      if (
        loopEnabledRef.current &&
        loopBRef.current !== null &&
        loopARef.current !== null &&
        clamped >= loopBRef.current
      ) {
        const video = videoRef.current;
        if (video) {
          video.currentTime = loopARef.current;
        }
        // Optimistic: reflect immediately. The seeking event will reanchor
        // the wall clock.
        currentRef.current = loopARef.current;
        setCurrentSeconds(loopARef.current);
      } else {
        currentRef.current = clamped;
        setCurrentSeconds(clamped);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [videoRef]);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Track the underlying element in state so the wiring effect re-runs when the
  // video mounts LATE — e.g. rendered through a React portal a render after the
  // hook's owner mounted (the studio inspector does exactly this). A no-dep
  // effect polls the ref each commit; the updater bails when the element is
  // unchanged, so no extra renders once it's bound.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    setVideoEl((prev) => (prev === videoRef.current ? prev : videoRef.current));
  });

  // Wire video element events.
  useEffect(() => {
    const video = videoEl;
    if (!video) return;

    const onLoadedMetadata = () => {
      durationRef.current = video.duration || 0;
      setDurationSeconds(video.duration || 0);
      setIsReady(true);
      reanchor(video);
    };
    const onTimeUpdate = () => reanchor(video);
    const onSeeking = () => reanchor(video);
    const onSeeked = () => reanchor(video);
    const onPlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
      reanchor(video);
      startRaf();
    };
    const onPause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopRaf();
      reanchor(video);
    };
    const onEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopRaf();
      reanchor(video);
      onEndedRef.current?.();
    };
    const onRateChange = () => {
      rateRef.current = video.playbackRate;
      setPlaybackRateState(video.playbackRate);
      reanchor(video);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('ratechange', onRateChange);

    // If metadata is already loaded, fire the initial sync right away.
    if (video.readyState >= 1) onLoadedMetadata();

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('ratechange', onRateChange);
      stopRaf();
    };
  }, [videoEl, reanchor, startRaf, stopRaf]);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    return video.play();
  }, [videoRef]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    return video.paused ? video.play() : video.pause();
  }, [videoRef]);

  const seek = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(seconds, durationRef.current || seconds));
      video.currentTime = clamped;
      // Optimistically reflect — seeking event will reanchor immediately too.
      currentRef.current = clamped;
      setCurrentSeconds(clamped);
    },
    [videoRef]
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.max(MIN_RATE, Math.min(rate, MAX_RATE));
      video.playbackRate = clamped;
    },
    [videoRef]
  );

  const getCurrentSeconds = useCallback(() => currentRef.current, []);

  // Loop setters — keep refs and React state in sync.
  const setLoopA = useCallback((seconds: number | null) => {
    loopARef.current = seconds;
    setLoopAState(seconds);
  }, []);
  const setLoopB = useCallback((seconds: number | null) => {
    loopBRef.current = seconds;
    setLoopBState(seconds);
  }, []);
  const setLoopEnabled = useCallback((enabled: boolean) => {
    loopEnabledRef.current = enabled;
    setLoopEnabledState(enabled);
  }, []);
  const clearLoop = useCallback(() => {
    loopARef.current = null;
    loopBRef.current = null;
    loopEnabledRef.current = false;
    setLoopAState(null);
    setLoopBState(null);
    setLoopEnabledState(false);
  }, []);
  const loadLoop = useCallback(
    (a: number, b: number, options: { rate?: number } = {}) => {
      loopARef.current = a;
      loopBRef.current = b;
      loopEnabledRef.current = true;
      setLoopAState(a);
      setLoopBState(b);
      setLoopEnabledState(true);
      const video = videoRef.current;
      if (video) {
        video.currentTime = a;
        if (options.rate !== undefined) {
          video.playbackRate = options.rate;
        }
      }
    },
    [videoRef]
  );

  return {
    currentSeconds,
    isPlaying,
    playbackRate,
    durationSeconds,
    isReady,
    play,
    pause,
    toggle,
    seek,
    setPlaybackRate,
    getCurrentSeconds,
    loopA,
    loopB,
    loopEnabled,
    setLoopA,
    setLoopB,
    setLoopEnabled,
    clearLoop,
    loadLoop,
  };
}
