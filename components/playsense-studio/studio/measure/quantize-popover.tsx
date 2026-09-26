'use client';

// The Quantize ▾ popover (Plan 4b, Task 7): pulls the recording's detected
// hits toward the written notes' onsets by a chosen strength, with a live
// preview before anything is written. `plan` is a pure preview — it never
// touches the score's flex; only Apply does, via `onApply`.

import { useState } from 'react';
import { MeasurePopover, type PopoverAnchor } from './popover';

export function QuantizePopover({ anchor, plan, onApply, onReset, onClose }: {
  anchor: PopoverAnchor;
  /** A live preview for a candidate strength (0–100). Called on every render
   *  (including slider drags), so it must be cheap and side-effect free. */
  plan: (strength: number) => { moved: number; largestMs: number };
  onApply: (strength: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [strength, setStrength] = useState(70);
  const { moved, largestMs } = plan(strength);
  const preview = moved > 0 ? `${moved} notes will move, largest ${largestMs} ms` : 'No notes to move';
  return (
    <MeasurePopover anchor={anchor} title="Quantize to the score" onClose={onClose}>
      <div className="st-mpop-row">
        <span>Strength</span>
        <input
          type="range"
          min={0}
          max={100}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          aria-label="Strength"
        />
        <span className="font-mono tabular-nums">{strength}%</span>
      </div>
      <p className="st-mpop-row">{preview}</p>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-item" onClick={() => onApply(strength)}>Apply</button>
        <button type="button" className="st-mpop-item" onClick={onReset}>Reset flex</button>
      </div>
    </MeasurePopover>
  );
}
