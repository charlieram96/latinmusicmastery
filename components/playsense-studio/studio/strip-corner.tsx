'use client';
// PlaySense Studio — the strip's corner tools (mockup .corner): the staff /
// piano-roll switch, Record MIDI and "add a measure at the end". They used
// to fill a whole row above the staff.
import { Music, Piano, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export function StripCorner({ tab, onTab, midi, onAddEnd, addEndProblem }: {
  tab: 'staff' | 'piano-roll'; onTab: (t: 'staff' | 'piano-roll') => void;
  midi: ReactNode; onAddEnd: () => void; addEndProblem: string | null;
}) {
  return (
    <div className="st-strip-corner">
      <div className="st-seg" role="radiogroup" aria-label="View">
        <button type="button" role="radio" aria-label="Staff" aria-checked={tab === 'staff'} className={tab === 'staff' ? 'is-on' : ''} onClick={() => onTab('staff')} title="Staff"><Music className="h-3.5 w-3.5" /></button>
        <button type="button" role="radio" aria-label="Piano-roll" aria-checked={tab === 'piano-roll'} className={tab === 'piano-roll' ? 'is-on' : ''} onClick={() => onTab('piano-roll')} title="Piano-roll"><Piano className="h-3.5 w-3.5" /></button>
      </div>
      {midi}
      <button type="button" className="st-iconbtn" aria-label="Add a measure at the end" disabled={!!addEndProblem}
        title={addEndProblem ?? 'Add a measure at the end'} onClick={onAddEnd}><Plus className="h-4 w-4" /></button>
    </div>
  );
}
