'use client';

// Compás — video-anchored transport clock.
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
}

const MIN_RATE = 0.25;
const MAX_RATE = 4;

export function useVideoTransportClock(
  videoRef: RefObject<HTMLVideoElement | null>
): VideoTransportClock {
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Anchor: wall-clock time + video time at the most recent video event.
  // While playing, currentSeconds = anchorVideoSec + (now - anchorWall) * rate.
  const anchorWallRef = useRef(0);
  const anchorVideoRef = useRef(0);
  const isPlayingRef = useRef(false);
  const rateRef = useRef(1);
  const durationRef = useRef(0);
  const currentRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

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
      currentRef.current = clamped;
      setCurrentSeconds(clamped);
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Wire video element events.
  useEffect(() => {
    const video = videoRef.current;
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
  }, [videoRef, reanchor, startRaf, stopRaf]);

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
  };
}
