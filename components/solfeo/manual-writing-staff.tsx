'use client'
import {useBookTranslation} from './use-book-translation'
import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {lessonNote} from '@/lib/solfeo/notes'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
const pitches=['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5']
const labels=['Do4','Re4','Mi4','Fa4','Sol4','La4','Si4','Do5','Re5','Mi5','Fa5','Sol5','La5']
/** Editable practice staff. Pitch spelling, staff position and playback share one value. */
export function ManualWritingStaff({settings}:{settings:DemonstrationSettings&{volume?:number}}){
 const {t,es}=useBookTranslation()
 const [notes,setNotes]=useState<{pitch:string;dur:number;dot?:boolean}[]>([{pitch:'G4',dur:2},{pitch:'G4',dur:4},{pitch:'G4',dur:8}]),[selected,setSelected]=useState(0),[beams,setBeams]=useState(false)
 const demo=useNoteDemonstration(settings)
 const change=(patch:Partial<typeof notes[number]>)=>{demo.stop();setNotes(notes.map((n,i)=>i===selected?{...n,...patch}:n))}
 return <div className="space-y-3 rounded-xl border border-primary/25 p-4"><p className="text-sm font-semibold text-primary">{t("Ejemplo editable · Cambia las notas y sus figuras")}</p>
 <div className="overflow-x-auto"><svg viewBox="0 0 640 160" role="group" aria-label={t("Pentagrama editable")} className="min-w-[420px] w-full" style={{height:190}}>
 {[50,62,74,86,98].map(y=><line key={y} x1="15" x2="625" y1={y} y2={y} stroke="currentColor" opacity=".6"/>)}
 <text x="20" y="86" fontSize="48" fill="currentColor" style={{fontFamily:'Bravura'}}></text>
 {notes.map((n,i)=>{const y=110-pitches.indexOf(n.pitch)*6,x=100+i*70,joined=beams&&n.dur===8&&(notes[i-1]?.dur===8||notes[i+1]?.dur===8);return <g key={i} role="button" tabIndex={0} aria-label={`${es?"Seleccionar nota":"Select note"} ${i+1}: ${labels[pitches.indexOf(n.pitch)]}`} onClick={()=>{setSelected(i);void demo.play([{frequency:lessonNote(n.pitch).frequency,beats:4/n.dur*(n.dot?1.5:1),index:i}],{preview:true})}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i)}}} style={{cursor:'pointer'}}>
 <rect x={x-18} y="12" width="45" height="124" rx="7" fill={demo.active===i?'#ff820044':selected===i?'#ff820018':'transparent'}/>
 {y>=110&&<line x1={x-12} x2={x+13} y1="110" y2="110" stroke="currentColor"/>}{y<=38&&<line x1={x-12} x2={x+13} y1="38" y2="38" stroke="currentColor"/>}
 <ellipse cx={x} cy={y} rx="7" ry="4.6" transform={`rotate(-18 ${x} ${y})`} fill={n.dur<=2?'hsl(var(--background))':'currentColor'} stroke="currentColor" strokeWidth="1.7"/>
 {n.dur!==1&&<line x1={x+6} x2={x+6} y1={y-1} y2={y-33} stroke="currentColor" strokeWidth="1.5"/>}
 {n.dur>=8&&!joined&&<path d={`M${x+6},${y-33} q20,10 3,25 q9,-13 -3,-16`} fill="currentColor"/>}{n.dot&&<circle cx={x+14} cy={y%12===2?y-5:y} r={2} fill="currentColor"/>}{beams&&n.dur===8&&notes[i+1]?.dur===8&&<line x1={x+6} y1={y-33} x2={x+76} y2={110-pitches.indexOf(notes[i+1].pitch)*6-33} stroke="currentColor" strokeWidth={4}/>}<text x={x} y="152" fontSize="12" textAnchor="middle" fill="currentColor">{labels[pitches.indexOf(n.pitch)]}</text></g>})}
 </svg></div>
 <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">{t("Nota")}<select value={notes[selected]?.pitch??'G4'} onChange={e=>change({pitch:e.target.value})} className="rounded border bg-background p-2">{pitches.map((p,i)=><option key={p} value={p}>{labels[i]}</option>)}</select></label><label className="flex items-center gap-2 text-sm">{t("Figura")}<select value={notes[selected]?.dur??4} onChange={e=>change({dur:Number(e.target.value)})} className="rounded border bg-background p-2">{[1,2,4,8].map((d,i)=><option key={d} value={d}>{t(['Redonda','Blanca','Negra','Corchea'][i])}</option>)}</select></label><Button variant={notes[selected]?.dot?'default':'outline'} aria-pressed={Boolean(notes[selected]?.dot)} onClick={()=>change({dot:!notes[selected]?.dot})}>{t("Puntillo")}</Button><Button variant={beams?'default':'outline'} aria-pressed={beams} onClick={()=>setBeams(!beams)}>{t("Unir corcheas")}</Button><Button variant="outline" disabled={notes.length>=8} onClick={()=>{setNotes([...notes,{pitch:'G4',dur:4}]);setSelected(notes.length)}}>{t("Añadir nota")}</Button><Button variant="outline" onClick={()=>demo.playing?demo.stop():void demo.play(notes.map((n,index)=>({frequency:lessonNote(n.pitch).frequency,beats:4/n.dur*(n.dot?1.5:1),index})))}>{t(demo.playing?'Detener':'Escuchar')}</Button></div>
 <style>{`@font-face{font-family:Bravura;src:url('/fonts/notation/bravura.woff2') format('woff2');font-display:swap}`}</style>
 </div>
}
