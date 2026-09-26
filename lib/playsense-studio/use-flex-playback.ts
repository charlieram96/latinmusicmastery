'use client';

// Flex Time (spec §7): the rate driver. Turns a FlexMap + the student's speed
// menu into the video element's actual playbackRate, frame by frame while
// playing. The transport itself still shows userSpeed — this hook only
// drives the element, never the UI.
import { useEffect, useRef, type RefObject } from 'react';
import { FlexMap } from './flex';

const WRITE_EPS = 1e-3;
const ELEMENT_RATE_MIN = 0.25;
const ELEMENT_RATE_MAX = 4;

/** Pure: the element rate for a media time. */
export function flexElementRate(map: FlexMap, media: number, userSpeed: number): number {
  const rate = userSpeed * map.rateAtMedia(media);
  return Math.min(ELEMENT_RATE_MAX, Math.max(ELEMENT_RATE_MIN, rate));
}

type PitchPreservingVideo = HTMLVideoElement & {
  webkitPreservesPitch?: boolean;
  mozPreservesPitch?: boolean;
};

/**
 * Drives video.playbackRate from rAF while playing; sets preservesPitch.
 * No-op when map.isIdentity (then it sets rate = userSpeed once).
 */
export function useFlexPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  map: FlexMap,
  userSpeed: number
): void {
  const mapRef = useRef(map);
  const userSpeedRef = useRef(userSpeed);
  const rafRef = useRef<number | null>(null);
  // Set by the wiring effect below; re-invoked whenever map/userSpeed change
  // so an identity map keeps tracking userSpeed and a map that stops being
  // identity mid-playback picks the loop back up without waiting for a play
  // event.
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    mapRef.current = map;
    userSpeedRef.current = userSpeed;
    syncRef.current();
  }, [map, userSpeed]);

  useEffect(() => {
    const video = videoRef.current as PitchPreservingVideo | null;
    if (!video) return;

    const setPreservesPitch = (on: boolean) => {
      video.preservesPitch = on;
      if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = on;
      if ('mozPreservesPitch' in video) video.mozPreservesPitch = on;
    };

    const applyRate = (rate: number) => {
      if (Math.abs(video.playbackRate - rate) > WRITE_EPS) video.playbackRate = rate;
    };

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const tick = () => {
      if (video.paused) {
        rafRef.current = null;
        return;
      }
      applyRate(flexElementRate(mapRef.current, video.currentTime, userSpeedRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(tick);
    };

    const sync = () => {
      if (mapRef.current.isIdentity) {
        stopLoop();
        applyRate(userSpeedRef.current);
        return;
      }
      setPreservesPitch(true);
      if (video.paused) stopLoop();
      else startLoop();
    };
    syncRef.current = sync;

    const onPlay = () => sync();
    const onPause = () => stopLoop();

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    sync();

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      stopLoop();
      syncRef.current = () => {};
    };
  }, [videoRef]);
}
