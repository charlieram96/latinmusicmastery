'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// The strip's keyboard and mouse shortcuts, opened from the footer's "?". Note
// entry itself lives in the measure zoom, so its keys get their own group
// below the strip's.

import { MeasurePopover, type PopoverAnchor } from './popover';

const SHORTCUTS: Array<[string, string]> = [
  ['Click a bar', 'select it'],
  ['Drag across bars', 'select several'],
  ['⇧-click', 'extend the selection'],
  ['Double-click or ⏎', 'edit the bar’s notes'],
  ['← →', 'move the selection (⇧ extends)'],
  ['⌘C ⌘V ⌘D', 'copy, paste after, duplicate'],
  ['⌫', 'delete bars'],
  ['Esc', 'deselect'],
  ['Scroll', 'Pinch to zoom · horizontal scroll to pan'],
];

const ZOOM_SHORTCUTS: Array<[string, string]> = [
  ['A–G', 'enter a note at the nearest octave (⇧ adds to a chord)'],
  ['1 2 3 4 5 6 7', '64th 32nd 16th 8th quarter half whole'],
  ['R or 0', 'rest'],
  ['.', 'cycle dots'],
  ['T', '3:2 triplet'],
  ['+', 'tie'],
  ['← →', 'move the cursor, crossing bars (⇧ extends)'],
  ['↑ ↓', 'diatonic step (⇧ semitone, ⌘ octave)'],
  ['⌘← ⌘→', 'previous / next bar'],
  ['S', 'slur'],
  ['⌫ / Delete', 'delete'],
  ['N', 'pencil'],
  ['Esc', 'close the popover, then the zoom'],
];

function ShortcutList({ items }: { items: Array<[string, string]> }) {
  const st = useStudioText();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-foreground">{st(k)}</dt>
          <dd className="text-muted-foreground">{st(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShortcutsPopover({ anchor, onClose }: { anchor: PopoverAnchor; onClose: () => void }) {
  const st = useStudioText();
  return (
    <MeasurePopover anchor={anchor} title={st("Strip shortcuts")} onClose={onClose}>
      <ShortcutList items={SHORTCUTS} />
      <p className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {st("In the zoom")}</p>
      <ShortcutList items={ZOOM_SHORTCUTS} />
    </MeasurePopover>
  );
}
