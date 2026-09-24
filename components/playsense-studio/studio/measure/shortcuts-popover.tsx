'use client';

// The strip's keyboard and mouse shortcuts, opened from the footer's "?".

import { MeasurePopover, type PopoverAnchor } from './popover';

const SHORTCUTS: Array<[string, string]> = [
  ['Click a bar', 'select it'],
  ['Drag across bars', 'select several'],
  ['⇧-click', 'extend the selection'],
  ['Double-click or ⏎', 'zoom in'],
  ['← →', 'move the selection (⇧ extends)'],
  ['⌘C ⌘V ⌘D', 'copy, paste after, duplicate'],
  ['⌫', 'delete bars'],
  ['Esc', 'deselect'],
  ['Scroll', 'zoom · ⇧-scroll pans'],
];

export function ShortcutsPopover({ anchor, onClose }: { anchor: PopoverAnchor; onClose: () => void }) {
  return (
    <MeasurePopover anchor={anchor} title="Strip shortcuts" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-foreground">{k}</dt>
            <dd className="text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </MeasurePopover>
  );
}
