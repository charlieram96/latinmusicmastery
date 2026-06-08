'use client';

// PlaySense Studio — shared MusicXML/MIDI import dialog with instrument picker.
//
// One component for both entry points: the empty-state setup (mode="fresh") and
// the in-workshop "Replace score" button (mode="replace"). The flow is:
//   choose file → parse client-side → if the file has multiple instrument parts,
//   pick exactly ONE → attach (single-track) to the class item.
//
// "One instrument per sync": we filter the parsed ScoreDocument down to the
// chosen track before sending, so the rest of the Studio (which keys off
// score.tracks[0]) sees a single-instrument score. Replace mode warns that it
// clears the existing score + sync.

import { FileMusic, Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition, type ReactNode } from 'react';
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
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface ScoreImportDialogProps {
  classItemId: string;
  /** "fresh" = no score yet; "replace" = swap an existing score; "section" = add
   *  the imported score as a new scored section on a video. */
  mode: 'fresh' | 'replace' | 'section';
  /** The element that opens the dialog. */
  trigger: ReactNode;
  /** Override the default attach behavior — e.g. create/replace a section. Receives
   *  the single-instrument score + filename; returns an error or nothing. */
  onConfirm?: (score: ScoreDocument, filename: string) => Promise<{ error?: string }>;
  /** Called after a successful import (defaults to router.refresh()). */
  onImported?: () => void;
}

type Step = 'choose' | 'review';

const ACCEPT = '.mid,.midi,.musicxml,.xml,.mxl';

export function ScoreImportDialog({ classItemId, mode, trigger, onConfirm, onImported }: ScoreImportDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ScoreDocument | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [isPending, startTransition] = useTransition();
  const busy = isParsing || isPending;

  const reset = useCallback(() => {
    setStep('choose');
    setIsParsing(false);
    setIsDragOver(false);
    setError(null);
    setParsed(null);
    setFilename('');
    setSelectedTrack(0);
  }, []);

  const handleFile = async (file: File) => {
    setError(null);
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      let score: ScoreDocument;
      if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
        score = await parseMidi(buffer, { title: stripExt(file.name) });
      } else if (lower.endsWith('.musicxml') || lower.endsWith('.xml') || lower.endsWith('.mxl')) {
        score = await parseMusicXmlBuffer(buffer, file.name, { title: stripExt(file.name) });
      } else {
        throw new Error(`Unsupported file: ${file.name}. Use .mid, .midi, .musicxml, .xml, or .mxl.`);
      }
      if (score.tracks.length === 0) {
        throw new Error('That file has no instrument parts to import.');
      }
      setIsParsing(false);
      setParsed(score);
      setFilename(file.name);
      // Pre-select the part that actually has notes (avoids landing on an empty
      // accompaniment/percussion-map part and seeing nothing).
      setSelectedTrack(richestTrackIndex(score));
      setStep('review');
    } catch (err) {
      setIsParsing(false);
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const confirmImport = () => {
    if (!parsed) return;
    const chosen = parsed.tracks[selectedTrack] ?? parsed.tracks[0];
    // Keep only the chosen instrument; reset its index so it's the sole track 0.
    const single: ScoreDocument = { ...parsed, tracks: [{ ...chosen, index: 0 }] };
    setError(null);
    startTransition(async () => {
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
    });
  };

  const multiTrack = (parsed?.tracks.length ?? 0) > 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'replace' ? 'Replace score' : mode === 'section' ? 'Import as new section' : 'Import a score'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'replace'
              ? 'Drop a new MusicXML or MIDI file. This replaces the current score and its sync.'
              : mode === 'section'
                ? 'Import a MusicXML or MIDI file as a new scored section. Pick one instrument if the file has several.'
                : 'Import a MusicXML or MIDI file. Pick one instrument if the file has several.'}
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
              className="hidden"
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
              <span className="font-medium">{busy ? 'Reading file…' : 'Drop a score file or click to browse'}</span>
              <span className="text-xs text-muted-foreground">MIDI (.mid, .midi) or MusicXML (.musicxml, .xml, .mxl)</span>
            </div>
          </label>
        )}

        {step === 'review' && parsed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <FileMusic className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>

            {multiTrack ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Choose one instrument
                </p>
                <p className="text-xs text-muted-foreground">
                  Each sync covers one instrument. Pick the part you want to teach — import other
                  instruments into their own lessons.
                </p>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {parsed.tracks.map((t, i) => {
                    const noteCount = countTrackNotes(t);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedTrack(i)}
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
                            {noteCount === 0 ? 'no notes' : `${noteCount} notes`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Instrument: <span className="font-medium text-foreground">{parsed.tracks[0].displayName}</span>{' '}
                <span className="text-xs">({countTrackNotes(parsed.tracks[0])} notes)</span>
              </p>
            )}

            {mode === 'replace' && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                This replaces the lesson’s current score and clears its published sync.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50"
              >
                Choose a different file
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'replace' ? 'Replace score' : mode === 'section' ? 'Add section' : 'Import'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
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
        if (event.kind === 'note' || event.kind === 'chord') n++;
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
