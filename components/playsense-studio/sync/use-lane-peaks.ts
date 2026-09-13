'use client';

// PlaySense Studio — waveform peaks for the backing-track lanes.
//
// Same two-phase strategy the main waveform uses (sync-panel's entry probe):
// ask the cache for everything in parallel (a cheap fetch, no decode), then
// decode the misses. Three things differ, and each one is deliberate:
//
//   1. Decodes run ONE AT A TIME. N tracks means N whole-file fetches plus N
//      OfflineAudioContexts; doing that concurrently will stall a laptop.
//   2. They are HELD while the main waveform is still decoding, so lanes never
//      compete with the waveform the admin is actually waiting for.
//   3. Progress is reported per track, for a bar drawn INSIDE that lane row.
//      The main wave's "analyzing" scrim locks the whole panel; lanes must not.
//
// The decoded duration doubles as the source-length probe the clip model needs
// to clamp trims, so `onDurationProbed` fires with it rather than costing a
// second round-trip.

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WaveformPeaks } from '@/lib/playsense-studio/waveform';

export type LanePeaksStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LanePeaksEntry {
  status: LanePeaksStatus;
  peaks: WaveformPeaks | null;
  /** 0..1 during the network download; only meaningful while loading. */
  progress: number;
}

export interface LanePeaksTrack {
  id: string;
  audioUrl: string;
}

const EMPTY: LanePeaksEntry = { status: 'idle', peaks: null, progress: 0 };

export function lanePeaksEntry(
  map: Record<string, LanePeaksEntry>,
  trackId: string
): LanePeaksEntry {
  return map[trackId] ?? EMPTY;
}

export function useLanePeaks(options: {
  /** Cache namespace — the class item that owns these tracks. */
  ownerId: string;
  tracks: LanePeaksTrack[];
  /** Hold new decodes (e.g. while the main waveform is decoding). */
  paused?: boolean;
  onDurationProbed?: (trackId: string, durationSeconds: number) => void;
}): Record<string, LanePeaksEntry> {
  const { ownerId, tracks, paused = false } = options;

  const [entries, setEntries] = useState<Record<string, LanePeaksEntry>>({});

  // Identity of `tracks` changes every render; drive the effect off a value key
  // and read the array itself from a ref so a parent re-render can't restart
  // an in-flight decode.
  const tracksKey = tracks.map((t) => `${t.id}|${t.audioUrl}`).join(',');
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const onDurationProbedRef = useRef(options.onDurationProbed);
  onDurationProbedRef.current = options.onDurationProbed;

  // Which (track, url) pairs have already been resolved this session, so a
  // re-render or an unrelated track being added never re-decodes them.
  const settledRef = useRef(new Set<string>());

  useEffect(() => {
    if (paused) return;

    const pending = tracksRef.current.filter(
      (t) => t.audioUrl && !settledRef.current.has(`${t.id}|${t.audioUrl}`)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const controllers: AbortController[] = [];

    const patch = (trackId: string, next: Partial<LanePeaksEntry>) => {
      if (cancelled) return;
      setEntries((prev) => ({ ...prev, [trackId]: { ...(prev[trackId] ?? EMPTY), ...next } }));
    };

    void (async () => {
      let mod: typeof import('@/lib/playsense-studio/waveform-decode');
      try {
        // Browser-only (Web Audio); must not be evaluated during SSR.
        mod = await import('@/lib/playsense-studio/waveform-decode');
      } catch {
        return;
      }
      if (cancelled) return;
      const supabase = createClient();

      const settle = (track: LanePeaksTrack, peaks: WaveformPeaks) => {
        settledRef.current.add(`${track.id}|${track.audioUrl}`);
        patch(track.id, { status: 'ready', peaks, progress: 1 });
        if (peaks.durationSeconds > 0) {
          onDurationProbedRef.current?.(track.id, peaks.durationSeconds);
        }
      };

      // Phase 1 — parallel cache probe. No decode, so this is safe to fan out.
      const misses: LanePeaksTrack[] = [];
      await Promise.all(
        pending.map(async (track) => {
          patch(track.id, { status: 'loading', progress: 0 });
          try {
            const cached = await mod.loadCachedLanePeaks(ownerId, track.audioUrl, supabase);
            if (cancelled) return;
            if (cached) settle(track, cached);
            else misses.push(track);
          } catch {
            if (!cancelled) misses.push(track);
          }
        })
      );
      if (cancelled) return;

      // Phase 2 — decode the misses strictly one at a time.
      for (const track of misses) {
        if (cancelled) return;
        const controller = new AbortController();
        controllers.push(controller);
        try {
          const peaks = await mod.loadOrComputeLanePeaks(ownerId, track.audioUrl, supabase, {
            signal: controller.signal,
            onProgress: (fraction) => patch(track.id, { progress: fraction }),
          });
          if (cancelled) return;
          settle(track, peaks);
        } catch {
          if (cancelled) return;
          // Mark settled so a hopeless URL (CORS/codec) isn't retried forever —
          // the lane falls back to a flat bar and stays draggable.
          settledRef.current.add(`${track.id}|${track.audioUrl}`);
          patch(track.id, { status: 'error', peaks: null, progress: 0 });
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const controller of controllers) controller.abort();
    };
  }, [ownerId, tracksKey, paused]);

  return entries;
}
