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
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition cursor-pointer group"
            aria-label="Play video"
          >
            <span className="w-16 h-16 rounded-full bg-primary/90 group-hover:bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition">
              <Play className="w-8 h-8 ml-1" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
    );
  }
);
