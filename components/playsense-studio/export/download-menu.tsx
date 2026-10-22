'use client';
// components/playsense-studio/export/download-menu.tsx
// Student-facing: one icon button, a two-item menu, defaults for everything.
import { useRef, useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Download, FileCode2, FileText } from 'lucide-react';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { exportSection, type ExportFormat } from '@/lib/playsense-studio/export';
import { logPlaysenseStudioEvent } from '@/app/actions/playsense-studio';
import { useTranslation } from '@/components/language-provider';

export interface DownloadMenuProps {
  score: ScoreDocument;
  classItemTitle: string;
  sectionIndex: number;
  sectionCount: number;
  classItemId: string;
  readOnly?: boolean;
}

export function DownloadMenu({ score, classItemTitle, sectionIndex, sectionCount, classItemId, readOnly }: DownloadMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) setError(false);
  };

  const run = async (format: ExportFormat) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(format);
    setError(false);
    try {
      await exportSection({ score, trackIndexes: score.tracks.map((_, i) => i), format, context: { classItemTitle, sectionIndex, sectionCount } });
      if (!readOnly) void logPlaysenseStudioEvent({ eventType: 'playsense_studio_section_exported', classItemId, metadata: { format, trackCount: score.tracks.length, surface: 'student' } });
      setOpen(false);
    } catch (e) {
      console.error(`[playsense-export] ${format} export failed for class item ${classItemId} section ${sectionIndex + 1}`, e);
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const items: Array<{ format: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
    { format: 'pdf', label: t('playsenseExport.pdf'), hint: t('playsenseExport.pdfHint'), icon: FileText },
    { format: 'musicxml', label: t('playsenseExport.musicxml'), hint: t('playsenseExport.musicxmlHint'), icon: FileCode2 },
  ];

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
      <button type="button" data-score-preserve-selection
        title={t('playsenseExport.button')} aria-label={t('playsenseExport.button')}
        className={`grid h-[26px] w-7 place-items-center rounded-full border border-border bg-secondary transition-colors ${open ? 'bg-primary/[0.16] text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        <Download className="h-4 w-4" />
      </button>
      </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8} collisionPadding={12} data-score-preserve-selection className="w-60 max-w-[calc(100vw-24px)]">
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('playsenseExport.title')}</div>
          {items.map(item => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.format} disabled={busy !== null} onSelect={event => { event.preventDefault(); void run(item.format); }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60">
                <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">{busy === item.format ? t('playsenseExport.working') : item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
          <div className="mx-2.5 mb-1.5 mt-1 border-t border-border pt-2 text-[10.5px] leading-snug text-muted-foreground">
            {error ? <span className="text-destructive">{t('playsenseExport.error')}</span> : t('playsenseExport.note')}
          </div>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
