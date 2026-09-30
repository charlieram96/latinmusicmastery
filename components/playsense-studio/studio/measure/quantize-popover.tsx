'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// The Quantize ▾ popover (Plan 4b, Task 7): pulls the recording's detected
// hits toward the written notes' onsets by a chosen strength, with a live
// preview before anything is written. `plan` is a pure preview — it never
// touches the score's flex; only Apply does, via `onApply`.

import { AudioLines, Check, RotateCcw } from 'lucide-react';
import { useState, useId } from 'react';
import { MeasurePopover, type PopoverAnchor } from './popover';

export function QuantizePopover({ anchor, plan, onApply, onReset, onClose, onUndo }: {
  anchor: PopoverAnchor;
  /** A live preview for a candidate strength (0–100). Called on every render
   *  (including slider drags), so it must be cheap and side-effect free. */
  plan: (strength: number, stepQN?: number) => { moved: number; largestMs: number };
  onApply: (strength: number, stepQN?: number) => void;
  onReset: () => void;
  onClose: () => void;
  onUndo?: () => void;
}) {
  const st = useStudioText();
  const strengthId = useId();
  const [strength, setStrength] = useState(70);
  const [grid, setGrid] = useState('score');
  const stepQN = grid === 'score' ? undefined : 4 / Number(grid.split(':')[1]) * (grid.startsWith('triplet:') ? 2/3 : 1);
  const { moved, largestMs } = plan(strength, stepQN);
  const preview = moved > 0 ? `${moved} notes will move, largest ${largestMs} ms` : 'No notes to move';
  return (
    <MeasurePopover floating anchor={anchor} title={st("Quantize to the score")} onClose={onClose} className="lmm-quantize-panel">
      <div className="lmm-quantize-body">
        <button type="button" className="lmm-quantize-score" aria-pressed={grid==='score'} onClick={()=>setGrid('score')}>
          <AudioLines size={16}/><span>{st('Score notes')}</span>{grid==='score' && <Check size={14}/>}
        </button>
        <div role="group" aria-label={st('Grid')} className="lmm-quantize-grids">
          {(['straight','triplet'] as const).map(mode=><div key={mode}>
            <div className="lmm-quantize-label">{st(mode==='straight'?'Straight':'Triplets')}{mode==='triplet' && <span className="lmm-quantize-triplet">3</span>}</div>
            <div className="lmm-quantize-values">{[4,8,16,32,64,96].map(n=><button key={n} type="button" aria-label={`1/${n}${mode==='triplet'?' · 3':''}`} aria-pressed={grid===`${mode}:${n}`} onClick={()=>setGrid(`${mode}:${n}`)}>1/{n}</button>)}</div>
          </div>)}
        </div>
        <div className="lmm-quantize-strength">
          <label htmlFor={strengthId}>{st('Strength')}</label>
          <output>{strength}<small>%</small></output>
          <input id={strengthId} type="range" min={0} max={100} value={strength} onChange={e=>setStrength(Number(e.target.value))} aria-label={st('Strength')}/>
          <div className="lmm-quantize-scale"><span>0%</span><span>100%</span></div>
        </div>
        <p className="lmm-quantize-preview" role="status"><AudioLines size={15}/><span>{st(preview)}</span></p>
        <button type="button" className="lmm-quantize-apply" onClick={()=>onApply(strength,stepQN)}><Check size={15}/>{st('Apply')}</button>
        <div className="lmm-quantize-footer">
          {onUndo && <button type="button" onClick={onUndo}><RotateCcw size={12}/>{st('Undo quantization')}</button>}
          <button type="button" onClick={onReset}>{st('Reset flex')}</button>
        </div>
      </div>
    </MeasurePopover>
  );
}
