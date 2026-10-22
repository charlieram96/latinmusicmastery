'use client'
import {useLearningMode} from '@/components/learning-mode/store'
import {RhythmPicnic} from '@/components/solfeo-kids/rhythm-picnic'
import type {ReactNode} from 'react'
import {useBookTranslation} from './use-book-translation'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {lessonNote} from '@/lib/solfeo/notes'
import {ListenExampleCard} from './listen-example-card'
import styles from './manual-values-table.module.css'
const figures=['Redonda','Blanca','Negra','Corchea','Semicorchea','Fusa','Semifusa','Garrapatea','Semigarrapatea']
/** The manual's complete nine-row table; original editable Bravura paths, no raster images. */
export function ManualValuesTable({svg,settings,prose}:{svg:string;prose?:ReactNode;settings:DemonstrationSettings&{volume?:number}}){
 const {t,es}=useBookTranslation()
 const kids=useLearningMode()==='kids'
 const demo=useNoteDemonstration({...settings,bpm:60})
 const ink=svg.replaceAll('#252723','currentColor').replaceAll('#686d67','currentColor').replaceAll('#265b4d','currentColor')
 // Isolate each authored row before enlarging its viewport, so tall flags are
 // visible without including fragments from the adjacent row.
 const rows=figures.map((name,i)=>{
  const start=ink.indexOf(`>${name}</text>`)
  const end=i<figures.length-1?ink.lastIndexOf('<g ',ink.indexOf(`>${figures[i+1]}</text>`)):ink.length
  return ink.slice(start,end).match(/<(?:path|line)\b[^>]*\/>/g)?.filter(tag=>!tag.includes('stroke="#d7ddd5"')).join('')??''
 })
 function play(index:number,rest=false){void demo.play([{frequency:rest?undefined:lessonNote('C4').frequency,beats:4/2**index,index:rest?index+9:index}],{preview:true})}
 const listen=<ListenExampleCard playing={demo.playing} title={t("Escuchar figuras")} detail={t("♩ = 60 · Compara la duración de cada figura.")} onClick={()=>demo.playing?demo.stop():void demo.play(figures.map((_,index)=>({frequency:lessonNote('C4').frequency,beats:4/2**index,index})))}/>
 if(kids)return <RhythmPicnic rows={rows} figures={figures} settings={settings}/>
 return <div className={prose?styles.layout:undefined}>
  {prose&&<div className={styles.prose}>{prose}{listen}</div>}
  <div className={styles.chart}>
  <table aria-label={t("Figuras musicales y silencios: tabla completa")}><thead><tr>{['FIGURA','NOTA','SILENCIO','FRACCIÓN','NEGRA = 60'].map(label=><th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>
   {figures.map((name,i)=><tr key={name} className={demo.active===i||demo.active===i+9?styles.active:undefined} style={{animationDelay:`${i*45}ms`}}><th scope="row">{t(name)}</th>
    {[false,true].map(rest=><td key={String(rest)}><button type="button" className={styles.symbol} aria-label={`${es?(rest?'Escuchar silencio de':'Escuchar'):(rest?'Listen to rest:':'Listen to')} ${t(name).toLowerCase()}`} onClick={()=>play(i,rest)}><svg viewBox={`${rest?300:210} ${30+i*45} ${rest?40:50} 68`} aria-hidden="true"><g dangerouslySetInnerHTML={{__html:rows[i]}}/></svg></button></td>)}
    <td>{i===0?'1':`1/${2**i}`}</td><td>{4000/2**i} ms</td></tr>)}
  </tbody></table>
  <p className={styles.caption}>{t("Valores de referencia con negra = 60; no son duraciones fijas de las figuras.")}</p>
  {!prose&&listen}
 </div>
 </div>
}
