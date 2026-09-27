'use client';

// PlaySense Studio — "Place score at playhead" control (video-mode sync).
//
// Two-step placement: arming shows a live ghost of where the score's measures
// would land (spanning the score's duration at its own tempo — set once, in the
// score settings); Confirm lays them down, Cancel disarms. The ghost/conflict
// state is owned by SyncPanel, which knows the sibling sections' ranges.

import { MapPin, Check, X } from 'lucide-react';

export interface PlaceScoreControlProps {
  armed: boolean;
  /** The armed ghost overlaps a sibling section — Confirm is blocked. */
  conflict: boolean;
  /** e.g. "0:12.4 – 0:31.8" while armed. */
  spanLabel: string | null;
  onArm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlaceScoreControl({
  armed,
  conflict,
  spanLabel,
  onArm,
  onConfirm,
  onCancel,
}: PlaceScoreControlProps) {
  if (!armed) {
    return (
      <button
        type="button"
        onClick={onArm}
        className="st-chip"
        title="Preview where the score's measures will land at the playhead, sized by the tempo in the score settings"
      >
        <MapPin className="h-4 w-4" />
        Place score at playhead
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onConfirm}
        disabled={conflict}
        className="st-chip is-on"
        title={conflict ? 'This spot overlaps another scored section — scrub to a free part of the video' : 'Lay the measures down here'}
      >
        <Check className="h-4 w-4" />
        Confirm
      </button>
      <button type="button" onClick={onCancel} className="st-chip" title="Cancel placement">
        <X className="h-4 w-4" />
        Cancel
      </button>
      {spanLabel && (
        <span
          className={`font-mono text-xs tabular-nums ${conflict ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {conflict ? 'overlaps · ' : ''}
          {spanLabel}
        </span>
      )}
    </div>
  );
}
