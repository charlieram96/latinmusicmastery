'use client';
// components/playsense-studio/export/export-dialog.tsx
// Admin export dialog: format, tracks, page, include options, a first-row
// preview, and the export button. Everything runs in the browser.
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Download, FileText, FileCode2, Music2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { exportSection, type ExportFormat } from '@/lib/playsense-studio/export';
import { sectionExportFilename } from '@/lib/playsense-studio/export/filename';
import { buildRowPlan } from '@/lib/playsense-studio/export/pdf/row-plan';
import { engraveTrackRows } from '@/lib/playsense-studio/export/pdf/engrave';
import { ENGRAVE_WIDTH_PX } from '@/lib/playsense-studio/export/pdf/options';
import type { PageSize } from '@/lib/playsense-studio/export/pdf/page-plan';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import { logPlaysenseStudioEvent } from '@/app/actions/playsense-studio';
import { exportOptionsReducer, initialExportOptions, PAGE_SIZE_STORAGE_KEY } from './export-options';

export interface ExportDialogProps {
  score: ScoreDocument;
  classItemTitle: string;
  sectionIndex: number;
  sectionCount: number;
  classItemId: string;
  trigger: ReactNode;
}

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
  { id: 'pdf', label: 'PDF', hint: 'Print-ready page. Opens anywhere.', icon: FileText },
  { id: 'musicxml', label: 'MusicXML', hint: 'Editable in MuseScore, Finale, Sibelius, Guitar Pro.', icon: FileCode2 },
  { id: 'midi', label: 'MIDI', hint: 'Playback only. For DAWs and practice apps.', icon: Music2 },
];

const INCLUDES: Array<{ key: 'includeHeader' | 'includeMeasureNumbers' | 'includeBranding' | 'expandRepeats'; label: string }> = [
  { key: 'includeHeader', label: 'Title, tempo and time signature' },
  { key: 'includeMeasureNumbers', label: 'Measure numbers' },
  { key: 'includeBranding', label: 'Course name and site footer' },
  { key: 'expandRepeats', label: 'Expand repeats' },
];

function readStoredPageSize(): PageSize {
  try { return localStorage.getItem(PAGE_SIZE_STORAGE_KEY) === 'a4' ? 'a4' : 'letter'; } catch { return 'letter'; }
}

const viewLabel = (instrument: string) => (instrument.startsWith('perc-') ? 'percussion' : 'staff');

export function ExportDialog({ score, classItemTitle, sectionIndex, sectionCount, classItemId, trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(exportOptionsReducer, undefined, () => initialExportOptions(score.tracks.length, readStoredPageSize()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const measures = score.tracks[0]?.measures.length ?? 0;
  const subtitle = `Section ${sectionIndex + 1} · ${score.title} · ${measures} measures · ${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]} · ♩=${Math.round(score.initialTempo)}`;
  const filename = useMemo(() => sectionExportFilename(classItemTitle, sectionIndex, state.format), [classItemTitle, sectionIndex, state.format]);

  // First-row preview of the first selected track, engraved with the real exporter.
  useEffect(() => {
    if (!open || state.format === 'midi') return;
    const host = previewRef.current;
    if (!host) return;
    try {
      const plan = buildRowPlan(score, state.trackIndexes, ENGRAVE_WIDTH_PX, { expandRepeats: state.pdf.expandRepeats });
      const first = engraveTrackRows(plan, state.trackIndexes[0]);
      const svg = first.rows[0]?.svg;
      host.replaceChildren();
      if (svg) {
        svg.removeAttribute('width'); svg.removeAttribute('height');
        svg.style.width = '100%'; svg.style.height = 'auto';
        // Preview only. VexFlow paints literal `black`, which is invisible on a
        // dark surface; rewriting it to `currentColor` lets the wrapper's
        // `.playsense-studio-notation` colour cascade in, exactly as the
        // on-screen player does. The SVGs the exporter renders are never
        // themed — print wants black ink.
        themeVexflowSvg(svg);
        host.appendChild(svg);
      }
    } catch {
      host.replaceChildren();
    }
  }, [open, score, state.trackIndexes, state.pdf.expandRepeats, state.format]);

  const setPageSize = (pageSize: PageSize) => {
    dispatch({ type: 'pageSize', pageSize });
    try { localStorage.setItem(PAGE_SIZE_STORAGE_KEY, pageSize); } catch { /* private mode */ }
  };

  // Closing while an export is in flight is allowed: `run` only ever closes the
  // dialog, never reopens it, so a promise that settles after the user walked
  // away just clears `busy` on a dialog that is already shut.
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportSection({ score, trackIndexes: state.trackIndexes, format: state.format, pdf: state.pdf, context: { classItemTitle, sectionIndex, sectionCount } });
      void logPlaysenseStudioEvent({ eventType: 'playsense_studio_section_exported', classItemId, metadata: { format: state.format, trackCount: state.trackIndexes.length, surface: 'admin' } });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export sheet music</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Format</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
            {FORMATS.map(f => {
              const on = state.format === f.id;
              const Icon = f.icon;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => dispatch({ type: 'format', format: f.id })}
                  className={`flex flex-col gap-1.5 rounded-[10px] border p-3 text-left transition ${on ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:border-foreground/20'}`}>
                  <Icon className={`h-5 w-5 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-[13px] font-semibold">{f.label}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Tracks</div>
            {score.tracks.map((t, i) => (
              <label key={i} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="accent-primary" checked={state.trackIndexes.includes(i)} onChange={() => dispatch({ type: 'toggleTrack', trackIndex: i })} />
                <span>{t.displayName}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{viewLabel(t.instrument)}</span>
              </label>
            ))}
          </div>
          {state.format === 'pdf' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Page</div>
              <div className="st-seg" role="radiogroup" aria-label="Page size">
                {(['letter', 'a4'] as const).map(p => (
                  <button key={p} type="button" role="radio" className={state.pdf.pageSize === p ? 'is-on' : ''} aria-checked={state.pdf.pageSize === p} onClick={() => setPageSize(p)}>{p === 'a4' ? 'A4' : 'Letter'}</button>
                ))}
              </div>
              <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Include</div>
              {INCLUDES.map(i => (
                <label key={i.key} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-primary" checked={state.pdf[i.key]} onChange={() => dispatch({ type: 'toggle', key: i.key })} />
                  <span>{i.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {state.format !== 'midi' && (
          <div className="rounded-[10px] border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-[0.04em]">Preview</span>
              <span>First system</span>
            </div>
            <div ref={previewRef} className="playsense-studio-notation min-h-[60px] [&_svg]:block" aria-hidden="true" />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11.5px] text-muted-foreground">{filename}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted">Cancel</button>
            <button type="button" onClick={run} disabled={busy || state.trackIndexes.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              <Download className="h-4 w-4" />
              {busy ? 'Exporting…' : `Export ${FORMATS.find(f => f.id === state.format)?.label}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
