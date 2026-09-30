'use client';
import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {useStudioText} from './use-studio-text';
const groups:[string,[number,number][]][]=[
 ['Simple duple',[[2,2],[2,4],[2,8]]],['Simple triple',[[3,2],[3,4],[3,8]]],['Simple quadruple',[[4,2],[4,4],[4,8]]],
 ['Compound',[[6,4],[6,8],[9,8],[12,8],[12,16]]],['Irregular',[[5,4],[5,8],[7,4],[7,8],[8,8],[10,8],[11,8],[13,8]]],
];
export function TimeSignaturePicker({value,onChange}:{value:[number,number];onChange:(value:[number,number])=>void}) {
 const st=useStudioText();const [open,setOpen]=useState(false);const [num,setNum]=useState(String(value[0]));const [den,setDen]=useState(String(value[1]));
 const valid=Number.isInteger(Number(num))&&Number(num)>=1&&Number(num)<=64&&[1,2,4,8,16,32,64].includes(Number(den));
 const choose=(v:[number,number])=>{onChange(v);setNum(String(v[0]));setDen(String(v[1]));setOpen(false);};
 return <div>
  <button type="button" aria-label={st('Time signature')} aria-expanded={open} onClick={()=>setOpen(!open)} className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 font-mono"><span>{value.join('/')}</span><ChevronDown size={15} className={open?'rotate-180':''}/></button>
  {open&&<div className="mt-2 space-y-3 rounded-xl border border-border bg-card p-3">
   {groups.map(([label,meters])=><fieldset key={label}><legend className="mb-1 text-xs text-muted-foreground">{st(label)}</legend><div className="grid grid-cols-3 gap-1">{meters.map(v=><button type="button" key={v.join('/')} aria-pressed={v.join('/')===value.join('/')} onClick={()=>choose(v)} className={`rounded-md border border-border py-1.5 font-mono text-xs ${v.join('/')===value.join('/')?'bg-primary/15 text-primary':'hover:bg-muted'}`}>{v.join('/')}</button>)}</div></fieldset>)}
   <fieldset className="border-t border-border pt-2"><legend className="text-xs font-semibold">{st('Custom')}</legend><div className="mt-1 flex items-center gap-2"><input type="number" min={1} max={64} step={1} value={num} onChange={e=>setNum(e.target.value)} aria-label={st('Beats per measure')} className="st-input w-16"/><span>/</span><select aria-label={st('Beat unit')} value={den} onChange={e=>setDen(e.target.value)} className="st-input w-16">{[1,2,4,8,16,32,64].map(d=><option key={d}>{d}</option>)}</select><button type="button" disabled={!valid} onClick={()=>choose([Number(num),Number(den)])} className="rounded-md bg-primary px-2 py-2 text-xs text-primary-foreground disabled:opacity-40">{st('Apply')}</button></div></fieldset>
   <p className="text-xs leading-relaxed text-muted-foreground">{st('Applies to every measure. Existing notes are kept; check any measures that no longer fit.')}</p>
  </div>}
 </div>;
}
