'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// The "+" menu between bars in the admin measure strip: an empty measure, a
// copy of the bar to the left, or the bars on the clipboard.

import { ClipboardPaste, Copy, Plus } from 'lucide-react';
import { MeasurePopover, type PopoverAnchor } from './popover';

export function GapMenu({ anchor, gap, measureCount, clipCount, problems, onEmpty, onCopyLeft, onPaste, onClose }: {
  anchor: PopoverAnchor; gap: number; measureCount: number; clipCount: number | null;
  problems: { empty: string | null; copy: string | null; paste: string | null };
  onEmpty: () => void; onCopyLeft: () => void; onPaste: () => void; onClose: () => void;
}) {
  const st = useStudioText();
  const title = gap >= measureCount ? 'Add at the end' : gap === 0 ? 'Add before m.1' : `Add between m.${gap} and m.${gap + 1}`;
  const item = (label: string, Icon: typeof Plus, problem: string | null, run: () => void) => (
    <button type="button" className="st-mpop-item flex items-center gap-2" disabled={!!problem} title={st(problem ?? label)}
      onClick={() => { run(); onClose(); }}>
      <Icon className="h-3.5 w-3.5" /> {st(label)}
    </button>
  );
  return (
    <MeasurePopover anchor={anchor} title={st(title)} onClose={onClose}
      hint="New bars take the length of the bar to their left. Later bars move to make room.">
      <div className="flex flex-col gap-1">
        {item('Empty measure', Plus, problems.empty, onEmpty)}
        {gap > 0 && item(`Copy of m.${gap}`, Copy, problems.copy, onCopyLeft)}
        {clipCount !== null && item(`Paste ${clipCount} copied bar${clipCount === 1 ? '' : 's'}`, ClipboardPaste, problems.paste, onPaste)}
      </div>
    </MeasurePopover>
  );
}
