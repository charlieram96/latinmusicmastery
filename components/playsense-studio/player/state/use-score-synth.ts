'use client';

// Binds ScoreSynth to a <video>, so the written notes sound against the
// recording (Hear: Score / Both). A copy of use-video-click-track's wiring,
// for the same reasons, and it keeps the same rules:
//   seeking / waiting / stalled / pause / ended -> TEAR DOWN, schedule nothing
//   play / playing / seeked / ratechange        -> SCHEDULE, tear nothing down
// (with smoothRateChanges, a ratechange on a running synth re-anchors), and the
// listener effect depends on [videoEl, enabled] only; notes and volume go
// through their own imperative setters.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ScoreSynth, type SynthNote } from '@/lib/playsense-studio/score-synth';

const DRIFT_TOLERANCE_SECONDS = 0.025;
const DRIFT_CHECK_MS = 500;
const RESYNC_THROTTLE_MS = 500;
const DRIFT_SAMPLES = 5;

/** A cheap key over every note's start and pitch (FNV-1a, starts to the ms). */
export function synthNotesKey(notes: readonly SynthNote[]): string {
  let h = 0x811c9dc5;
  for (const n of notes) {
    const ms = Math.round(n.start * 1000);
    const endMs = Math.round(n.end * 1000);
    for (const v of [ms & 0xffff, (ms >>> 16) & 0xffff, endMs & 0xffff, n.midi & 0xff, n.voice]) {
      h = Math.imul(h ^ v, 0x01000193);
    }
  }
  return `${notes.length}:${(h >>> 0).toString(36)}`;
}

export function useScoreSynth(options: {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** MEDIA seconds (toMediaNotes), sorted by start. */
  notes: readonly SynthNote[];
  enabled: boolean;
  volume?: number;
  /** As in useVideoClickTrack: re-anchor rather than restart on a flex rate change. */
  smoothRateChanges?: boolean;
}) {
  const { videoRef, notes, enabled, volume = 1, smoothRateChanges = false } = options;

  const synthRef = useRef<ScoreSynth | null>(null);
  if (synthRef.current === null && typeof window !== 'undefined') {
    synthRef.current = new ScoreSynth();
  }

  // The element mounts late through a portal, so poll the ref each commit.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    setVideoEl((prev) => (prev === videoRef.current ? prev : videoRef.current));
  });

  const notesKey = synthNotesKey(notes);
  useEffect(() => {
    synthRef.current?.setNotes([...notes]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesKey]);

  useEffect(() => {
    synthRef.current?.setVolume(volume);
  }, [volume]);

  const smoothRateRef = useRef(smoothRateChanges);
  useEffect(() => {
    smoothRateRef.current = smoothRateChanges;
  }, [smoothRateChanges]);

  useEffect(() => {
    const synth = synthRef.current;
    const video = videoEl;
    if (!synth || !video) return;

    if (!enabled) {
      synth.teardown();
      return;
    }

    let lastResyncAt = 0;
    const samples: number[] = [];

    const schedule = () => {
      synth.start(video.currentTime, video.playbackRate);
      samples.length = 0;
      lastResyncAt = Date.now();
    };

    const resumeThenSchedule = () => {
      const ctx = synth.ensureContext();
      // Choosing Score/Both and pressing play are user gestures: lift the
      // autoplay suspension here.
      if (ctx.state !== 'running') void ctx.resume().then(schedule).catch(() => {});
      else schedule();
    };

    const onResume = () => {
      if (!video.paused) resumeThenSchedule();
    };
    const onTeardown = () => synth.teardown();
    const onRateChange = () => {
      if (smoothRateRef.current && synth.isRunning && !video.paused) {
        synth.reanchor(video.currentTime, video.playbackRate);
        samples.length = 0;
        lastResyncAt = Date.now();
        return;
      }
      onResume();
    };

    if (!video.paused) resumeThenSchedule();

    video.addEventListener('play', resumeThenSchedule);
    video.addEventListener('playing', onResume);
    video.addEventListener('seeked', onResume);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('pause', onTeardown);
    video.addEventListener('ended', onTeardown);
    video.addEventListener('seeking', onTeardown);
    video.addEventListener('waiting', onTeardown);
    video.addEventListener('stalled', onTeardown);

    const interval = setInterval(() => {
      if (video.paused || !synth.isRunning) return;
      const error = synth.drift(video.currentTime);
      if (error == null) return;
      samples.push(error);
      if (samples.length < DRIFT_SAMPLES) return;
      if (samples.length > DRIFT_SAMPLES) samples.shift();
      const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
      if (Math.abs(median) <= DRIFT_TOLERANCE_SECONDS) return;
      if (Date.now() - lastResyncAt < RESYNC_THROTTLE_MS) return;
      synth.reanchor(video.currentTime, video.playbackRate);
      samples.length = 0;
      lastResyncAt = Date.now();
    }, DRIFT_CHECK_MS);

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
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('pause', onTeardown);
      video.removeEventListener('ended', onTeardown);
      video.removeEventListener('seeking', onTeardown);
      video.removeEventListener('waiting', onTeardown);
      video.removeEventListener('stalled', onTeardown);
      synth.teardown();
    };
  }, [videoEl, enabled]);

  // Close the context on unmount; a leaked one keeps the tab's audio alive.
  useEffect(
    () => () => {
      synthRef.current?.close();
      synthRef.current = null;
    },
    []
  );
}
