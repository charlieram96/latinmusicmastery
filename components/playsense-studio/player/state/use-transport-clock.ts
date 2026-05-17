'use client';

// PlaySense Studio — RAF-driven transport clock.
//
// A wall-clock-anchored timeline that is decoupled from any audio source.
// In M2 this drives the staff renderer cursor against pure JS time. In M3
// the same hook is anchored to <video>.currentTime via timeupdate events,
// with RAF interpolation between ticks for sub-frame precision.
//
// The clock keeps `currentMs` in React state but exposes a getter ref for
// imperative code paths that don't want to subscribe to React updates.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface TransportClockOptions {
  /** Total duration of the piece in milliseconds. Loop wraps at this point. */
  durationMs: number;
  /** Whether to loop back to 0 when reaching duration. Defaults to false. */
  loop?: boolean;
}

export interface TransportClock {
  currentMs: number;
  isPlaying: boolean;
  playbackRate: number;
  durationMs: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number) => void;
  setPlaybackRate: (rate: number) => void;
  /** Imperative read — no React subscription. Useful inside RAF loops. */
  getCurrentMs: () => number;
}

const DEFAULT_RATE = 1;
const MIN_RATE = 0.1;
const MAX_RATE = 4;

export function useTransportClock(options: TransportClockOptions): TransportClock {
  const { durationMs, loop = false } = options;

  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(DEFAULT_RATE);

  // Refs that the RAF loop reads — avoids stale closure problems and
  // keeps the loop from re-binding on every render.
  const currentMsRef = useRef(0);
  const isPlayingRef = useRef(false);
  const rateRef = useRef(DEFAULT_RATE);
  const durationRef = useRef(durationMs);
  const loopRef = useRef(loop);

  // Anchor: the wall-clock time at which playback started or last resumed,
  // and the score-ms at that moment. While playing,
  //     currentMs = anchorMs + (now - anchorWall) * rate
  const anchorWallRef = useRef(0);
  const anchorMsRef = useRef(0);

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;
    const now = performance.now();
    let next = anchorMsRef.current + (now - anchorWallRef.current) * rateRef.current;

    if (next >= durationRef.current) {
      if (loopRef.current && durationRef.current > 0) {
        // Wrap to 0 with the overshoot rolled over.
        const overshoot = next - durationRef.current;
        next = overshoot;
        anchorMsRef.current = next;
        anchorWallRef.current = now;
      } else {
        next = durationRef.current;
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    }

    currentMsRef.current = next;
    setCurrentMs(next);

    if (isPlayingRef.current) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    if (currentMsRef.current >= durationRef.current) {
      // At the end — restart from beginning.
      currentMsRef.current = 0;
      setCurrentMs(0);
    }
    anchorWallRef.current = performance.now();
    anchorMsRef.current = currentMsRef.current;
    isPlayingRef.current = true;
    setIsPlaying(true);
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
  }, [play, pause]);

  const seek = useCallback((ms: number) => {
    const clamped = Math.max(0, Math.min(ms, durationRef.current));
    currentMsRef.current = clamped;
    setCurrentMs(clamped);
    if (isPlayingRef.current) {
      anchorWallRef.current = performance.now();
      anchorMsRef.current = clamped;
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const clamped = Math.max(MIN_RATE, Math.min(rate, MAX_RATE));
    if (isPlayingRef.current) {
      // Re-anchor so the speed change takes effect from "now" forward.
      const now = performance.now();
      anchorMsRef.current =
        anchorMsRef.current + (now - anchorWallRef.current) * rateRef.current;
      anchorWallRef.current = now;
    }
    rateRef.current = clamped;
    setPlaybackRateState(clamped);
  }, []);

  const getCurrentMs = useCallback(() => currentMsRef.current, []);

  // Cancel any pending RAF on unmount.
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return {
    currentMs,
    isPlaying,
    playbackRate,
    durationMs,
    play,
    pause,
    toggle,
    seek,
    setPlaybackRate,
    getCurrentMs,
  };
}
