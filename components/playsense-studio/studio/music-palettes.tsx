'use client';

import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/components/language-provider';
import { symbolCaption } from '@/lib/playsense-studio/i18n/text';
import { PALETTE_COMMANDS } from '@/lib/playsense-studio/palette-actions';
import { useStudioText } from './use-studio-text';
import { symbols } from './palette-catalog';
import { PaletteGlyph } from './palette-glyph';

export const commonPalettes: Record<string, string[]> = {
  'Main': ['noteQuarterUp','restQuarter','Puntillo','Tresillo','accidentalSharp','accidentalFlat','dynamicMF','articAccentAbove','articStaccatoAbove','Ligadura de unión','Ligadura de expresión','Crescendo'],
  'Notes': ['noteWhole','noteHalfUp','noteQuarterUp','note8thUp','note16thUp','note32ndUp','note64thUp','Puntillo','Doble puntillo','graceNoteAcciaccaturaStemUp','graceNoteAppoggiaturaStemUp'],
  'Rests': ['restWhole','restHalf','restQuarter','rest8th','rest16th','rest32nd','rest64th'],
  'Dinámica': ['dynamicPPP','dynamicPP','dynamicPiano','dynamicMP','dynamicMF','dynamicForte','dynamicFF','dynamicFFF','dynamicSforzato','dynamicFortePiano'],
  'Articulaciones': ['articAccentAbove','articStaccatoAbove','articTenutoAbove','articStaccatissimoAbove','articMarcatoAbove','fermataAbove'],
  'Líneas y reguladores': ['Crescendo','Diminuendo','Ligadura de unión','Ligadura de expresión','ottava','ottavaBassa'],
  'Alteraciones y microtonos': ['accidentalFlat','accidentalNatural','accidentalSharp','accidentalDoubleFlat','accidentalDoubleSharp'],
  'Grupos irregulares': ['Dosillo','Tresillo','Quintillo','Seisillo','Septillo'],
  'Claves y pentagramas': ['gClef','fClef','cClef','unpitchedPercussionClef1','sixStringTabClef'],
  'Compás y barras': ['timeSigCommon','timeSigCutCommon','barlineSingle','barlineDouble','barlineFinal'],
  'Repeticiones y navegación': ['repeatLeft','repeatRight','repeat1Bar','segno','coda','daCapo','dalSegno'],
  'Tempo y agógica': ['Largo','Adagio','Andante','Moderato','Allegro','Presto','ritardando','accelerando','a tempo','breathMarkComma','caesura'],
  'Adornos y trémolos': ['ornamentTrill','ornamentMordent','ornamentTurn','tremolo1','tremolo2','tremolo3'],
  'Arpa y pedales': ['harpPedalRaised','harpPedalCentered','harpPedalLowered','harpPedalDivider'],
  'Cuerdas y arcos': ['stringsDownBow','stringsUpBow','stringsHarmonic','pluckedLeftHandPizzicato'],
  'Guitarra y tablatura': ['guitarOpenPedal','guitarClosePedal','guitarGolpe'],
  'Vientos': ['brassMuteOpen','brassMuteClosed','doubleTongueAbove','tripleTongueAbove'],
  'Percusión': ['pictSnareDrum','pictBassDrum','pictHiHat','pictSuspendedCymbal','pictTriangle'],
  'Teclados y pedal': ['keyboardPedalPed','keyboardPedalUp','keyboardPedalHalf'],
  'Armonía y bajo cifrado': ['csymDiminished','csymHalfDiminished','csymAugmented','csymMajorSeventh'],
  'Voz y digitación': ['fingering0','fingering1','fingering2','fingering3','fingering4','fingering5'],
};
const commonNames = new Set(Object.values(commonPalettes).flat());
const extras = symbols.filter(s => !commonNames.has(s.name));
const extraFamilies = [...new Set(extras.map(s => s.family))];
const PALETTE_WIDTH = 224;
const paletteWidth = (id: string) => id === 'playback' ? 620 : PALETTE_WIDTH;
const storageKey = 'lmm-floating-palettes-v2';

