'use client'
import './score-heading.css';
import {useTranslation} from '@/components/language-provider';
import type {ScoreDocument} from './score-model/types';
import {localizedScoreText} from '@/lib/playsense-studio/score-text';
/** Published metadata only: editing belongs to the Admin score form. */
export function ScoreHeading({score,trackIndex=0,fallbackTitle,bpm}:{bpm?:number;score:ScoreDocument;trackIndex?:number;fallbackTitle?:string}) {
 const {locale}=useTranslation();const unmetered=score.tracks[trackIndex]?.measures[0]?.senzaMisura;
 return <div className="lmm-score-heading"><header data-score-heading className="shrink-0 space-y-2 px-5 pb-2 pt-4 text-foreground sm:px-7">
  <h2 className="text-center font-heading text-[clamp(17px,1.6vw,24px)] font-semibold leading-snug tracking-tight text-primary [overflow-wrap:anywhere]">{localizedScoreText(score.title?.trim() || fallbackTitle,locale)}</h2>
  <div className="flex items-start justify-between gap-5 text-xs leading-relaxed sm:text-sm"><span className="min-w-0 font-medium [overflow-wrap:anywhere]">{localizedScoreText(score.tracks[trackIndex]?.displayName,locale)}</span><span className="min-w-0 text-right text-muted-foreground [overflow-wrap:anywhere]">{!score.composer?.trim() || /^(composer\s*\/\s*arranger|autor\s*\/\s*compositor)$/i.test(score.composer.trim()) ? 'LMM' : score.composer.trim()}</span></div>
  <p className="text-xs text-muted-foreground tabular-nums">{`${Math.round((bpm ?? score.initialTempo) * 10) / 10} BPM · ${unmetered ? (locale==='es'?'sin compás':'unmetered') : score.initialTimeSignature.join('/')}`}</p>
 </header></div>;
}
