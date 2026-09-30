'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — no-score setup. Shown by the Studio when a class item has
// no score yet. Import a MIDI/MusicXML file (parsed client-side, one instrument
// chosen via ScoreImportDialog) or create a blank score, then the page refreshes
// into the full Studio with the new score attached.

import { ArrowLeft, FilePlus, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createBlankScoreForClassItem } from '@/app/actions/playsense-studio';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';

export interface StudioSetupProps {
  classItemId: string;
  classItemTitle: string;
  /** Where the header back link lands (the owning course's overview). */
  backHref?: string;
  /** Extra header content (e.g. the exercise Watch/Exercise part toggle). */
  appBarExtra?: React.ReactNode;
}

export function StudioSetup({
  classItemId,
  classItemTitle,
  backHref = '/admin/courses',
  appBarExtra,
}: StudioSetupProps) {
  const st = useStudioText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {st("Admin")}</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">{st("PlaySense Studio — ")}{classItemTitle}</h1>
        {appBarExtra && <div className="ml-2">{appBarExtra}</div>}
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="mb-1 text-lg font-semibold">{st("Add a score")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {st("Import a PDF, MIDI, or MusicXML file, or start a blank score. Once added, you can build the notation and sync it to the video here in PlaySense Studio.")}</p>

        <ScoreImportDialog
          classItemId={classItemId}
          mode="fresh"
          trigger={
            <button
              type="button"
              className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition hover:border-primary/50"
            >
              <div className="flex flex-col items-center gap-2 text-sm">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="font-medium">{st("Import a score file")}</span>
                <span className="text-xs text-muted-foreground">
                  {st("PDF · MusicXML · MIDI")}</span>
              </div>
            </button>
          }
        />

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{st("or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={createBlank}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus className="h-4 w-4" />}
          {st("Create a blank score (4 bars of 4/4 at 120 BPM)")}</button>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
