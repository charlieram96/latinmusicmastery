'use client';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Pendulum} from '../player/transport/chronometer-control';
import {useId, useState} from 'react';
import {Play, Pause, Square, ChevronLeft, ChevronRight, ChevronDown, ChevronUp} from 'lucide-react';
import type {useScoreTransport} from './use-score-transport';
import {useStudioText} from './use-studio-text';
export function transportTime(ms:number) {
 const n=Math.max(0,Math.floor(ms));
 return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')}.${String(n%1000).padStart(3,'0')}`;
}
export function ScorePlaybackControls({transport:t,scoreTempo,onUseScoreTempo,overrideBpm}:{transport:ReturnType<typeof useScoreTransport>;scoreTempo?:number;overrideBpm?:number;onUseScoreTempo?:()=>void}) {
 const st=useStudioText(),[target,setTarget]=useState('1');
 const [expanded,setExpanded]=useState(false);
 const detailsId=useId();
 const targetBar=Number(target);
 const canJump=Number.isInteger(targetBar)&&targetBar>=1&&targetBar<=t.bars.length;
 const jumpToMeasure=()=>{if(canJump)t.seekBar(targetBar-1);};
 const button='lmm-transport-button flex h-8 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none';
 return <form role="toolbar" aria-label={st('Score playback')} data-playing={t.playing} className="lmm-score-transport bg-card text-[11px] text-foreground" onSubmit={e=>{e.preventDefault();jumpToMeasure();}}>
  <div className="lmm-transport-strip">
   <button type="button" aria-label={st(expanded?'Hide playback options':'Show playback options')} title={st(expanded?'Hide playback options':'Show playback options')} aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(!expanded)} className={`${button} lmm-transport-disclosure !w-6 shrink-0`}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
   <div className="lmm-transport-keys">
    <button type="button" title={st('Go to beginning')} aria-label={st('Go to beginning')} disabled={!t.duration} onClick={()=>t.seek(0)} className={button}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5h2v14H3zM14 5v14l-8-7zm8 0v14l-8-7z"/></svg></button>
    <button type="button" aria-label={st('Play')} aria-pressed={t.playing} title={st('Play / Pause: Space')} aria-keyshortcuts="Space" disabled={!t.duration||t.playing||!!t.countdown} onClick={()=>void t.play()} className={`${button} lmm-transport-play`}><Play size={16} fill="currentColor"/></button>
    <button type="button" aria-label={st('Pause')} title={st('Pause')} disabled={!t.playing&&!t.countdown} onClick={t.pause} className={button}><Pause size={16} fill="currentColor"/></button>
    <button type="button" aria-label={st('Stop')} title={st('Stop')} onClick={t.stop} disabled={!t.duration} className={button}><Square size={13} fill="currentColor"/></button>
    <button type="button" disabled aria-label={st('Record MIDI — coming soon')} title={st('Record MIDI — coming soon')} className="lmm-transport-button lmm-transport-record flex shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 disabled:cursor-not-allowed"><span aria-hidden="true" className="h-3.5 w-3.5 rounded-full bg-red-500 shadow-[0_0_7px_#ef444440]" /></button>
   </div>
   <div className="lmm-transport-display">
    <div className="lmm-transport-clock">
     <span className="lmm-transport-caption"><i aria-hidden="true"/>{st(t.countdown?'Pre-count':'Time')}</span>
     <output aria-label={st('Time')} className="lmm-transport-digits">{t.countdown ? String(t.countdown).padStart(2,'0') : <>{transportTime(t.currentMs).slice(0,-4)}<span className="lmm-transport-fraction">{transportTime(t.currentMs).slice(-4)}</span></>}</output>
    </div>
    <div className="lmm-transport-position" aria-label={`${st('Measure')} · ${st('Beat')} · ${st('Ticks')}`}>
     {[{label:st('Measure'),value:String(t.bars.length?t.index+1:0).padStart(3,'0')},{label:st('Beat'),value:String(t.beat)},{label:st('Ticks'),value:String(t.tick).padStart(3,'0')}].map(({label,value})=><div key={label}><output>{value}</output><span className="lmm-transport-caption">{label}</span></div>)}
    </div>
    <div className="lmm-transport-tempo"><output>{Number(((t.bars[t.index]?.bpm??0)*t.rate).toFixed(1))}<small> BPM</small></output><span>{Number(t.rate.toFixed(2))}×</span></div>
   </div>
  </div>
  {scoreTempo && t.bars[0] && Math.abs(t.bars[0].bpm-scoreTempo)>.01 && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/25 bg-primary/10 px-3 py-2 text-[11px]">
   <span>{st('Score tempo')}: <b>{scoreTempo} BPM</b> · {st('First measure')}: <b>{t.bars[0].bpm} BPM</b></span>
   {onUseScoreTempo&&<button type="button" onClick={()=>{t.stop();t.changeRate(1);onUseScoreTempo();}} className="rounded border border-primary/40 px-2 py-1 font-medium">{st('Use score tempo')}</button>}
  </div>}
  {overrideBpm!=null&&<div className="border-t border-primary/20 px-3 py-1 text-[10px] text-primary">{st('Admin tempo override')} · {overrideBpm.toFixed(1)} BPM</div>}
  <div id={detailsId} hidden={!expanded} className="space-y-3 border-t border-border bg-muted/20 p-3">
  <input type="range" aria-label={st('Playback position')} min={0} max={t.duration||1} step={1} value={t.currentMs} disabled={!t.duration} onChange={e=>t.seek(Number(e.target.value))} className="block h-1 w-full accent-primary"/>
  <div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>{st('Duration')} {transportTime(t.duration)}</span><span>{t.bars.length} {st('Measures')}</span></div>
  <div className="flex items-center gap-2 border-t border-border pt-2"><button type="button" aria-label={st('Metronome')} aria-pressed={t.metronome} onClick={()=>{if(!t.metronome&&t.volume===0)t.setVolume(.2);t.setMetronome(!t.metronome);}} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-muted"><Pendulum size="sm" swingStyle={{}}/><span>{st('Metronome')}</span><span>{t.metronome?'✓':'—'}</span></button><input aria-label={st('Metronome volume')} type="range" min={0} max={1} step={.01} value={t.volume} onChange={e=>t.setVolume(Number(e.target.value))} className="min-w-0 flex-1 accent-primary"/></div>
  <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
   <label>{st('Tempo BPM')}<input aria-label={st('Tempo BPM')} type="number" step="0.1" min={(t.bars[t.index]?.bpm??120)*.1} max={(t.bars[t.index]?.bpm??120)*2} value={Number(((t.bars[t.index]?.bpm??120)*t.rate).toFixed(1))} onChange={e=>t.changeRate(Number(e.target.value)/(t.bars[t.index]?.bpm??120))} className="mt-1 w-full rounded border border-border bg-background px-2 py-1"/></label>
   <label>{st('Playback speed')}<input aria-label={st('Playback speed')} type="number" min="0.1" max="2" step="0.05" value={Number(t.rate.toFixed(3))} onChange={e=>t.changeRate(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-2 py-1"/></label>
   <button type="button" onClick={()=>t.changeRate(1)} title={`${scoreTempo??t.bars[0]?.bpm??120} BPM / 1×`} className="justify-self-start self-center rounded border border-primary/30 bg-primary/10 px-2 py-1 text-left text-[11px] text-primary hover:bg-primary/20">{st('Reset original tempo')}</button>
   <div className="flex flex-wrap items-center gap-2 self-center">
    <label htmlFor={`${detailsId}-precount`}>{st('Pre-count')}</label>
    <Select value={String(t.countInBars)} onValueChange={value=>t.setCountInBars(Number(value) as 0|1|2)}>
     <SelectTrigger id={`${detailsId}-precount`} aria-label={st('Pre-count')} size="sm" className="h-7 min-w-28 bg-background px-2 text-[11px]"><SelectValue /></SelectTrigger>
     <SelectContent position="popper" className="z-[250] border-primary/30">
      {[{value:'0',label:st('Off')},{value:'1',label:`1 ${st('Measure')}`},{value:'2',label:`2 ${st('Measures')}`}].map(option=><SelectItem key={option.value} value={option.value} className="text-xs focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary">{option.label}</SelectItem>)}
     </SelectContent>
    </Select>
   </div>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <button type="button" title={st('Previous measure')} aria-label={st('Previous measure')} disabled={!t.duration||t.index===0} onClick={()=>t.seekBar(t.index-1)} className={button}><ChevronLeft size={16}/></button>
   <button type="button" title={st('Next measure')} aria-label={st('Next measure')} disabled={!t.duration||t.index>=t.bars.length-1} onClick={()=>t.seekBar(t.index+1)} className={button}><ChevronRight size={16}/></button>
   <label htmlFor={`${detailsId}-jump`}>{st('Go to measure')}</label><input id={`${detailsId}-jump`} type="number" min={1} max={t.bars.length||1} value={target} aria-invalid={target!==''&&!canJump} onChange={e=>setTarget(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();jumpToMeasure();}}} className="w-14 rounded border border-border bg-background px-2 py-1"/><button type="button" onClick={jumpToMeasure} disabled={!canJump} className="rounded border border-primary/40 bg-primary/15 px-2 py-1 text-primary hover:bg-primary/25 disabled:opacity-30">{st('Go')}</button>
  </div>
  <details className="border-t border-border pt-2">
   <summary className="cursor-pointer text-xs font-medium text-primary">{st('Planned MIDI and playback options')}</summary>
   <p className="mt-2 text-xs text-muted-foreground">{st('Preview only — these controls are not enabled yet.')}</p>
   <fieldset disabled className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground [&_input]:mt-1 [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-border [&_input]:bg-background [&_input]:px-2 [&_input]:py-1 [&_select]:mt-1 [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-border [&_select]:bg-background [&_select]:px-2 [&_select]:py-1">
    <label>{st('MIDI input')}<select defaultValue="pending"><option value="pending">{st('Connect a MIDI device')}</option></select></label>
    <label>{st('Playback repeats')}<input type="number" defaultValue={1} min={1}/></label>
    <label>{st('Playback style')}<select defaultValue="standard"><option value="standard">{st('Standard')}</option></select></label>
    <label>{st('Swing')}<input type="number" defaultValue={0} min={0} max={100}/></label>
    <label>{st('Base key velocity')}<input type="number" defaultValue={64} min={1} max={127}/></label>
    <label>{st('Scrolling playback')}<select defaultValue="on"><option value="on">{st('On')}</option><option value="off">{st('Off')}</option></select></label>
    <label>{st('Playback region — from measure')}<input type="number" defaultValue={1} min={1}/></label>
    <label>{st('Playback region — to measure')}<input type="number" defaultValue={t.bars.length||1} min={1}/></label>
    <button type="button" className="col-span-2 rounded border border-border px-3 py-2">{st('Playback / Record options')}</button>
   </fieldset>
  </details>
  </div>
  {t.error&&<p role="alert" className="px-3 pb-2 text-destructive">{st(t.error)}</p>}
 </form>;
}
