'use client';

// PlaySense Studio — "Import at playhead" control (video-mode sync).
//
// A VIDEO lesson has no single tempo: the teacher mostly talks, and only short
// passages are actually played. So instead of seeding a global grid, the admin
// scrubs to where a passage starts, types that passage's tempo, and imports —
// the score's measures are laid down starting at the playhead, then dragged to
// align. (Replaces the old tempo-grid / fit-to-audio / tap-along seeders.)

import { useState } from 'react';
import { Download } from 'lucide-react';

export interface ImportAtPlayheadControlProps {
  initialBpm: number;
  /** True when the admin has dragged markers — importing overwrites them. */
  hasEdits: boolean;
  /** Read the video's current time (seconds) — the import anchor. */
  getCurrentSeconds: () => number;
  /** Lay the score's measures from `offsetSeconds`, spaced at `bpm`. */
  onImport: (bpm: number, offsetSeconds: number) => void;
}

export function ImportAtPlayheadControl({
  initialBpm,
  hasEdits,
  getCurrentSeconds,
  onImport,
}: ImportAtPlayheadControlProps) {
  const [bpm, setBpm] = useState(initialBpm);

  const handleImport = () => {
    if (bpm <= 0) return;
    if (
      hasEdits &&
      !window.confirm('Importing re-lays the measures from the playhead and replaces your dragged positions. Continue?')
    ) {
      return;
    }
    onImport(bpm, getCurrentSeconds());
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tempo (BPM)</span>
        <input
          type="number"
          min={20}
          max={320}
          step={0.5}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value) || 0)}
          className="w-24 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums"
        />
      </label>
      <button
        onClick={handleImport}
        title="Scrub the video to where this passage starts, set its tempo, then import: the measures land starting at the playhead. Drag to fine-tune."
        className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition hover:opacity-90"
      >
        <Download className="h-4 w-4" />
        Import at playhead
      </button>
      <p className="max-w-md text-xs text-muted-foreground">
        Scrub to where the passage starts, set its tempo, then import. The video has no single
        tempo — import each played section separately and drag the measures to align.
      </p>
    </div>
  );
}
