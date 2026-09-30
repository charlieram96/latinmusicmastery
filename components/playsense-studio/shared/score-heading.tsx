import type {ScoreDocument} from './score-model/types';
/** Published metadata only: editing belongs to the Admin score form. */
export function ScoreHeading({score,trackIndex=0,fallbackTitle,bpm}:{bpm?:number;score:ScoreDocument;trackIndex?:number;fallbackTitle?:string}) {
 return <header data-score-heading className="shrink-0 space-y-2 border-b border-border/50 px-5 pb-2 pt-2 text-foreground sm:px-7">
  <h2 className="text-center font-heading text-[clamp(17px,1.6vw,24px)] font-semibold leading-snug tracking-tight text-primary [overflow-wrap:anywhere]">{score.title?.trim() || fallbackTitle}</h2>
  <div className="flex items-start justify-between gap-5 text-xs leading-relaxed sm:text-sm"><span className="min-w-0 font-medium [overflow-wrap:anywhere]">{score.tracks[trackIndex]?.displayName}</span><span className="min-w-0 text-right text-muted-foreground [overflow-wrap:anywhere]">{score.composer?.trim() || 'LMM'}</span></div>
  <p className="text-xs text-muted-foreground tabular-nums">{Math.round((bpm ?? score.initialTempo) * 10) / 10} BPM · {score.initialTimeSignature.join('/')}</p>
 </header>;
}
