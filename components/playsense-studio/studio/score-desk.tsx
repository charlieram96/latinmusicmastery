'use client';
import {exercisePlaybackScore} from '@/lib/playsense-studio/playback-tempo';
import { ScorePlaybackControls } from './score-playback-controls';
import { MusicPalettes } from './music-palettes';
import { useSpacePlayback } from './use-space-playback';
import { useScoreTransport } from './use-score-transport';
import type { ScoreHit } from '@/lib/playsense-studio/notation/score-selection';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MultiStaffRenderer, type MultiStaffRendererProps } from '../player/notation/renderers/multi-staff-renderer';

export function ScoreDesk({ exerciseTempo = false, linear = false, onPan, children, onApply, onWrite, onEdit, onDelete, onUseScoreTempo, onTempoOverride, hasSelection, hasMeasureSelection = false, tools, editingTools, ...props }: MultiStaffRendererProps & { exerciseTempo?:boolean; linear?: boolean; onTempoOverride?: (bpm:number|null)=>void; onUseScoreTempo?: ()=>void; onPan?: (dx:number)=>void; children?: ReactNode; hasSelection: boolean; hasMeasureSelection?: boolean; tools?: ReactNode; editingTools?: ReactNode; onEdit: ()=>void; onDelete: ()=>void; onWrite?: (symbol:string)=>void; onApply: (symbol:string)=>string | void }) {
  const st = useStudioText();
  const playbackScore=useMemo(()=>exerciseTempo?exercisePlaybackScore(props.score):props.score,[exerciseTempo,props.score]);
  const transport = useScoreTransport(playbackScore, props.trackIndex);
  const [playbackSelection,setPlaybackSelection]=useState<ScoreHit|null>(null);
  const seekEvent=useRef(transport.seekEvent);
  seekEvent.current=transport.seekEvent;
  useEffect(()=>{
    if(linear || !playbackSelection || playbackSelection.track!==props.trackIndex)return;
    // Run after a selected staff becomes active, so its transport reset cannot
    // overwrite the position. Selection changes only; playback never seeks itself.
    seekEvent.current(playbackSelection.measure,playbackSelection.event??0,playbackSelection.voice??0);
  },[playbackSelection,props.trackIndex,linear]);
  const changePlaybackRate = (rate:number) => {
    if(!Number.isFinite(rate)||rate<=0)return;
    const next=Math.max(.1,Math.min(2,rate));
    transport.changeRate(next);
    onTempoOverride?.(Math.abs(next-1)<.00001?null:props.score.initialTempo*next);
  };
  useSpacePlayback(!linear && transport.duration > 0, () => { if (transport.playing) transport.pause(); else transport.play(); });
  const [zoom,setZoom]=useState(1);
  const [open,setOpen]=useState(false);
  const area=useRef<HTMLDivElement>(null);
  const clamp=(z:number)=>Math.max(.1,Math.min(4,z));
  useEffect(()=>{ try { const p=JSON.parse(localStorage.getItem('lmm-score-desk')??'null'); if(p){setZoom(clamp(p.zoom??1));} }catch{} },[]);
  const save=(z=zoom,o=open)=>{try{localStorage.setItem('lmm-score-desk',JSON.stringify({zoom:z,open:o}));}catch{}};
  const changeZoom=(z:number)=>{const next=clamp(z);setZoom(next);save(next);};
  useEffect(()=>{
    const el=area.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{
      if(e.defaultPrevented || (e.target instanceof Element && e.target.closest('[data-palette]')))return;
      if(e.ctrlKey){if(linear)return;e.preventDefault();setZoom(z=>clamp(z*Math.exp(-e.deltaY*.008)));return;}
      if(!e.deltaX && !e.shiftKey)return;
      // Consume horizontal gestures even at either edge, so Chrome cannot
      // turn a timeline pan into back/forward navigation.
      e.preventDefault();
      const scale=e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1;
      const dx=(e.deltaX || e.deltaY)*scale;
      if(linear){onPan?.(dx);return;}
      const scroller=el.querySelector<HTMLElement>('[role="region"]');
      if(scroller){scroller.scrollLeft+=dx;if(!e.shiftKey)scroller.scrollTop+=e.deltaY*scale;}
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[linear,onPan]);
  return <div className={`relative flex flex-col rounded-xl border border-border bg-muted ${linear ? "" : "h-full min-h-[480px] overflow-hidden"}`} data-testid="score-desk">
    <style>{`@font-face{font-family:LMMBravura;src:url('/fonts/notation/bravura.woff2') format('woff2')} .lmm-symbol{font-family:LMMBravura,serif} .lmm-desk-tools .st-strip-corner{position:static;transform:none}`}</style>
    <div role="toolbar" aria-label={st("Score workspace")} className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 text-xs text-foreground">
      <span className="mr-auto font-semibold tracking-wide">{st(linear ? "Sync video" : "PARTITURA")}<span className="ml-2 font-normal text-muted-foreground">{st("Vista de trabajo")}</span></span>
      {!linear && <>
      <button onClick={()=>changeZoom(zoom/1.2)} aria-label={st("Alejar partitura")}>−</button>
      <input aria-label={st("Zoom de la partitura")} type="range" min="10" max="400" value={Math.round(zoom*100)} onChange={e=>changeZoom(Number(e.target.value)/100)} className="w-24 accent-amber-500" />
      <button onClick={()=>changeZoom(zoom*1.2)} aria-label={st("Acercar partitura")}>+</button>
      <button onClick={()=>changeZoom(1)} className="w-12">{Math.round(zoom*100)}%</button>
      <button onClick={()=>changeZoom(((area.current?.clientWidth??1040)-32)/1040)}>{st("Al ancho")}</button>
      <button onClick={()=>changeZoom(Math.min(((area.current?.clientWidth??1040)-32)/1040,((area.current?.clientHeight??480)-32)/1300))}>{st("Página")}</button>
      </>}
      <button disabled={!hasSelection && !hasMeasureSelection} title={st(hasSelection || hasMeasureSelection ? "Editar nota" : "Select a note or measure first.")} onClick={onEdit} className="rounded border border-border px-2 py-1 disabled:opacity-40">{st("Editar nota")}</button>
      <button disabled={!hasSelection} title={st(hasSelection ? "Borrar notas" : "Select a note or measure first.")} onClick={onDelete} className="rounded border border-border px-2 py-1 disabled:opacity-40">{st("Borrar notas")}</button>
      <div className="lmm-desk-tools flex items-center gap-2">{tools}</div>
      <button data-palette-menu-toggle aria-expanded={open} onClick={()=>{setOpen(!open);save(zoom,!open);}} className="rounded border border-border px-2 py-1">{st(open?'Ocultar paletas':'Mostrar paletas')}</button>
    </div>
    {editingTools}
    <div className="relative flex min-h-0 flex-1 flex-col">
    <MusicPalettes open={open} onCloseMenu={()=>setOpen(false)} hasSelection={hasSelection} hasMeasureSelection={hasMeasureSelection} onApply={onApply} onWrite={onWrite} playback={!linear ? <ScorePlaybackControls transport={{...transport,changeRate:changePlaybackRate}} overrideBpm={props.score.playbackTempoOverride} scoreTempo={props.score.initialTempo} onUseScoreTempo={onUseScoreTempo}/> : undefined} />
    <div className={`flex min-h-0 flex-1 ${linear ? "flex-col" : ""}`}>
      <div ref={area} data-testid="score-pan-area" className={linear ? "min-w-0 overflow-hidden" : "min-w-0 flex-1 overflow-hidden p-4"} style={{overscrollBehaviorX:'none',...(linear ? {} : {color:'#24221f'})}}>
        {linear ? children : <MultiStaffRenderer {...props} score={playbackScore} pages zoom={zoom} currentMs={transport.currentMs} showCursor autoFollow
          onSelectMeasure={props.onSelectMeasure??(()=>{})}
          onSelectionChange={hits=>{
            setPlaybackSelection(hits[0]?{...hits[0]}:null);
            props.onSelectionChange?.(hits);
            if(!props.onSelectionChange && hits.length===1 && hits[0].kind==='measure')props.onSelectMeasure?.(hits[0].track,hits[0].measure);
          }}
          onNoteInput={(hit,line)=>{const handled=props.onNoteInput?.(hit,line)??false;if(handled)setPlaybackSelection({...hit});return handled;}}
        />}
      </div>

    </div>
    </div>
  </div>;
}
