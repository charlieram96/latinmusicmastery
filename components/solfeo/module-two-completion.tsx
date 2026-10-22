'use client'
import {useState} from 'react'
import {useBookTranslation} from './use-book-translation'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {ListenExampleCard} from './listen-example-card'
const options=[{es:'Negra',en:'Quarter note',beats:1,rest:false,glyph:'\uE1D5'},{es:'Blanca',en:'Half note',beats:2,rest:false,glyph:'\uE1D3'},{es:'Silencio de negra',en:'Quarter rest',beats:1,rest:true,glyph:'\uE4E5'},{es:'Dos negras',en:'Two quarter notes',beats:2,rest:false,glyph:'\uE1D5  \uE1D5'}]
const initial=[3,3,2,2],correct=[0,2,3,3]
export function ModuleTwoCompletion({settings}:{settings:DemonstrationSettings&{volume?:number}}){
 const {es}=useBookTranslation(),[answers,setAnswers]=useState([-1,-1,-1,-1]),[checked,setChecked]=useState(false),demo=useNoteDemonstration(settings)
 return <div className="space-y-4 rounded-xl border border-primary/25 p-4">
 <div className="grid gap-3 sm:grid-cols-2">{initial.map((beats,i)=><div key={i} className="rounded-lg border p-3">
 <label className="flex flex-wrap items-center gap-2"><strong>{'ABCD'[i]} ·</strong><span className="text-sm">{es?'Completa 4/4':'Complete 4/4'}</span><select aria-label={`${es?'Respuesta':'Answer'} ${'ABCD'[i]}`} className="max-w-full rounded border bg-background p-2 text-sm" value={answers[i]} onChange={e=>{demo.stop();setChecked(false);setAnswers(answers.map((a,j)=>j===i?Number(e.target.value):a))}}><option value={-1}>{es?'Elige una figura':'Choose a note value'}</option>{options.map((o,j)=><option key={j} value={j}>{es?o.es:o.en}</option>)}</select></label>
 <svg viewBox="0 0 280 100" className="mt-3 w-full" role="img" aria-label={`${es?'Compás':'Measure'} ${'ABCD'[i]}`}>
 {[25,35,45,55,65].map(y=><line key={y} x1="5" x2="275" y1={y} y2={y} stroke="currentColor" opacity=".45"/>)}
 <text x="12" y="56" fontSize="38" fontFamily="Bravura" fill="currentColor">{'\uE050'}</text><text x="47" y="40" fontSize="16" fill="currentColor">4</text><text x="47" y="60" fontSize="16" fill="currentColor">4</text>
 { (i===0?['\uE1D3','\uE1D5']:i===1?['\uE1D5','\uE1D5','\uE1D5']:i===2?['\uE1D3']:['\uE4E4']).map((glyph,j)=><text key={j} x={75+j*30} y={i===3?45:55} fontSize="31" fontFamily="Bravura" fill="currentColor">{glyph}</text>)}
 <rect x="175" y="10" width="92" height="73" rx="7" fill={demo.active===i?'#ff820044':'#ff820012'}/>{(answers[i]===3?['\uE1D5','\uE1D5']:[answers[i]>=0?options[answers[i]].glyph:'?']).map((glyph,j)=><text key={j} x={185+j*38} y={answers[i]>=0&&options[answers[i]].rest?45:55} fontSize="30" fontFamily="Bravura" fill="currentColor">{glyph}</text>)}<line x1="275" x2="275" y1="25" y2="65" stroke="currentColor"/>
 </svg>
 <p className="text-sm text-muted-foreground">{es?'Total':'Total'}: {beats+(answers[i]>=0?options[answers[i]].beats:0)} / 4 {es?'pulsos':'beats'}{checked&&<span className="ml-2 text-primary">{answers[i]===correct[i]?'✓':es?'Revisa la consigna':'Review the prompt'}</span>}</p>
 </div>)}</div>
 <button type="button" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={()=>setChecked(true)}>{es?'Comprobar los cuatro compases':'Check all four measures'}</button>
 <ListenExampleCard playing={demo.playing} title={es?'Escuchar mis compases':'Listen to my measures'} detail={es?'Completa las cuatro respuestas antes de escuchar.':'Complete all four answers before listening.'} onClick={()=>{if(demo.playing){demo.stop();return}if(answers.some(a=>a<0)){setChecked(true);return}void demo.play(initial.flatMap((_,i)=>{const base=i===0?[2,1]:i===1?[1,1,1]:i===2?[2]:[2],o=options[answers[i]];return [...base.map(beats=>({frequency:i===3?undefined:392,beats,index:i})),...(answers[i]===3?[{frequency:392,beats:1,index:i},{frequency:392,beats:1,index:i}]:[{frequency:o.rest?undefined:392,beats:o.beats,index:i}])]}))}}/>
 <style>{`@font-face{font-family:Bravura;src:url('/fonts/notation/bravura.woff2') format('woff2');font-display:swap}`}</style>
 </div>
}
