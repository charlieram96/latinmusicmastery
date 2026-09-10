'use client';

import { useEffect, useRef, useState } from 'react';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

export function PdfImportPreview({ file, score, trackIndex }: { file: File; score?: ScoreDocument; trackIndex: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<'original' | 'notation'>('notation');
  useEffect(() => {
    const next = URL.createObjectURL(file);
    if (frameRef.current) frameRef.current.src = `${next}#toolbar=0&navpanes=0&view=FitH`;
    return () => URL.revokeObjectURL(next);
  }, [file, view, score]);
  return <div className="overflow-hidden rounded-xl border border-border">
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{score ? 'Review your score' : 'Original PDF'}</span>
      {score && <div className="flex gap-1" aria-label="Score preview">
        {(['notation', 'original'] as const).map(value => <button key={value} type="button" aria-pressed={view === value}
          onClick={() => setView(value)} className={`rounded-md px-2.5 py-1 text-xs transition ${view === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          {value === 'notation' ? 'Recognized notes' : 'Original PDF'}
        </button>)}
      </div>}
    </div>
    <div className="h-64 min-h-0 sm:h-72">
      {score && view === 'notation'
        ? <StaffRenderer score={score} trackIndex={trackIndex} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" zoom={0.8} className="h-full" />
        : <iframe ref={frameRef} title="Original score PDF" className="h-full w-full border-0" />}
    </div>
  </div>;
}
