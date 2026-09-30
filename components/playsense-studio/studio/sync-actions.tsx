'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';

// PlaySense Studio — the left rail's Sync status actions (Studio layout pass,
// Task 4). Everything that USED to live in the waveform's context bar and
// isn't specific to the waveform lane itself: placement, the click anchor,
// re-analyze (+ its decode progress) and, for a graded part, the count-in /
// pre-roll / "notes on a hit" readout. Rendered into the inspector portal.
import type { ReactNode } from 'react';
import { AudioLines, Undo2 } from 'lucide-react';

export interface SyncActionsProps {
  /** `PlaceScoreControl`, moved as-is — the caller keeps owning the import. */
  placeControl: ReactNode;
  anchor?: { onSet: () => void };
  autoPlaceUndo?: () => void;
  graded?: {
    countInBars: 1 | 2;
    onCountIn: (n: 1 | 2) => void;
    preroll: boolean;
    onPreroll: () => void;
    onHit: { k: number; n: number } | null;
  };
  reanalyze: { onClick: () => void; state: 'idle' | 'loading' | 'ready' | 'error'; progress: number };
  notices: string[];
}

export function SyncActions(p: SyncActionsProps) {
  const st = useStudioText();
  return (
    <div className="flex flex-col gap-2.5">
      {p.placeControl}

      {/* The anchor can't conflict with anything, so unlike placement it needs
          no arm/confirm step — one click sets it at the playhead. */}
      {p.anchor && (
        <button
          type="button"
          onClick={p.anchor.onSet}
          className="st-chip block"
          title={st("Mark this moment as a beat, so the student's click locks to the recording")}
        >
          <AudioLines className="h-4 w-4" />
          {st("Anchor at playhead")}</button>
      )}

      {p.autoPlaceUndo && (
        <button type="button" onClick={p.autoPlaceUndo} className="st-chip block" title={st("Put the bars back where they were")}>
          <Undo2 className="h-4 w-4" />
          {st("Undo auto-place")}</button>
      )}

      {p.graded && (
        <>
          <span className="st-sec-label">{st("Count-in")}</span>
          <div className="st-seg" role="radiogroup" aria-label={st("Count-in")}>
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={p.graded!.countInBars === n}
                className={p.graded!.countInBars === n ? 'is-on' : ''}
                onClick={() => p.graded!.onCountIn(n)}
              >
                {st(n === 1 ? '1 bar' : '2 bars')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={p.graded.onPreroll}
            className={`st-chip block${p.graded.preroll ? ' is-on' : ''}`}
            aria-pressed={p.graded.preroll}
            title={st("Play the video through the count-in, instead of waiting at bar 1")}
          >
            {st("Pre-roll video")}</button>
          {p.graded.onHit && (
            <span className="text-xs tabular-nums text-muted-foreground" role="status">
              {p.graded.onHit.k}/{p.graded.onHit.n} {st("notes on a hit")}</span>
          )}
        </>
      )}

      {p.reanalyze.state === 'loading' ? (
        <span className="text-xs text-muted-foreground">
          {st(p.reanalyze.progress >= 1
            ? 'Processing audio…'
            : `Downloading audio… ${p.reanalyze.progress > 0 ? `${Math.round(p.reanalyze.progress * 100)}%` : ''}`)}
        </span>
      ) : (
        <button
          type="button"
          onClick={p.reanalyze.onClick}
          className="st-chip block"
          title={
            st(p.reanalyze.state === 'idle'
              ? 'Analyze audio — decode this video so the waveform appears'
              : p.reanalyze.state === 'error'
                ? 'Retry audio analysis'
                : 'Re-analyze audio')
          }
        >
          <AudioLines className="h-4 w-4" />
          {st(p.reanalyze.state === 'idle' ? 'Analyze audio' : p.reanalyze.state === 'error' ? 'Retry analysis' : 'Re-analyze')}
        </button>
      )}

      {p.notices.map((notice, i) => (
        <span key={i} className="text-xs text-muted-foreground" role="status">
          {st(notice)}
        </span>
      ))}
    </div>
  );
}
