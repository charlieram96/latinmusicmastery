'use client';

// Admin attach widget — drop a MIDI or MusicXML file to attach a Compás
// score to the class item we're editing. Parses on the client (in the
// admin's browser) and ships the validated ScoreDocument to the server
// action that persists it. No raw upload bucket is needed in v1 — the
// canonical JSON IS the score.

import { CheckCircle2, FileMusic, Loader2, Upload, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  attachScoreFromImport,
  detachScoreFromClassItem,
} from '@/app/actions/compas';
import { parseMidi } from '@/lib/compas/parsers/midi';
import { parseMusicXmlBuffer } from '@/lib/compas/parsers/musicxml';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

interface CompasScoreAttachProps {
  classItemId: string;
  /** Current score_document_id from the class_item, if attached. */
  currentScoreDocumentId: string | null;
  /** Called after successful attach/detach so the parent sheet can refresh. */
  onChanged?: () => void;
}

interface ImportSummary {
  title: string;
  format: 'midi' | 'musicxml';
  trackCount: number;
}

export function CompasScoreAttach({
  classItemId,
  currentScoreDocumentId,
  onChanged,
}: CompasScoreAttachProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [hasAttached, setHasAttached] = useState(currentScoreDocumentId !== null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFile = async (file: File) => {
    setError(null);
    setImportSummary(null);
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      let score: ScoreDocument;
      let format: ImportSummary['format'];
      if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
        score = await parseMidi(buffer, { title: stripExt(file.name) });
        format = 'midi';
      } else if (
        lower.endsWith('.musicxml') ||
        lower.endsWith('.xml') ||
        lower.endsWith('.mxl')
      ) {
        score = await parseMusicXmlBuffer(buffer, file.name, {
          title: stripExt(file.name),
        });
        format = 'musicxml';
      } else {
        throw new Error(
          `Unsupported file type: ${file.name}. Use .mid, .midi, .musicxml, .xml, or .mxl.`
        );
      }
      setIsParsing(false);

      startTransition(async () => {
        const result = await attachScoreFromImport({
          classItemId,
          scoreDocument: score,
          sourceFilename: file.name,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        setImportSummary({
          title: score.title,
          format,
          trackCount: score.tracks.length,
        });
        setHasAttached(true);
        onChanged?.();
      });
    } catch (err) {
      setIsParsing(false);
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleDetach = () => {
    setError(null);
    startTransition(async () => {
      const result = await detachScoreFromClassItem(classItemId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHasAttached(false);
      setImportSummary(null);
      onChanged?.();
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const busy = isParsing || isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileMusic className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium">Compás Score</h4>
      </div>

      {hasAttached && !importSummary && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            A score is attached to this class item.
          </span>
          <button
            type="button"
            onClick={handleDetach}
            disabled={busy}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
          >
            Replace / detach
          </button>
        </div>
      )}

      {importSummary && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-primary/30 bg-primary/5 text-sm">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>
              <span className="font-medium">{importSummary.title}</span>
              <span className="text-muted-foreground">
                {' '}
                · {importSummary.format.toUpperCase()} ·{' '}
                {importSummary.trackCount} track{importSummary.trackCount === 1 ? '' : 's'}
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={handleDetach}
            disabled={busy}
            className="text-xs p-1 rounded border border-border hover:bg-muted disabled:opacity-50"
            aria-label="Detach"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!hasAttached && !importSummary && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          className={`block cursor-pointer rounded-md border-2 border-dashed transition px-4 py-6 text-center ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <input
            type="file"
            accept=".mid,.midi,.musicxml,.xml,.mxl"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="flex flex-col items-center gap-2 text-sm">
            {busy ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <span className="font-medium">
                {busy ? 'Importing…' : 'Drop a score file or click to browse'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              MIDI (.mid, .midi) or MusicXML (.musicxml, .xml, .mxl)
            </p>
          </div>
        </label>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Once attached, students see the Compás player on this lesson instead of any legacy
        Soundslice embed. Sync between video and notation can be tightened later.
      </p>
    </div>
  );
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
