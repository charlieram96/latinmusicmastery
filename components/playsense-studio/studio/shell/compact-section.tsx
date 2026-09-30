'use client';
import {useEffect,useId,useState,type ReactNode} from 'react';
import {ChevronDown,ChevronUp,type LucideIcon} from 'lucide-react';
import {useStudioText} from '../use-studio-text';

/** Keep editors and audio engines mounted when their visual lane is folded. */
export function CompactSection({name,storageId,icon:Icon,grow=false,children}:{name:string;storageId:string;icon:LucideIcon;grow?:boolean;children:ReactNode}) {
 const st=useStudioText(),id=useId();
 const [compact,setCompact]=useState(false);
 useEffect(()=>{try{setCompact(localStorage.getItem(`lmm-compact-${storageId}`)==='true');}catch{}},[storageId]);
 const toggle=()=>setCompact(current=>{const next=!current;try{localStorage.setItem(`lmm-compact-${storageId}`,String(next));}catch{}return next;});
 return <section data-compact-section={storageId} className={`flex min-h-0 min-w-0 flex-col ${grow&&!compact?'flex-1':'shrink-0'}`}>
  <button type="button" data-score-preserve-selection onClick={toggle} aria-expanded={!compact} aria-controls={id} aria-label={`${st(compact?'Expand':'Compact')} · ${st(name)}`} className="lmm-section-fold">
   <span className="lmm-section-fold-icon"><Icon size={15} aria-hidden="true"/></span>
   <span>{st(name)}</span>
   {compact&&<span className="lmm-section-fold-status">{st('Compact view')}</span>}
   <span className="lmm-section-fold-arrow">{compact?<ChevronDown size={15}/>:<ChevronUp size={15}/>}</span>
  </button>
  <div id={id} inert={compact} aria-hidden={compact} className={`min-h-0 min-w-0 ${grow&&!compact?'flex flex-1 flex-col':''}`} style={compact?{height:0,overflow:'hidden',visibility:'hidden'}:undefined}>{children}</div>
 </section>;
}
