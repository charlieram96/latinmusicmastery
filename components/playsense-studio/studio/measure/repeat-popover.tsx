'use client';

import { MeasurePopover, type PopoverAnchor } from './popover';

const COUNTS = [2, 3, 4, 6, 8];

export function RepeatPopover({ anchor, range, group, problemFor, onPick, onRemove, onSelectPassOne, onClose }: {
  anchor: PopoverAnchor; range: [number, number]; group: { id: string; count: number } | null;
  problemFor: (count: number) => string | null;
  onPick: (count: number) => void; onRemove: () => void; onSelectPassOne: () => void; onClose: () => void;
}) {
  const label = range[0] === range[1] ? `m.${range[0] + 1}` : `m.${range[0] + 1}–${range[1] + 1}`;
  return (
    <MeasurePopover
      anchor={anchor}
      title={group ? `${label} play ×${group.count}` : `Play ${label} more than once`}
      hint="Each pass is written out, so it lines up with the recording on its own. An edit to any pass reaches every pass. Students see repeat signs."
      onClose={onClose}
    >
      <div className="st-mpop-row">
        {COUNTS.map((n) => {
          const problem = group?.count === n ? null : problemFor(n);
          return (
            <button key={n} type="button" className="st-mpop-chip" aria-pressed={group?.count === n}
              disabled={!!problem} title={problem ?? `Play ${n} times`} onClick={() => onPick(n)}>
              ×{n}
            </button>
          );
        })}
      </div>
      {group && (
        <div className="st-mpop-row">
          <button type="button" className="st-mpop-item" onClick={onRemove}>✕ Remove repeat</button>
          <button type="button" className="st-mpop-item" onClick={onSelectPassOne}>Select pass 1</button>
        </div>
      )}
    </MeasurePopover>
  );
}
