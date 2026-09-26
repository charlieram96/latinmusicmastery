'use client';

// The repeat lane: a 20 px band row over the strip, one band per pass. Pass 1
// says "Repeat ×N · K bars"; later passes are hatched "pass P of N". Clicking a
// band selects that pass and opens the repeat menu.

import { Repeat } from 'lucide-react';
import type { MeasureStripItem } from '../editable-measure-strip';
import type { PopoverAnchor } from './popover';

export const REP_H = 20;

export interface RepeatBand {
  id: string; pass: number; count: number; length: number;
  firstIndex: number; lastIndex: number; left: number; right: number;
}

export function repeatBands(items: MeasureStripItem[], toX: (t: number) => number): RepeatBand[] {
  const bands: RepeatBand[] = [];
  for (const item of items) {
    const r = item.repeatPass;
    if (!r) continue;
    const last = bands.at(-1);
    if (last && last.id === r.id && last.pass === r.pass) {
      last.lastIndex = item.measureIndex;
      last.right = toX(item.endVideoTimeSeconds);
    } else {
      bands.push({
        id: r.id, pass: r.pass, count: r.count, length: r.length,
        firstIndex: item.measureIndex, lastIndex: item.measureIndex,
        left: toX(item.startVideoTimeSeconds), right: toX(item.endVideoTimeSeconds),
      });
    }
  }
  return bands;
}

export function bandLabel(b: RepeatBand): string {
  const w = b.right - b.left;
  if (b.pass === 0) {
    if (w > 150) return `Repeat ×${b.count} · ${b.length} bar${b.length === 1 ? '' : 's'}`;
    return w > 60 ? `×${b.count}` : '';
  }
  if (w > 90) return `pass ${b.pass + 1} of ${b.count}`;
  return w > 40 ? `${b.pass + 1}/${b.count}` : '';
}

export function RepeatLane({ bands, onBandClick }: { bands: RepeatBand[]; onBandClick: (b: RepeatBand, anchor: PopoverAnchor) => void }) {
  return (
    <div className="st-replane" style={{ height: REP_H }}>
      {bands.map((b) => (
        <button
          key={`${b.id}-${b.pass}`}
          type="button"
          className={`st-rband${b.pass > 0 ? ' is-copy' : ''}`}
          style={{ left: b.left, width: Math.max(4, b.right - b.left) }}
          title={b.pass === 0 ? `These ${b.length} bar${b.length === 1 ? '' : 's'} play ${b.count} times` : `Pass ${b.pass + 1} of ${b.count}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onBandClick(b, { left: b.left + 8, top: REP_H + 4 }); }}
        >
          {b.pass === 0 && b.right - b.left > 60 && <Repeat className="h-3 w-3 shrink-0" />}
          <span className="truncate">{bandLabel(b)}</span>
        </button>
      ))}
    </div>
  );
}
