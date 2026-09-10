'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Renderer, Stave, TickContext } from 'vexflow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PercStroke } from '@/lib/playsense-studio/perc-strokes';
import { createStaveNote } from '@/lib/playsense-studio/percussion-stave-note';

function StrokePreview({ stroke }: { stroke: PercStroke }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(64, 74);
    const context = renderer.getContext();
    const stave = new Stave(2, 22, 60, { spacingBetweenLinesPx: 6 });
    stave.setBegBarType(0).setEndBarType(0).setStyle({ strokeStyle: 'currentColor', lineWidth: 0.5 });
    stave.setContext(context).drawWithStyle();
    el.querySelector('.vf-stave')?.setAttribute('opacity', '0.2');
    const note = createStaveNote({ keys: [stroke.staffLine], duration: '4', stemDirection: 1 }, [{
      staffLine: stroke.staffLine, notehead: stroke.notehead ?? stroke.noteType ?? 'normal', marcato: stroke.marcato,
    }]);
    note.setStemLength(22).setStemDirection(1);
    note.setStyle({ fillStyle: 'currentColor', strokeStyle: 'currentColor' });
    note.setStave(stave).setContext(context);
    // A single note needs a tick context for its horizontal position.
    new TickContext().addTickable(note).preFormat().setX(14);
    note.drawWithStyle();
    return () => { el.replaceChildren(); };
  }, [stroke]);
  return <div ref={ref} aria-hidden="true" className="pointer-events-none h-[74px] w-16 shrink-0 opacity-80" />;
}

export function PercussionStrokePicker({ strokes, value, onChange }: {
  strokes: PercStroke[]; value: number | null; onChange: (midi: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = strokes.find(s => s.midi === value);
  const groups = [...new Set(strokes.map(s => s.group ?? 'Strokes'))];
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium" aria-label={`Choose percussion stroke: ${selected?.label ?? 'Imported notation'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {selected?.label ?? 'Imported notation'}
        <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">{strokes.length} strokes</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" side="top" className="flex w-[600px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border-border p-4" style={{ maxHeight: 'min(580px, var(--radix-popover-content-available-height))' }} collisionPadding={12}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Choose a stroke</p>
        <span className="text-[11px] text-muted-foreground">Position & symbol from the instrument legend</span>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        {groups.map(group => <div key={group}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {strokes.filter(s => (s.group ?? 'Strokes') === group).map(stroke => <button key={stroke.id} type="button"
              aria-pressed={value === stroke.midi} aria-label={stroke.label} title={stroke.description ?? stroke.label}
              onClick={() => { onChange(stroke.midi); setOpen(false); }}
              className={`relative flex min-h-[80px] items-center rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${value === stroke.midi ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background/40 text-foreground hover:border-primary/40 hover:bg-muted/60'}`}>
              <StrokePreview stroke={stroke} />
              <span className="pr-3 text-xs font-medium leading-snug">{stroke.label}</span>
              {value === stroke.midi && <Check className="absolute right-1.5 top-1.5 h-3 w-3" />}
            </button>)}
          </div>
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}
