'use client';

// The floating bar over the selected bars in the strip: which bars, where they
// start and the tempo they play at, then every bar-level action. A button whose
// action can't run is disabled and its title says why.

import type { ReactNode, Ref } from 'react';
import {
  ClipboardPaste, Copy, CopyPlus, Eraser, Maximize2, Repeat, Repeat1, SlidersHorizontal, Trash2,
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
  left: number; top: number; label: string; startSeconds: number; bpm: number | null; looping: boolean;
  /** Why the selected bars' timing looks off the recording, if it does (Task 5). */
  flag?: string | null;
  canLoop: boolean; problems: { dup: string | null; paste: string | null; clear: string | null; del: string | null };
  onEdit: () => void; onLoop: () => void; onRepeat: (a: PopoverAnchor) => void; onDup: () => void;
  onCopy: () => void; onPaste: () => void; onBar: (a: PopoverAnchor) => void; onClear: () => void; onDelete: () => void;
}) {
  const { left, top, problems } = props;
  const menuAnchor = { left, top: top + 40 };
  const btn = (
    label: string,
    title: string,
    icon: ReactNode,
    onClick: () => void,
    opts: { problem?: string | null; text?: string; pressed?: boolean } = {},
  ) => (
    <button
      type="button"
      aria-label={label}
      title={opts.problem ?? title}
      disabled={!!opts.problem}
      aria-pressed={opts.pressed}
      onClick={onClick}
    >
      {icon}
      {opts.text}
    </button>
  );
  const icon = 'h-3.5 w-3.5';
  return (
    <div ref={ref} className="st-fbar" role="toolbar" aria-label="Selected bars" style={{ left, top }}>
      <span className="st-fbar-info">
        {props.label} · {formatBarTime(props.startSeconds)}
        {props.bpm !== null && (
          <>
            {' · '}
            <span title="Tempo these bars play at">≈{props.bpm.toFixed(1)} BPM</span>
          </>
        )}
        {props.flag && (
          <>
            {' · '}
            <span className="st-fbar-flag" title={props.flag}>{props.flag}</span>
          </>
        )}
      </span>
      {btn('Edit', 'Zoom in (⏎)', <Maximize2 className={icon} />, props.onEdit)}
      {btn('Loop', 'Loop these bars', <Repeat1 className={icon} />, props.onLoop, {
        problem: props.canLoop ? null : 'Play the video to loop',
        pressed: props.looping,
      })}
      {btn('Repeat', 'Repeat these bars', <Repeat className={icon} />, () => props.onRepeat(menuAnchor), { text: 'Repeat ▾' })}
      {btn('Duplicate', 'Duplicate (⌘D)', <CopyPlus className={icon} />, props.onDup, { problem: problems.dup })}
      {btn('Copy', 'Copy (⌘C)', <Copy className={icon} />, props.onCopy)}
      {btn('Paste', 'Paste after (⌘V)', <ClipboardPaste className={icon} />, props.onPaste, { problem: problems.paste })}
      {btn('Bar properties', 'Time, key, clef, tempo, barlines', <SlidersHorizontal className={icon} />, () => props.onBar(menuAnchor), { text: 'Bar ▾' })}
      <span className="st-fbar-sep" aria-hidden />
      {btn('Clear', 'Empty these bars, keep their timing', <Eraser className={icon} />, props.onClear, { problem: problems.clear })}
      {btn('Delete', 'Delete (⌫)', <Trash2 className={icon} />, props.onDelete, { problem: problems.del })}
    </div>
  );
}
