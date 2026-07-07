'use client';

// PlaySense Studio VideoStage — bare HTML5 <video> with native controls suppressed.
//
// All transport interaction goes through the parent (PlaysenseStudioPlayer) which
// holds the ref and drives play/pause/seek. The stage is just the visual
// surface.
//
// On mobile Safari, the first play() call must come from a user gesture.
// We render a tap-to-play overlay before the first interaction; once the
// user taps, we hand control back to the transport bar.

import { Play } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt';

interface VideoStageProps {
  src: string;
  poster?: string;
  className?: string;
  /** Subtitle tracks rendered as <track> children; the parent's
      useSubtitleTracks hook drives which one is showing. */
  tracks?: SubtitleTrackDef[];
  /**
   * Called after the user dismisses the tap-to-play overlay. Use this to
   * trigger play() (we cannot call it ourselves — must come from the gesture
   * the user already made on the overlay).
   */
  onFirstPlay?: () => void;
}

export const VideoStage = forwardRef<HTMLVideoElement, VideoStageProps>(
  function VideoStage({ src, poster, className, tracks, onFirstPlay }, ref) {
    const [hasPlayed, setHasPlayed] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Merge our local ref with the forwarded ref so the parent still drives
    // play/seek while we can attach our own listeners.
    const setVideoRef = useCallback(
      (node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    // Hide the overlay once playback actually begins — from any source
    // (overlay tap, transport bar, or keyboard), not just the overlay click.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      const onPlay = () => setHasPlayed(true);
      video.addEventListener('play', onPlay);
      return () => video.removeEventListener('play', onPlay);
    }, []);

    const handleOverlayClick = () => {
      setHasPlayed(true);
      onFirstPlay?.();
    };

    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className ?? ''}`}>
        <video
          ref={setVideoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          crossOrigin={tracks && tracks.length > 0 ? 'anonymous' : undefined}
          className="w-full h-full block"
        >
          {tracks?.map((t) => (
            <track key={t.src} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} />
          ))}
        </video>
        {!hasPlayed && (
          <button
            type="button"
            onClick={handleOverlayClick}
            className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 backdrop-blur-[2px] transition hover:bg-black/30"
            aria-label="Play video"
          >
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.6)] ring-1 ring-white/15 transition-transform duration-150 group-hover:scale-105 group-hover:bg-primary group-active:scale-95">
              <Play className="ml-1 h-8 w-8" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    );
  }
);
