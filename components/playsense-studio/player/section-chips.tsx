'use client';

// Section chips for the watch staff: one per scored section of the demo video.
// The chip playing now is highlighted; tapping one loops that section, and
// tapping the looping chip again stops the loop.

import { Repeat } from 'lucide-react';
import { useTranslation } from '@/components/language-provider';
import { cn } from '@/lib/utils';

export interface ChipSection { label: string | null; start: number; end: number }

const near = (a: number | null, b: number) => a != null && Math.abs(a - b) < 0.05;

export function SectionChips({ sections, currentSeconds, loop, onLoop, onClear, className }: {
  sections: ChipSection[];
  currentSeconds: number;
  loop: { a: number | null; b: number | null; enabled: boolean };
  onLoop: (start: number, end: number) => void;
  onClear: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  if (sections.length < 2) return null;
  return (
    <div role="group" aria-label={t('dashboard.classViewer.lessonMode.sections.label')} data-ws-nodrag=""
      className={cn('flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]', className)}>
      {sections.map((section, i) => {
        const name = section.label || t('dashboard.classViewer.lessonMode.sections.section', { n: i + 1 });
        const looping = loop.enabled && near(loop.a, section.start) && near(loop.b, section.end);
        const active = currentSeconds >= section.start && currentSeconds < section.end;
        return (
          <button key={`${section.start}-${i}`} type="button" aria-pressed={looping} data-active={active}
            title={t(looping ? 'dashboard.classViewer.lessonMode.sections.stopLoop' : 'dashboard.classViewer.lessonMode.sections.loop', { name })}
            onClick={() => (looping ? onClear() : onLoop(section.start, section.end))}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-tap ease-smooth',
              looping ? 'border-primary bg-primary text-primary-foreground'
                : active ? 'border-primary/50 bg-primary/[0.12] text-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
            )}>
            {looping && <Repeat aria-hidden className="h-3 w-3" />}
            {name}
          </button>
        );
      })}
    </div>
  );
}
