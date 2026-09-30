'use client';
import { useEffect, useState } from 'react';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


import { MeasurePopover, type PopoverAnchor } from './popover';

const COUNTS = [2, 3, 4, 6, 8];

export function RepeatPopover({ anchor, range, group, problemFor, onPick, onRemove, onSelectPassOne, onClose }: {
  anchor: PopoverAnchor; range: [number, number]; group: { id: string; count: number } | null;
  problemFor: (count: number) => string | null;
  onPick: (count: number) => void; onRemove: () => void; onSelectPassOne: () => void; onClose: () => void;
}) {
  const st = useStudioText();
  const [count, setCount] = useState(group?.count ?? 2);
  useEffect(() => { setCount(group?.count ?? 2); }, [range[0], range[1], group?.id, group?.count]);
  const problem = problemFor(count);

  const label = range[0] === range[1] ? `m.${range[0] + 1}` : `m.${range[0] + 1}–${range[1] + 1}`;
  return (
    <MeasurePopover
      anchor={anchor}
      title={st(group ? `${label} play ×${group.count}` : `Play ${label} more than once`)}
      hint="Each pass is written out, so it lines up with the recording on its own. An edit to any pass reaches every pass. Students see repeat signs."
      onClose={onClose}
    >
      <div className="st-mpop-row">
        {COUNTS.map((n) => {
          const problem = group?.count === n ? null : problemFor(n);
          return (
            <button key={n} type="button" className="st-mpop-chip" aria-pressed={count === n}
              title={st(problem ?? `Play ${n} times`)} onClick={() => setCount(n)}>
              {st("×")}{n}
            </button>
          );
        })}
      </div>
      <p className="st-mpop-row" aria-live="polite">{st(`Measures ${range[0] + 1}–${range[1] + 1}: ${count} total passes`)}</p>
      {problem && <p role="alert" className="st-mpop-hint">{st(problem)}</p>}
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-item" disabled={!!problem}
          onClick={() => { if (!problem) onPick(count); }}>{st("Apply")}</button>
        <button type="button" className="st-mpop-item" onClick={onClose}>{st("Cancel")}</button>
      </div>
      {group && (
        <div className="st-mpop-row">
          <button type="button" className="st-mpop-item" onClick={onRemove}>{st("✕ Remove repeat")}</button>
          <button type="button" className="st-mpop-item" onClick={onSelectPassOne}>{st("Select pass 1")}</button>
        </div>
      )}
    </MeasurePopover>
  );
}
