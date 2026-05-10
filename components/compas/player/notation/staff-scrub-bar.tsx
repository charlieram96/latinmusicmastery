'use client';

// Compás staff scrub bar — drag to scroll the staff view independently of
// playback. The orange line on the staff stays anchored to playbackMs and
// gets clipped if the user scrubs away from it.
//
// The bar shows:
//   • A track for the full piece length
//   • A draggable thumb at viewMs
//   • A small playhead pip at playbackMs (so you know where playback is
//     even when you've scrolled away)
//   • A "Follow" button to re-couple the view to playback.

import { Crosshair } from 'lucide-react';

interface StaffScrubBarProps {
  durationMs: number;
  viewMs: number;
  playbackMs: number;
  /** Whether the view is currently following playback. */
  isFollowing: boolean;
  onScrub: (viewMs: number) => void;
  onFollow: () => void;
}

export function StaffScrubBar({
  durationMs,
  viewMs,
  playbackMs,
  isFollowing,
  onScrub,
  onFollow,
}: StaffScrubBarProps) {
  const safeDuration = Math.max(durationMs, 1);
  const playbackPct = Math.min(100, Math.max(0, (playbackMs / safeDuration) * 100));

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={1}
          value={Math.min(viewMs, safeDuration)}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="w-full accent-secondary"
          aria-label="Scroll staff"
        />
        {/* Pip showing actual playback position on the bar. Pure visual cue;
            it doesn't intercept clicks. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${playbackPct}%` }}
        >
          <div className="w-0.5 h-3 bg-primary opacity-80" />
        </div>
      </div>
      <button
        onClick={onFollow}
        disabled={isFollowing}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition ${
          isFollowing
            ? 'bg-primary/10 text-primary border-primary/30 cursor-default'
            : 'border-border hover:bg-muted'
        }`}
        title={isFollowing ? 'View follows playback' : 'Snap view back to playhead'}
      >
        <Crosshair className="w-3.5 h-3.5" />
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
