'use client';

// PlaySense Studio — no-score setup. Shown by the Studio when a class item has
// no score yet. Drop a MIDI/MusicXML file (parsed client-side) or create a blank
// score, then refresh so the server page re-loads the full Studio with the new
// score attached.

import { ArrowLeft, FilePlus, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  attachScoreFromImport,
  createBlankScoreForClassItem,
} from '@/app/actions/playsense-studio';
import { parseMidi } from '@/lib/playsense-studio/parsers/midi';
import { parseMusicXmlBuffer } from '@/lib/playsense-studio/parsers/musicxml';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export interface StudioSetupProps {
  classItemId: string;
  classItemTitle: string;
}

export function StudioSetup({ classItemId, classItemTitle }: StudioSetupProps) {
  const router = useRouter();
  const [isParsing, setIsParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const busy = isParsing || isPending;

  const createBlank = () => {
    setError(null);
    startTransition(async () => {
      const result = await createBlankScoreForClassItem({ classItemId });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

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
        router.refresh();
      });
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">PlaySense Studio — {classItemTitle}</h1>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="mb-1 text-lg font-semibold">Add a score</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Import a MIDI or MusicXML file, or start a blank score. Once added, you can build the
          notation and sync it to the video here in PlaySense Studio.
        </p>

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
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
            <span className="font-medium">{busy ? 'Working…' : 'Drop a score file or click to browse'}</span>
            <span className="text-xs text-muted-foreground">MIDI (.mid, .midi) or MusicXML (.musicxml, .xml, .mxl)</span>
          </div>
        </label>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={createBlank}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FilePlus className="h-4 w-4" />
          Create a blank score (4 bars of 4/4 at 120 BPM)
        </button>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
