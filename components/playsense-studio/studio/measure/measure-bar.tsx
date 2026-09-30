'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// The floating bar over the selected bars in the strip: which bars, where they
// start and the tempo they play at, then every bar-level action. A button whose
// action can't run is disabled and its title says why.

import { useRef, type ReactNode, type Ref } from 'react';
import {
  GripVertical, ClipboardPaste, Copy, CopyPlus, Eraser, Magnet, Maximize2, Repeat, Repeat1, SlidersHorizontal, Trash2,
} from 'lucide-react';
import type { PopoverAnchor } from './popover';

/** Seconds as m:ss.s (12.34 → "0:12.3"). */
export function formatBarTime(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const m = Math.floor(tenths / 600);
  const s = (tenths - m * 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function MeasureBar({ ref, ...props }: {
  /** The bar's root, so the editor can measure its width and keep it on screen. */
  ref?: Ref<HTMLDivElement>;
  docked?: boolean;
  onMove?: (position:{left:number;top:number})=>void;
  selectionMissing?: boolean;
  left: number; top: number; label: string; startSeconds: number; bpm: number | null; looping: boolean;
  /** Why the selected bars' timing looks off the recording, if it does (Task 5). */
  flag?: string | null;
  /** "flexed ±<m> ms" when the selection carries flex, else null (Task 7). */
  flexInfo?: string | null;
  /** The repeat pass count when the selected bars are already in a repeat
   *  group; the Repeat button shows "×n" instead of "Repeat" (Task 7). */
  repeatCount?: number | null;
  canLoop: boolean; problems: { dup: string | null; paste: string | null; clear: string | null; del: string | null };
  onEdit: () => void; onLoop: () => void; onRepeat: (a: PopoverAnchor) => void; onDup: () => void;
  onCopy: () => void; onPaste: () => void; onBar: (a: PopoverAnchor) => void; onClear: () => void; onDelete: () => void;
  /** Opens the Quantize popover. Omitted (undefined) hides the button entirely
   *  — the lesson isn't a Watch section, so there's no recording to quantize
   *  against (Task 7). */
  onQuantize?: (a: PopoverAnchor) => void;
  /** Why Quantize can't run right now (e.g. no hits yet); disables the button
   *  and explains why, same as the other problem-gated actions. */
  quantizeProblem?: string | null;
}) {
  const st = useStudioText();
  const drag = useRef<{x:number;y:number;left:number;top:number} | null>(null);
  const { left, top, problems } = props;
  const menuAnchor = { left, top: top + 40 };
  const btn = (
    label: string,
    title: string,
    icon: ReactNode,
    onClick: () => void,
    opts: { problem?: string | null; text?: string; pressed?: boolean; kbd?: string; danger?: boolean } = {},
  ) => (
    <button
      type="button"
      aria-label={st(label)}
      title={st(props.selectionMissing ? "Select a measure first." : opts.problem ?? title)}
      disabled={props.selectionMissing || !!opts.problem}
      aria-pressed={opts.pressed}
      className={opts.danger ? 'is-danger' : undefined}
      onClick={(event) => {
        if (props.docked) {
          const rect = event.currentTarget.getBoundingClientRect();
          const parent = event.currentTarget.closest('[data-testid="staff-wrap"]')?.getBoundingClientRect();
          menuAnchor.left = rect.left - (parent?.left ?? 0);
          menuAnchor.top = rect.bottom - (parent?.top ?? 0);
        }
        onClick();
      }}
    >
      {icon}
      {opts.text ? st(opts.text) : props.docked ? st(label) : null}
      {opts.kbd && <span className="st-fbar-kbd">{opts.kbd}</span>}
    </button>
  );
  const icon = 'h-3.5 w-3.5';
  return (
    <div ref={ref} className={`st-fbar${props.docked ? ' is-docked flex-wrap' : ''}`} role="toolbar" aria-label={st("Selected bars")} style={{ left, top }}>
      {props.onMove && <button type="button" aria-label={st('Move editing palette')} title={st('Drag to move')}
        className="touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={e=>{e.preventDefault();e.stopPropagation();drag.current={x:e.clientX,y:e.clientY,left,top};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{
          const d=drag.current;if(!d)return;
          const bar=e.currentTarget.parentElement!;const area=bar.offsetParent as HTMLElement|null;
          const half=bar.offsetWidth/2;
          props.onMove?.({left:Math.max(half,Math.min((area?.clientWidth??window.innerWidth)-half,d.left+e.clientX-d.x)),top:Math.max(0,Math.min((area?.clientHeight??window.innerHeight)-bar.offsetHeight,d.top+e.clientY-d.y))});
        }}
        onPointerUp={e=>{drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);}}
        onPointerCancel={()=>{drag.current=null;}}><GripVertical className="h-4 w-4" /></button>}
      <span className="st-fbar-info">
        <span>{st(props.label)}</span>
        {props.bpm !== null && <span title={st("Tempo these bars play at")}>≈{props.bpm.toFixed(1)}</span>}
        {props.flag && (
          <span
            className="st-status-pip warn"
            role="img"
            aria-label={st(`Timing: ${props.flag}`)}
            title={st(props.flag)}
            style={{ width: 7, height: 7 }}
          />
        )}
      </span>
      <span className="st-fbar-sep" aria-hidden />
      {btn('Edit', 'Zoom in to edit notes (⏎)', <Maximize2 className={icon} />, props.onEdit, { text: 'Edit', kbd: '⏎' })}
      {btn('Loop', 'Loop these bars while you work (L)', <Repeat1 className={icon} />, props.onLoop, {
        text: 'Loop',
        problem: props.canLoop ? null : 'Play the video to loop',
        pressed: props.looping,
      })}
      {props.onQuantize && btn('Quantize', 'Pull the recording onto the written notes (Flex Time)', <Magnet className={icon} />, () => props.onQuantize!(menuAnchor), {
        text: 'Quantize',
        problem: props.quantizeProblem,
      })}
      {btn('Repeat', 'Play these bars more than once', <Repeat className={icon} />, () => props.onRepeat(menuAnchor), {
        text: props.repeatCount ? `×${props.repeatCount}` : 'Repeat',
      })}
      {btn('Duplicate', 'Duplicate (⌘D)', <CopyPlus className={icon} />, props.onDup, { problem: problems.dup })}
      {btn('Copy', 'Copy (⌘C)', <Copy className={icon} />, props.onCopy)}
      {btn('Paste', 'Paste after (⌘V)', <ClipboardPaste className={icon} />, props.onPaste, { problem: problems.paste })}
      {btn('Bar properties', 'Time, key, clef, tempo, barlines', <SlidersHorizontal className={icon} />, () => props.onBar(menuAnchor))}
      <span className="st-fbar-sep" aria-hidden />
      {btn('Clear', 'Empty these bars, keep their timing', <Eraser className={icon} />, props.onClear, { problem: problems.clear })}
      {btn('Delete', 'Delete (⌫)', <Trash2 className={icon} />, props.onDelete, { problem: problems.del, danger: true })}
    </div>
  );
}
