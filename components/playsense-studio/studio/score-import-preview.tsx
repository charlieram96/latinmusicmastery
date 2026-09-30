'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


import { MultiStaffRenderer } from '@/components/playsense-studio/player/notation/renderers/multi-staff-renderer';
import { staffGroupIndices } from '@/lib/playsense-studio/staff-groups';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/** Preview the selected part with the same notation renderer students use. */
export function ScoreImportPreview({ score, trackIndex }: { score: ScoreDocument; trackIndex: number }) {
  const st = useStudioText();
  const track = score.tracks[trackIndex];
  if (!track) return null;
  const staffCount = staffGroupIndices(score, trackIndex).length;
  const Preview = staffCount > 1 ? MultiStaffRenderer : StaffRenderer;
  const voices = Math.max(1, ...staffGroupIndices(score, trackIndex).flatMap(i => score.tracks[i].measures.map(m => m.voices.length)));
  return <section aria-label={st("Imported score preview")} className="overflow-hidden rounded-xl border border-border">
    <div className="space-y-1 border-b border-border bg-muted/20 px-3 py-2">
      <h3 className="text-sm font-medium">{score.title}</h3>
      <p className="text-xs text-muted-foreground">
        {track.displayName} · {score.initialTempo} {st("BPM · ")}{score.initialTimeSignature.join('/')} · {track.measures.length} {st("measures · ")}{staffCount} {st("staves · ")}{voices} {st(voices === 1 ? 'voice' : 'voices')}
      </p>
    </div>
    <div className="h-72">
      <Preview score={score} trackIndex={trackIndex} currentMs={0} showCursor={false} autoFollow={false} layoutMode="wrapped" helpers={false} zoom={0.8} className="h-full" />
    </div>
  </section>;
}
