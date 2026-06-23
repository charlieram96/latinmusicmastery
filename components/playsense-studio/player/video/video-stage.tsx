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
import { forwardRef, useState } from 'react';

interface VideoStageProps {
  src: string;
  poster?: string;
  className?: string;
  /**
   * Called after the user dismisses the tap-to-play overlay. Use this to
   * trigger play() (we cannot call it ourselves — must come from the gesture
   * the user already made on the overlay).
   */
  onFirstPlay?: () => void;
}

export const VideoStage = forwardRef<HTMLVideoElement, VideoStageProps>(
  function VideoStage({ src, poster, className, onFirstPlay }, ref) {
    const [hasPlayed, setHasPlayed] = useState(false);

    const handleOverlayClick = () => {
      setHasPlayed(true);
      onFirstPlay?.();
    };

    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className ?? ''}`}>
        <video
          ref={ref}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          className="w-full h-full block"
        />
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
