'use client';

// Flex Time (spec §7): the rate driver. Turns a FlexMap + the student's speed
// menu into the video element's actual playbackRate, frame by frame while
// playing. The transport itself still shows userSpeed — this hook only
// drives the element, never the UI.
import { useEffect, useRef, useState, type RefObject } from 'react';
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

// The element's own pitch-preservation values from just before this hook
// first wrote any of them. The browser default is `true`, not `false` — so
// "turn flex off" must restore whatever was actually there, not force a
// hardcoded value, or an unflexed section loses pitch preservation for good
// the first time playback passes through a flexed one (fix round 2).
type PitchSnapshot = {
  preservesPitch: boolean;
  webkitPreservesPitch?: boolean;
  mozPreservesPitch?: boolean;
};

// Module-level (not a closure inside the hook) so `video` is an ordinary
// parameter rather than a value captured from `useState` — the repo's React
// Compiler lint rule (react-hooks/immutability) flags a captured state value
// being mutated directly, even for a DOM element that's inherently mutated
// imperatively; a plain parameter doesn't trip it.

/** Turns pitch preservation on, recording the element's own prior values the
 *  first time (per element) this hook touches them at all. Later calls are
 *  a no-op on the snapshot: it must stay the value from BEFORE this hook's
 *  very first write, not get overwritten by its own `true`. */
function setFlexPitch(video: PitchPreservingVideo, priorPitchRef: { current: PitchSnapshot | null }): void {
  if (priorPitchRef.current === null) {
    const snapshot: PitchSnapshot = { preservesPitch: video.preservesPitch };
    if ('webkitPreservesPitch' in video) snapshot.webkitPreservesPitch = video.webkitPreservesPitch;
    if ('mozPreservesPitch' in video) snapshot.mozPreservesPitch = video.mozPreservesPitch;
    priorPitchRef.current = snapshot;
  }
  video.preservesPitch = true;
  if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
  if ('mozPreservesPitch' in video) video.mozPreservesPitch = true;
}

// Fix round 1, issue #2: when the driver turns off (or the element binds
// late while already off), undo anything a still-running instance may have
// left on the element — a stale segment rate and/or preservesPitch — so a
// caller whose own rate wiring takes back over (e.g. clock.playbackRate)
// sees userSpeed, not whatever flexed segment was last playing. Without
// this, the leftover rate also keeps re-triggering the element's own
// `ratechange` event, so a listener like useVideoTransportClock's would keep
// showing the stale value in the transport too.
//
// Fix round 2: the pitch part now restores the exact snapshot `setFlexPitch`
// recorded, rather than hardcoding `false` — this is the single reset path
// for both the "enabled flips to false" and "map goes back to identity"
// cases, so there's nowhere else pitch preservation can be reset wrong.
// Nothing is touched if this hook never wrote a pitch property in the first
// place (`priorPitchRef.current` stays `null`).
function resetToUserSpeed(
  video: PitchPreservingVideo,
  userSpeed: number,
  priorPitchRef: { current: PitchSnapshot | null }
): void {
  const prior = priorPitchRef.current;
  if (prior) {
    priorPitchRef.current = null;
    video.preservesPitch = prior.preservesPitch;
    if (prior.webkitPreservesPitch !== undefined) video.webkitPreservesPitch = prior.webkitPreservesPitch;
    if (prior.mozPreservesPitch !== undefined) video.mozPreservesPitch = prior.mozPreservesPitch;
  }
  if (Math.abs(video.playbackRate - userSpeed) > WRITE_EPS) {
    video.playbackRate = userSpeed;
  }
}

/**
 * Drives video.playbackRate from rAF while playing; sets preservesPitch.
 * No-op when map.isIdentity (then it sets rate = userSpeed once).
 *
 * `enabled` (default true) lets a caller with no Flex Time at all keep this
 * hook mounted (rules of hooks: it must be called unconditionally) while
 * guaranteeing it never touches the video element — not even the identity
 * branch's one-time `rate = userSpeed` write. That write would otherwise
 * fight a caller's own, pre-existing `clock.playbackRate` wiring the next
 * time the video plays.
 */
export function useFlexPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  map: FlexMap,
  userSpeed: number,
  enabled = true
): void {
  const mapRef = useRef(map);
  const userSpeedRef = useRef(userSpeed);
  const rafRef = useRef<number | null>(null);
  // Null until this hook actually writes a pitch property on the current
  // video, so a map that starts (and stays) identity never touches the
  // property at all; once set, it holds the element's own values from just
  // before that first write, for resetToUserSpeed to restore exactly.
  const priorPitchRef = useRef<PitchSnapshot | null>(null);
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

  // Track the underlying element in state so the wiring effect re-runs when
  // the video mounts LATE — e.g. rendered through a React portal a render
  // after this hook's owner mounted (SyncPanel's floating PiP does exactly
  // this). A no-dep effect polls the ref each commit; the updater bails when
  // the element is unchanged, so no extra renders once it's bound. Mirrors
  // use-video-transport-clock.ts.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    setVideoEl((prev) => (prev === videoRef.current ? prev : videoRef.current));
  });

  useEffect(() => {
    const video = videoEl as PitchPreservingVideo | null;
    if (!video) return;

    if (!enabled) {
      resetToUserSpeed(video, userSpeedRef.current, priorPitchRef);
      return;
    }

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
        resetToUserSpeed(video, userSpeedRef.current, priorPitchRef);
        return;
      }
      setFlexPitch(video, priorPitchRef);
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
  }, [videoEl, enabled]);
}
