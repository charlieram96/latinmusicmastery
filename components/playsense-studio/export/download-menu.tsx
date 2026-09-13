'use client';
// components/playsense-studio/export/download-menu.tsx
// Student-facing: one icon button, a two-item menu, defaults for everything.
import { useEffect, useRef, useState } from 'react';
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // A previous export that hung or failed must not leave both items disabled
    // reading "Preparing…" the next time the menu is opened.
    setBusy(null);
    setError(false);
    const onDown = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (format: ExportFormat) => {
    if (busy) return; // A closed-and-reopened menu resets `busy`; don't let a second export start while one is in flight.
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
      setBusy(null);
    }
  };

  const items: Array<{ format: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
    { format: 'pdf', label: t('playsenseExport.pdf'), hint: t('playsenseExport.pdfHint'), icon: FileText },
    { format: 'musicxml', label: t('playsenseExport.musicxml'), hint: t('playsenseExport.musicxmlHint'), icon: FileCode2 },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title={t('playsenseExport.button')} aria-label={t('playsenseExport.button')}
        className={`grid h-[26px] w-7 place-items-center rounded-full border border-border bg-secondary transition-colors ${open ? 'bg-primary/[0.16] text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        <Download className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur">
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('playsenseExport.title')}</div>
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.format} type="button" role="menuitem" disabled={busy !== null} onClick={() => void run(item.format)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60">
                <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">{busy === item.format ? t('playsenseExport.working') : item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
          <div className="mx-2.5 mb-1.5 mt-1 border-t border-border pt-2 text-[10.5px] leading-snug text-muted-foreground">
            {error ? <span className="text-destructive">{t('playsenseExport.error')}</span> : t('playsenseExport.note')}
          </div>
        </div>
      )}
    </div>
  );
}
