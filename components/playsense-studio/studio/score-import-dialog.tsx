'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — shared PDF/MusicXML/MIDI importer with instrument selection.
//
// One component for both entry points: the empty-state setup (mode="fresh") and
// the in-workshop "Replace score" button (mode="replace"). The flow is:
//   choose file → recognize PDFs on the server (Claude reads the pages) / parse notation client-side →
//   review PDF recognition → if the file has multiple instrument parts,
//   pick one instrument → retain all its staves.
//
// A selected instrument may contain several staves, kept together.

import { selectInstrument, staffGroupIndices } from '@/lib/playsense-studio/staff-groups';
import { FileMusic, Loader2, ScanLine, Upload } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ComponentProps, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { attachScoreFromImport } from '@/app/actions/playsense-studio';
import { parseMidi } from '@/lib/playsense-studio/parsers/midi';
import { parseMusicXmlBuffer } from '@/lib/playsense-studio/parsers/musicxml';
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization';
import { applyInstrumentLegend, IMPORT_INSTRUMENTS } from '@/lib/playsense-studio/instrument-legend';
import type { Instrument, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { MAX_PDF_BYTES, MAX_PDF_PAGES, parsePdfPages } from '@/lib/playsense-studio/pdf/policy.mjs';

const PdfImportPreview = dynamic(() => import('./pdf-import-preview').then(module => module.PdfImportPreview), {
  ssr: false, loading: () => <div className="grid h-64 place-items-center text-sm text-muted-foreground">Preparing preview…</div>,
});
const ScoreImportPreview = dynamic(() => import('./score-import-preview').then(module => module.ScoreImportPreview), {
  ssr: false, loading: () => <div className="grid h-72 place-items-center text-sm text-muted-foreground">Preparing score preview…</div>,
});

export interface ScoreImportDialogProps {
  classItemId: string;
  /** "fresh" = no score yet; "replace" = swap an existing score; "section" = add
   *  the imported score as a new scored section on a video. */
  mode: 'fresh' | 'replace' | 'section' | 'append';
  /** The element that opens the dialog. */
  trigger: ReactNode;
  /** Override the default attach behavior — e.g. create/replace a section. Receives
   *  the single-instrument score + filename; returns an error or nothing. */
  onConfirm?: (score: ScoreDocument, filename: string) => Promise<{ error?: string }>;
  /** Called after a successful import (defaults to router.refresh()). */
  onImported?: () => void;
  /** Forwarded to the dialog's `DialogContent` — e.g. so a host that embeds
   *  this dialog's trigger inside a menu that hides on click (ScoreMenu) can
   *  return focus to the menu's own chip instead of Radix's default (this
   *  trigger, which by the time the dialog closes sits inside that menu's
   *  now-hidden, unfocusable panel). */
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}

type Step = 'choose' | 'pdf' | 'review';

const ACCEPT = '.pdf,.mid,.midi,.musicxml,.xml,.mxl';

export function ScoreImportDialog({ classItemId, mode, trigger, onConfirm, onImported, onCloseAutoFocus }: ScoreImportDialogProps) {
  const st = useStudioText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ScoreDocument | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [instrumentOverride,setInstrumentOverride] = useState<Instrument|''>('');
  const importScore = useMemo(()=>parsed && instrumentOverride ? applyInstrumentLegend(parsed,selectedTrack,instrumentOverride) : parsed,[parsed,selectedTrack,instrumentOverride]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState('1');
  const [percussion, setPercussion] = useState(false);
  const [pieces, setPieces] = useState<ScoreDocument[]>([]);
  const [selectedPiece, setSelectedPiece] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [isPending, startTransition] = useTransition();
  const busy = isParsing || isPending;

  const reset = useCallback(() => {
    generationRef.current++;
    requestRef.current?.abort();
    requestRef.current = null;
    setStep('choose');
    setIsParsing(false);
    setIsDragOver(false);
    setError(null);
    setParsed(null);
    setFilename('');
    setSelectedTrack(0);
    setInstrumentOverride('');
    setPdfFile(null);
    setPageCount(0);
    setPages('1');
    setPieces([]);
    setSelectedPiece(0);
    setReviewed(false);
    setPercussion(false);
  }, []);

  useEffect(() => () => { generationRef.current++; requestRef.current?.abort(); }, []);

  const handleFile = async (file: File) => {
    if (busy) return;
    const generation = ++generationRef.current;
    setError(null);
    setIsParsing(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a score file under 20 MB.');
      const buffer = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      let score: ScoreDocument;
      if (lower.endsWith('.pdf')) {
        const { PDFDocument } = await import('pdf-lib');
        let pdf;
        try { pdf = await PDFDocument.load(buffer, { updateMetadata: false }); }
        catch { throw new Error('This PDF could not be read. Choose an unlocked, undamaged PDF.'); }
        if (!pdf.getPageCount()) throw new Error('This PDF has no pages.');
        if (generation !== generationRef.current) return;
        setPdfFile(file);
        setFilename(file.name);
        setPageCount(pdf.getPageCount());
        const last = Math.min(pdf.getPageCount(), MAX_PDF_PAGES);
        setPages(last === 1 ? '1' : `1–${last}`);
        setStep('pdf');
        return;
      } else if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
        score = await parseMidi(buffer, { title: stripExt(file.name) });
      } else if (lower.endsWith('.musicxml') || lower.endsWith('.xml') || lower.endsWith('.mxl')) {
        score = await parseMusicXmlBuffer(buffer, file.name, { title: stripExt(file.name) });
      } else {
        throw new Error('Choose a PDF, MIDI, or MusicXML score file.');
      }
      if (score.tracks.length === 0) {
        throw new Error('That file has no instrument parts to import.');
      }
      if (generation !== generationRef.current) return;
      setParsed(score);
      setFilename(file.name);
      // Pre-select the part that actually has notes (avoids landing on an empty
      // accompaniment/percussion-map part and seeing nothing).
      setSelectedTrack(richestTrackIndex(score));
      setStep('review');
    } catch (err) {
      if (generation === generationRef.current) setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      if (generation === generationRef.current) setIsParsing(false);
    }
  };

  const recognizePdf = async () => {
    if (!pdfFile || busy) return;
    const generation = ++generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setIsParsing(true);
    try {
      const selectedPages = parsePdfPages(pages, pageCount);
      const { PDFDocument } = await import('pdf-lib');
      const source = await PDFDocument.load(await pdfFile.arrayBuffer(), { updateMetadata: false });
      const selection = await PDFDocument.create();
      for (const page of await selection.copyPages(source, selectedPages.map(page => page - 1))) selection.addPage(page);
      const bytes = await selection.save();
      if (bytes.length > MAX_PDF_BYTES) throw new Error('The selected pages exceed 4 MB. Choose fewer pages or compress the PDF.');
      if (controller.signal.aborted) return;
      const response = await fetch('/api/playsense/import-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'X-Score-Percussion': String(percussion), 'X-Score-Title': encodeURIComponent(stripExt(pdfFile.name)) },
        body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null) as { error?: string; documents?: unknown[] } | null;
      if (!response.ok) throw new Error(result?.error ?? 'PDF recognition is unavailable. Please try again.');
      if (!result?.documents?.length) throw new Error('No notation was found. Try a clearer PDF.');
      // The server already validated; parsing again keeps the client honest about the shape it renders.
      const recognized: ScoreDocument[] = result.documents.map(document => ({ ...parseScoreDocument(document), sourceFormat: 'pdf' as const }));
      if (recognized.some(score => !score.tracks.length)) throw new Error('A detected piece had no instrument parts. Try importing its pages separately.');
      if (generation !== generationRef.current) return;
      setPieces(recognized);
      setSelectedPiece(0);
      setParsed(recognized[0]);
      setSelectedTrack(richestTrackIndex(recognized[0]));
      setReviewed(false);
      setStep('review');
    } catch (err) {
      if (generation === generationRef.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'PDF import failed');
    } finally {
      if (generation === generationRef.current) { setIsParsing(false); requestRef.current = null; }
    }
  };

  const cancelRecognition = () => {
    generationRef.current++;
    requestRef.current?.abort();
    requestRef.current = null;
    setIsParsing(false);
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const confirmImport = () => {
    if (!parsed || busy || (pdfFile && !reviewed)) return;
    const single = selectInstrument(importScore ?? parsed, selectedTrack);
    setError(null);
    startTransition(async () => {
      try {
      const result = onConfirm
        ? await onConfirm(single, filename)
        : await attachScoreFromImport({
            classItemId,
            scoreDocument: single,
            sourceFilename: filename,
          });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      reset();
      if (onImported) onImported();
      else router.refresh();
      } catch (err) { setError(err instanceof Error ? err.message : 'The score could not be saved. Please try again.'); }
    });
  };

  const multiTrack = parsed ? parsed.tracks.some((_, i) => !staffGroupIndices(parsed, 0).includes(i)) : false;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={`${pdfFile || step === 'review' ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto [&>*]:min-w-0`} showCloseButton={!isPending} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {st(mode === 'replace' ? 'Replace score' : mode === 'section' ? 'Import as new section' : mode === 'append' ? 'Add score' : 'Import a score')}
          </DialogTitle>
          <DialogDescription>
            {st(mode === 'replace'
              ? 'Import a PDF, MusicXML, or MIDI file. Review it before replacing the current score and its sync.'
              : mode === 'section'
                ? 'Import a PDF, MusicXML, or MIDI file as a new scored section.'
                : mode === 'append'
                  ? 'Import a PDF, MusicXML, or MIDI file. Its measures are added after the current score’s last measure; the existing score and sync stay as they are.'
                  : 'Bring your sheet music into Studio as editable notation.')}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`block cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            } ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              type="file"
              accept={ACCEPT}
              aria-label={st("Choose score file")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <div className="flex flex-col items-center gap-2 text-sm">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="font-medium">{st(busy ? 'Reading file…' : 'Drop a score file or click to browse')}</span>
              <span className="text-xs text-muted-foreground">{st("PDF · MusicXML · MIDI")}</span>
              <span className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{st("Printed PDF scores are recognized first, then opened for review.")}</span>
            </div>
          </label>
        )}

        {step === 'pdf' && pdfFile && <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm"><FileMusic className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-medium">{filename}</span><span className="shrink-0 text-xs text-muted-foreground">{pageCount} {st(pageCount === 1 ? 'page' : 'pages')}</span></div>
          <PdfImportPreview file={pdfFile} trackIndex={0} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">{st("Pages to recognize")}<input value={pages} disabled={busy} onChange={event => setPages(event.target.value)} placeholder={st("1–3, 5")} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <span className="block text-xs font-normal text-muted-foreground">{st("Up to ")}{MAX_PDF_PAGES} {st("pages · 4 MB per import")}</span>
            </label>
            <label className="space-y-1.5 text-sm font-medium">{st("Notation type")}<select value={percussion ? 'percussion' : 'standard'} disabled={busy} onChange={event => setPercussion(event.target.value === 'percussion')} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="standard">{st("Standard notation")}</option><option value="percussion">{st("Includes percussion")}</option>
              </select><span className="block text-xs font-normal text-muted-foreground">{st("Percussion supports one- and five-line staves.")}</span>
            </label>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{st("Use a clean export or a clear scan of printed sheet music. Handwriting is not supported. You’ll review the detected notes before saving.")}</p>
          {isParsing ? <div className="rounded-xl border border-primary/20 bg-primary/5 p-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin text-primary" />{st("Recognizing your score…")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{st("Finding staves, rhythms, and notes. This can take a few minutes.")}</p>
            <button type="button" onClick={cancelRecognition} className="mt-3 text-xs font-medium underline underline-offset-4">{st("Cancel recognition")}</button>
          </div> : <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">{st("Choose another file")}</button>
            <button type="button" onClick={() => void recognizePdf()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><ScanLine className="h-4 w-4" />{st("Recognize score")}</button>
          </div>}
        </div>}

        {step === 'review' && parsed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <FileMusic className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>

            {pieces.length > 1 && <label className="block space-y-1.5 text-sm font-medium">{st("Choose a detected piece")}<select value={selectedPiece} disabled={busy} onChange={event => {
                const index = Number(event.target.value);
                setInstrumentOverride(''); setSelectedPiece(index); setParsed(pieces[index]); setSelectedTrack(richestTrackIndex(pieces[index])); setReviewed(false);
              }} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                {pieces.map((piece, index) => <option key={index} value={index}>{st("Piece ")}{index + 1} · {piece.tracks[0]?.measures.length ?? 0} {st("measures · ")}{piece.tracks.length} {st("parts")}</option>)}
              </select><span className="block text-xs font-normal text-muted-foreground">{st("This PDF contains ")}{pieces.length} {st("separate pieces. Import one at a time.")}</span>
            </label>}

            {multiTrack ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {st("Choose one instrument")}</p>
                <p className="text-xs text-muted-foreground">
                  {st("Each sync covers one instrument. Pick the part you want to teach — import other instruments into their own lessons.")}</p>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {parsed.tracks.map((t, i) => {
                    if (staffGroupIndices(parsed, i)[0] !== i) return null;
                    const noteCount = countTrackNotes(t);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={busy}
                        onClick={() => { setSelectedTrack(i); setInstrumentOverride(''); setReviewed(false); }}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                          i === selectedTrack
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <span className="truncate font-medium">{t.displayName}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          <span>{t.instrument}</span>
                          <span className={noteCount === 0 ? 'text-amber-600' : undefined}>
                            {st(noteCount === 0 ? 'no notes' : `${noteCount} notes`)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {st("Instrument:")}<span className="font-medium text-foreground">{parsed.tracks[0].displayName}</span>{st(' ')}
                <span className="text-xs">({staffGroupIndices(parsed, 0).reduce((n, i) => n + countTrackNotes(parsed.tracks[i]), 0)} {st("notes)")}</span>
              </p>
            )}

            <label className="block space-y-2 rounded-xl border border-border bg-primary/5 p-3 text-sm">
              <span className="font-medium">{st('Instrument and notation legend')}</span>
              <select aria-label={st('Instrument and notation legend')} disabled={busy} value={instrumentOverride} onChange={e=>{setInstrumentOverride(e.target.value as Instrument|'');setReviewed(false);}} className="block w-full rounded-lg border border-border bg-background px-3 py-2">
                <option value="">{st('Use detected instrument')} · {parsed.tracks[selectedTrack]?.instrument}</option>
                {IMPORT_INSTRUMENTS.map(([id,label])=><option key={id} value={id}>{st(label)}</option>)}
              </select>
              <span className="block text-xs text-muted-foreground">{st('Loads the instrument legend for new notes. Explicit imported noteheads are preserved.')}</span>
            </label>

            {!pdfFile && <ScoreImportPreview score={importScore ?? parsed} trackIndex={selectedTrack} />}
            {pdfFile && <>
              <PdfImportPreview file={pdfFile} score={importScore ?? parsed} trackIndex={selectedTrack} />
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed">
                <input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} className="mt-0.5 accent-primary" />
                <span>{st("I’ve reviewed the recognized notation. I’ll check pitches, rhythms, repeats, and percussion mapping in the editor before publishing.")}</span>
              </label>
              {countTrackNotes(parsed.tracks[selectedTrack]) === 0 && <p className="text-xs text-destructive">{st("No playable notes were found in this part. Choose another part or a clearer PDF.")}</p>}
            </>}

            {mode === 'replace' && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                {st("This replaces the lesson’s current score and clears its published sync.")}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50"
              >
                {st("Choose a different file")}</button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy || (!!pdfFile && (!reviewed || countTrackNotes(parsed.tracks[selectedTrack]) === 0))}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {st(mode === 'replace' ? 'Replace score' : mode === 'section' ? 'Add section' : mode === 'append' ? 'Add score' : 'Import')}
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/** Count playable events (notes + chords, ignoring rests) in a track. */
function countTrackNotes(track: ScoreDocument['tracks'][number]): number {
  let n = 0;
  for (const measure of track.measures) {
    for (const voice of measure.voices) {
      for (const event of voice.events) {
        if (event.kind === 'note') n++;
        else if (event.kind === 'chord') n += event.notes.length;
      }
    }
  }
  return n;
}

/** Index of the track with the most notes (the most likely one to teach). */
function richestTrackIndex(score: ScoreDocument): number {
  let best = 0;
  let bestCount = -1;
  score.tracks.forEach((t, i) => {
    const count = countTrackNotes(t);
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  });
  return best;
}
