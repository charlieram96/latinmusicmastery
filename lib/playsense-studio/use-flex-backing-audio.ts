'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MixerClipInput } from '@/components/playsense-studio/player/state/use-backing-mixer';
import { mixHeadroom } from './mix-headroom';
import { FlexMap } from './flex';

/** The same media-time transform drives the reference and linked stems.
 * Independent stems run on the musical timeline. Browser stretching preserves pitch. */
export function backingFlexPosition(media: number, rate: number, map: FlexMap, linked: boolean) {
  return { seconds: linked ? media : map.toTimeline(media), rate: linked ? rate : rate / map.rateAtMedia(media) };
}

export function useFlexBackingAudio(options: {
  active: boolean; videoRef: RefObject<HTMLVideoElement | null>; map: FlexMap;
  clips: MixerClipInput[]; linked: ReadonlySet<string>; enabled: ReadonlySet<string>;
  levels: Record<string, number>; suspended: boolean;
  usable: {startSeconds:number;endSeconds:number};
}) {
  const latest = useRef(options); latest.current = options;
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const blocked = useRef(new Set<string>());
  const waiting = useRef(false);
  const pending = useRef(new Set<string>());
  const lastSeek = useRef(new Map<string, number>());
  const urls = options.clips.map(c => `${c.id}:${c.url}`).join('|');
  useEffect(() => {
    if (!options.active) return;
    const owned = new Map<string, HTMLAudioElement>();
    for (const clip of latest.current.clips) {
      const audio = new Audio(clip.url);
      audio.preload = 'auto'; audio.preservesPitch = true;
      owned.set(clip.id, audio);
    }
    elements.current = owned;
    setFailedIds(new Set()); blocked.current.clear(); lastSeek.current.clear(); waiting.current = false;
    return () => {
      for (const audio of owned.values()) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      elements.current = new Map(); pending.current.clear();
    };
  }, [options.active, urls]);

  const sync = useCallback(() => {
    const o = latest.current; const video = o.videoRef.current;
    if (!video) return;
    const headroom = mixHeadroom(o.clips.map(clip => clip.id), o.enabled, o.levels);
    for (const clip of o.clips) {
      const audio = elements.current.get(clip.id); if (!audio) continue;
      const clock = backingFlexPosition(video.currentTime, video.playbackRate, o.map, o.linked.has(clip.id));
      const target = clip.trimInSeconds + clock.seconds - clip.timelineStartSeconds;
      const end = clip.trimOutSeconds ?? audio.duration;
      const volume = Math.max(0, Math.min(1, o.levels[clip.id] ?? 1)) * headroom;
      if (audio.volume !== volume) audio.volume = volume;
      audio.muted = !o.enabled.has(clip.id);
      if (o.suspended || waiting.current || video.paused || video.ended || video.seeking || video.currentTime < o.usable.startSeconds || video.currentTime >= o.usable.endSeconds || target < clip.trimInSeconds || target >= end) { audio.pause(); continue; }
      if (audio.readyState === 0 || audio.seeking || pending.current.has(clip.id)) continue;
      const drift = target - audio.currentTime;
      const now = performance.now();
      const hardSeek = audio.paused || (Math.abs(drift) > .25 && now - (lastSeek.current.get(clip.id) ?? -Infinity) > 1000);
      if (hardSeek) {
        audio.currentTime = Math.max(0, target);
        lastSeek.current.set(clip.id, now);
      }
      // Repeated seeks flush the MP3 decoder and sound like crackling. Nudge
      // small clock errors without discontinuities, preserving pitch.
      const correction = hardSeek || Math.abs(drift) < .02 ? 1 : 1 + Math.max(-.02, Math.min(.02, drift * .1));
      const nextRate = Math.max(.25, Math.min(4, clock.rate * correction));
      if (Math.abs(audio.playbackRate - nextRate) > .001) audio.playbackRate = nextRate;
      if (audio.paused && !pending.current.has(clip.id) && !blocked.current.has(clip.id)) {
        pending.current.add(clip.id);
        void audio.play().then(() => {
          if (elements.current.get(clip.id) !== audio) return;
          const now = latest.current;
          if (now.videoRef.current?.paused || now.suspended || waiting.current) audio.pause();
          setFailedIds(prev => { if (!prev.has(clip.id)) return prev; const next = new Set(prev); next.delete(clip.id); return next; });
        }).catch(() => {
          if (elements.current.get(clip.id) !== audio) return;
          blocked.current.add(clip.id);
          setFailedIds(prev => prev.has(clip.id) ? prev : new Set([...prev, clip.id]));
        })
          .finally(() => { if (elements.current.get(clip.id) === audio) pending.current.delete(clip.id); });
      }
    }
  }, []);
  useEffect(() => {
    if (!options.active) return;
    let frame = 0;
    const tick = () => { sync(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    const video = options.videoRef.current;
    const pause = () => { waiting.current = true; for (const audio of elements.current.values()) audio.pause(); };
    const resume = () => {waiting.current = false; blocked.current.clear(); sync();};
    video?.addEventListener('waiting', pause);
    // Download stalls can occur while buffered video continues playing.
    // Only `waiting` means its playback clock actually stopped.
    video?.addEventListener('playing', resume);
    video?.addEventListener('seeked', resume);
    video?.addEventListener('play', resume);
    video?.addEventListener('pause', sync);
    video?.addEventListener('seeking', sync);
    return () => { cancelAnimationFrame(frame); video?.removeEventListener('play', resume); video?.removeEventListener('waiting', pause); video?.removeEventListener('playing', resume); video?.removeEventListener('seeked', resume); video?.removeEventListener('pause', sync); video?.removeEventListener('seeking', sync); };
  }, [options.active, options.videoRef, sync]);
  return { failedIds, unlock: () => { blocked.current.clear(); sync(); } };
}
