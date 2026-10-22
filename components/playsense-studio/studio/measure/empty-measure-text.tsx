'use client';
import {useState} from 'react';
import {useStudioText} from '../use-studio-text';
export function EmptyMeasureText({current,onSave,onClose}:{current?:{text:string;fontSize:number};onSave:(value:{text:string;fontSize:number}|null)=>void;onClose:()=>void}) {
 const st=useStudioText();
 const [text,setText]=useState(current?.text??st('Instructor speaking'));
 const [size,setSize]=useState(current?.fontSize??16);
 return <form data-score-preserve-selection aria-label={st('Measure text')} className="flex flex-wrap items-center gap-2 rounded border border-border bg-card p-2 text-xs" onSubmit={e=>{e.preventDefault();onSave(text.trim()?{text,fontSize:size}:null);onClose();}}>
  <label>{st('Measure text')} <input aria-label={st('Measure text')} value={text} maxLength={200} onChange={e=>setText(e.target.value)} className="rounded border bg-background p-2"/></label>
  <label>{st('Text size')} <input aria-label={st('Text size')} type="number" min={10} max={48} value={size} onChange={e=>setSize(Number(e.target.value))} className="w-16 rounded border bg-background p-2"/></label>
  <button type="submit" className="rounded bg-primary px-3 py-2 text-primary-foreground">{st('Apply text')}</button>
  <button type="button" onClick={()=>{onSave(null);onClose();}} className="rounded border px-3 py-2">{st('Use automatic rest')}</button>
  <button type="button" onClick={onClose} className="rounded border px-3 py-2">{st('Cancel')}</button>
 </form>;
}
