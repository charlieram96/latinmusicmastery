 'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import type { StageLane } from './model'
export function InstrumentLayout({lanes, hidden, scoreInstruments, onVisibilityChange, disabled, onChange}:{lanes:StageLane[];hidden:readonly string[];scoreInstruments:string[];onVisibilityChange:(ids:string[])=>boolean;disabled:boolean;onChange:(ids:string[])=>boolean}) {
  const {locale} = useTranslation(); const es=locale==='es'
  const [open,setOpen]=useState(false)
  const [drag,setDrag]=useState<string|null>(null)
  const [error,setError]=useState(false)
  const change=(ids:string[])=>setError(!onChange(ids))
  const move=(id:string,to:number)=>{
    const ids=lanes.map(l=>l.id); const from=ids.indexOf(id)
    if(from<0||to<0||to>=ids.length||disabled)return
    ids.splice(from,1);ids.splice(to,0,id);change(ids)
  }
  return <div className="ps-instrument-layout">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{es?'Colocar instrumentos':'Arrange instruments'}</button>
    {open && <section aria-label={es?'Posición de instrumentos':'Instrument positions'}>
      <p>{es?'De izquierda a derecha. Arrastra o usa las flechas.':'Left to right. Drag or use the arrows.'}</p>
      {disabled && <p role="status">{es?'Pausa para cambiar la posición.':'Pause to change positions.'}</p>}
      <div className="ps-layout-actions">
        <button type="button" disabled={disabled} onClick={()=>setError(!onVisibilityChange(lanes.filter(l=>!scoreInstruments.includes(l.id)).map(l=>l.id)))}>{es?'Solo los de la partitura':'Only score instruments'}</button>
        <button type="button" disabled={disabled} onClick={()=>setError(!onVisibilityChange([]))}>{es?'Mostrar todos':'Show all'}</button>
        <button type="button" disabled={disabled} onClick={()=>setError(!onVisibilityChange(lanes.map(l=>l.id)))}>{es?'Ocultar todos':'Hide all'}</button>
      </div>
      <p>{es?'Ocultar cambia la vista; no borra notas ni modifica la evaluación.':'Hiding changes the view; it does not delete notes or change grading.'}</p>
      <ol>{lanes.map((lane,i)=><li key={lane.id} draggable={!disabled} onDragStart={()=>setDrag(lane.id)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag)move(drag,i);setDrag(null)}}>
        <label style={{display:'flex',alignItems:'center',gap:6,flex:1}}><input type="checkbox" checked={!hidden.includes(lane.id)} disabled={disabled} onChange={()=>setError(!onVisibilityChange(hidden.includes(lane.id)?hidden.filter(id=>id!==lane.id):[...hidden,lane.id]))}/><span>{i+1}. {lane.label}</span></label>
        <button type="button" disabled={disabled||i===0} aria-label={`${es?'Mover a la izquierda':'Move left'}: ${lane.label}`} onClick={()=>move(lane.id,i-1)}>←</button>
        <button type="button" disabled={disabled||i===lanes.length-1} aria-label={`${es?'Mover a la derecha':'Move right'}: ${lane.label}`} onClick={()=>move(lane.id,i+1)}>→</button>
      </li>)}</ol>
      <div className="ps-layout-actions"><button type="button" disabled={disabled} onClick={()=>change(lanes.map(l=>l.id).reverse())}>{es?'Invertir lados':'Mirror layout'}</button><button type="button" disabled={disabled} onClick={()=>change([])}>{es?'Restablecer':'Reset'}</button><button type="button" onClick={()=>setOpen(false)}>{es?'Listo':'Done'}</button></div>
      <p role="status">{error?(es?'No se pudo guardar en este navegador.':'Could not save in this browser.'):(es?'Se guarda en este navegador para este instrumento.':'Saved in this browser for this instrument.')}</p>
    </section>}
  </div>
}