type Position={x:number;y:number};
function FloatingPalette({id,title,position,onMove,onClose,children}:{id:string;title:string;position:Position;onMove:(p:Position)=>void;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLElement>(null);
 const drag=useRef<{x:number;y:number;origin:Position}|null>(null);
 const [availableHeight,setAvailableHeight]=useState<number>();
 useLayoutEffect(()=>{
  const element=ref.current, parent=element?.parentElement;
  if(!element||!parent)return;
  const measure=()=>{
   const top=element.getBoundingClientRect().top;
   const bottom=Math.min(parent.getBoundingClientRect().bottom,window.innerHeight);
   setAvailableHeight(Math.max(36,bottom-top-8));
  };
  measure();
  const observer=new ResizeObserver(measure);observer.observe(parent);
  window.addEventListener('resize',measure);
  window.addEventListener('scroll',measure,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[position.y]);
 return <section ref={ref} data-palette={id} aria-label={title} data-score-preserve-selection className="pointer-events-auto absolute flex max-w-full flex-col overflow-hidden rounded-md border border-border bg-card text-foreground shadow-lg" style={{left:position.x,top:position.y,width:paletteWidth(id),maxHeight:availableHeight,overflow:"hidden"}}>
  <div className="lmm-palette-header flex shrink-0 touch-none select-none items-center justify-between border-b border-border bg-muted px-2 py-0.5 text-[11px]" style={{cursor:'grab'}}
   onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;drag.current={x:e.clientX,y:e.clientY,origin:position};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const parent=ref.current?.parentElement;onMove({x:Math.max(0,Math.min((parent?.clientWidth??1000)-(ref.current?.offsetWidth??224),d.origin.x+e.clientX-d.x)),y:Math.max(0,Math.min((parent?.clientHeight??600)-36,d.origin.y+e.clientY-d.y))});}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
   <h3 className="font-medium">{title}</h3><button aria-label={`× ${title}`} onClick={onClose} title={`${title} · ×`} className="lmm-palette-close"><X size={15} strokeWidth={2} aria-hidden="true"/></button>
  </div>
  <div data-palette-scroll className="min-h-0 overflow-auto overscroll-contain" style={{scrollbarGutter:"stable"}}>{children}</div>
 </section>;
}

export function MusicPalettes({hasSelection,hasMeasureSelection,onApply,onWrite,open,onCloseMenu,playback}: {
 hasSelection:boolean;hasMeasureSelection:boolean;onWrite?:(symbol:string)=>void;onApply:(symbol:string)=>string|void;
 open:boolean;onCloseMenu:()=>void;playback?:ReactNode;
}) {
 const st=useStudioText();const {locale}=useTranslation();
 const [tab,setTab]=useState<'common'|'extras'>('common');
 const [panels,setPanels]=useState(['common:Main','common:Notes','common:Rests','playback']);
 const [positions,setPositions]=useState<Record<string,Position>>({});
 const [favorites,setFavorites]=useState<string[]>([]);
 const [query,setQuery]=useState('');const [detail,setDetail]=useState('');const [feedback,setFeedback]=useState('');
 const [activePanel,setActivePanel]=useState('');
 const menuRef=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{
   const target=e.target as Element;
   if(!menuRef.current?.contains(target)&&!target.closest('[data-palette-menu-toggle]'))onCloseMenu();
  };
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onCloseMenu();};
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);};
 },[open,onCloseMenu]);
 const layer=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(1200);
 const [height,setHeight]=useState(600);
 useEffect(()=>{const el=layer.current;if(!el)return;const resize=()=>{setWidth(el.clientWidth||1200);setHeight(el.clientHeight||600);};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem(storageKey)??'null');if(p){if(Array.isArray(p.panels))setPanels(p.panels.filter((k:string)=>k==='playback'||k==='favorites'||(k.startsWith('common:')&&k.slice(7) in commonPalettes)||(k.startsWith('extras:')&&extraFamilies.includes(k.slice(7)))));setPositions(p.positions??{});setFavorites(p.favorites??[]);}}catch{}},[]);
 const persist=(p=panels,pos=positions,f=favorites)=>{try{localStorage.setItem(storageKey,JSON.stringify({panels:p,positions:pos,favorites:f}));}catch{}};
 const toggle=(key:string)=>{const next=panels.includes(key)?panels.filter(p=>p!==key):[...panels,key];setPanels(next);persist(next);};
 const caption=(s:typeof symbols[number])=>s.glyph.codePointAt(0)!>=0xE000?symbolCaption(s.name,locale):st(s.label);
 const chosen=symbols.find(s=>s.name===detail);
 const canApply=chosen&&PALETTE_COMMANDS[chosen.name]&&(hasSelection||(hasMeasureSelection&&PALETTE_COMMANDS[chosen.name].kind==='measure'));
 const title=(key:string)=>key==='playback'?st('Score playback'):key==='favorites'?st('Favorites'):`${key.startsWith('extras:')?st('Extras')+' · ':''}${st(key.slice(7))}`;
 const keys=tab==='common'?['common:Main','favorites',...(playback?['playback']:[]),...Object.keys(commonPalettes).filter(c=>c!=='Main').map(c=>'common:'+c)]:extraFamilies.map(c=>'extras:'+c);
 return <div ref={layer} className="pointer-events-none absolute inset-0 z-40" aria-label={st('Paletas musicales')}>
  {open&&<aside ref={menuRef} data-score-preserve-selection className="lmm-palette-chooser pointer-events-auto absolute right-2 top-12 z-50 w-56 max-w-full rounded-xl border border-border bg-card p-2 text-foreground shadow-xl">
   <div className="mb-2 flex items-center justify-between text-xs font-semibold">{st('Paletas musicales')}<button type="button" onClick={onCloseMenu} aria-label={st('Close palette menu')} title={st('Close palette menu')} className="lmm-palette-close"><X size={15} strokeWidth={2} aria-hidden="true"/></button></div>
   <div role="tablist" aria-label={st('Palette collection')} className="mb-2 flex gap-1 rounded-lg bg-muted p-1">{(['common','extras'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)} className={`flex-1 rounded-md py-1 text-xs ${tab===t?'bg-background shadow-sm':''}`}>{st(t==='common'?'Common symbols':'Extras')}</button>)}</div>
   <input aria-label={st('Search categories')} placeholder={st('Search categories')} value={query} onChange={e=>setQuery(e.target.value)} className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"/>
   <div className="max-h-64 overflow-y-auto">{keys.filter(k=>title(k).toLowerCase().includes(query.toLowerCase())).map(key=><label key={key} className={`lmm-palette-menu-row flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs ${['common:Notes','common:Claves y pentagramas','common:Arpa y pedales'].includes(key)?'mt-1 border-t border-border pt-2':''}`}><input type="checkbox" checked={panels.includes(key)} onChange={()=>toggle(key)} className="lmm-menu-check"/>{title(key)}</label>)}</div>
  </aside>}
  {panels.filter(k=>k!=='playback'||playback).map((key,index)=>{
   const cols=Math.max(1,Math.floor(width/232));const initial={x:8+(index%cols)*232,y:56+Math.floor(index/cols)*126};
   const saved=positions[key]??initial;const position={x:Math.max(0,Math.min(width-paletteWidth(key),saved.x)),y:Math.max(0,Math.min(height-40,saved.y))};
   const names=key==='favorites'?favorites:commonPalettes[key.slice(7)]??[];
   const list=key.startsWith('extras:')?extras.filter(s=>s.family===key.slice(7)):names.map(n=>symbols.find(s=>s.name===n)).filter((s):s is typeof symbols[number]=>!!s);
   return <FloatingPalette key={key} id={key} title={title(key)} position={position} onClose={()=>toggle(key)} onMove={p=>{const next={...positions,[key]:p};setPositions(next);persist(panels,next);}}>
    {key==='playback'?playback:<>
     <div className="grid max-h-48 grid-cols-6 gap-0.5 overflow-y-auto p-1">{list.map(s=><button key={s.name} aria-label={caption(s)} title={`${caption(s)} — ${st(PALETTE_COMMANDS[s.name]?'Connected: select notes or measures to apply.':'Catalog only: not available for editing yet.')}`} aria-pressed={detail===s.name} data-command-status={PALETTE_COMMANDS[s.name]?'ready':'catalog'} onClick={()=>{setDetail(s.name);setActivePanel(key);setFeedback('');}} className={`lmm-palette-symbol flex h-7 items-center justify-center overflow-hidden rounded border p-0.5 ${detail===s.name?'border-transparent bg-primary/15':'border-transparent'} ${s.glyph.length>4?'col-span-2':''}`}><PaletteGlyph glyph={s.glyph}/></button>)}</div>
     {!list.length&&<p className="p-3 text-xs text-muted-foreground">{st('Choose a symbol and use the star to save it here.')}</p>}
     {chosen&&activePanel===key&&<div className="space-y-2 border-t border-border p-2 text-xs"><div className="flex items-center justify-between gap-2"><span>{caption(chosen)}</span><button aria-label={st('Toggle favorite')} aria-pressed={favorites.includes(chosen.name)} onClick={()=>{const f=favorites.includes(chosen.name)?favorites.filter(n=>n!==chosen.name):[...favorites,chosen.name];setFavorites(f);persist(panels,positions,f);}} className="px-2 text-primary">{favorites.includes(chosen.name)?'★':'☆'}</button></div>{onWrite && PALETTE_COMMANDS[chosen.name]?.kind==='rhythm' && <button disabled={!hasMeasureSelection && !hasSelection} onClick={()=>onWrite(chosen.name)} className="w-full rounded border border-primary/50 bg-primary/15 px-2 py-2 text-primary disabled:opacity-40">{st(hasMeasureSelection || hasSelection ? "Write in measure" : "Select a measure to write")}</button>}{PALETTE_COMMANDS[chosen.name]?<button disabled={!canApply} onClick={()=>setFeedback(onApply(chosen.name)||'Applied to the score. Undo is available.')} className="w-full rounded bg-primary px-2 py-1.5 text-primary-foreground disabled:opacity-40">{st(canApply?'Aplicar a la selección':'Select a note or measure first.')}</button>:<p className="text-muted-foreground">{st('Disponible para consultar. Su colocación y reproducción están pendientes de conectar.')}</p>}{feedback&&<p role="status">{st(feedback)}</p>}</div>}
    </>}
   </FloatingPalette>;
  })}
 </div>;
}
