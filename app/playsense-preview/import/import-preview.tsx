'use client';
import { useState } from 'react';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export function ImportPreview() {
  const [score, setScore] = useState<ScoreDocument | null>(null);
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
    <div><p className="text-xs font-medium uppercase tracking-widest text-primary">PlaySense Studio</p>
      <h1 className="mt-2 text-3xl font-semibold">Bring your sheet music to life</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">Import a printed PDF, review the recognized notation, and choose an instrument. This preview keeps your imported score in this browser only. PDF recognition requires an admin sign-in.</p></div>
    <ScoreImportDialog classItemId="preview" mode="fresh"
      trigger={<button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Import a score</button>}
      onConfirm={async document => { setScore(document); return {}; }} onImported={() => {}} />
    {score && <section className="rounded-xl border border-border p-5">
      <h2 className="text-lg font-medium">{score.title}</h2><p className="mb-3 text-xs text-muted-foreground">{score.tracks[0].measures.length} measures · {score.tracks[0].displayName} · {score.sourceFormat?.toUpperCase()} import · Preview only</p>
      <StaffRenderer score={score} trackIndex={0} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" className="h-[60vh]" />
    </section>}
  </main>;
}
