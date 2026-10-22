'use client'
import {useBookTranslation} from './use-book-translation'
import {createContext,useContext,useEffect,useState,memo,type ReactNode} from 'react'
import data from '@/lib/solfeo/module-one-book.json'
import {lessonNote} from '@/lib/solfeo/notes'
import {Button} from '@/components/ui/button'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {StaffLinesPractice} from './staff-lines-practice'
import {ClefWriting} from './clef-writing'
import {TrebleClefWriting} from './treble-clef-writing'
import {FirstSolfeoLesson} from './first-lesson'
import styles from './manual-book-page.module.css'
import {useBookAudio,type BookAudio} from './use-book-audio'
import {ListenExampleCard} from './listen-example-card'
import {ModuleTwoCompletion} from './module-two-completion'
import {ModuleTwoConducting} from './module-two-conducting'
import {useLearningMode} from '@/components/learning-mode/store'
import {DurationGarden} from '@/components/solfeo-kids/duration-garden'
import {ManualValuesTable} from './manual-values-table'
import {ManualWritingStaff} from './manual-writing-staff'
export type ManualBlock={type:string;text?:string;kind?:string;vector?:string;step?:number;pdfPage?:number;animation?:string}
export type ManualPage={title:string;blocks:ManualBlock[];layout?:'source-sections'|'full-width'}
export const moduleOneLessons=data.lessons as {number:number;title:string;pages:ManualPage[];practice:ManualPage[]}[]
export type Vector={audio?:BookAudio;minDisplayWidth?:number;width:number;height:number;viewY?:number;svg:string;kind:string;notes:{pitch:string;label?:string;x:number;y:number;dur:number;beats?:number}[]}
const defaultVectors=data.vectors as Record<string,Vector>
export const ManualVectorContext=createContext(defaultVectors)
const names:Record<string,string>={C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'}
// Playback updates only the overlay; keep the engraved SVG DOM stable.
const EngravedScore=memo(function EngravedScore({svg}:{svg:string}){
 return <g data-score-engraving dangerouslySetInnerHTML={{__html:svg.replaceAll('#252723','currentColor').replaceAll('#686d67','var(--manual-muted)').replaceAll('#265b4d','var(--manual-green)').replaceAll('#d7ddd5','var(--manual-line)')}}/>
})
function StaffMapLabels(){
 const {t}=useBookTranslation()
 return <g>
  <text x="48" y="43" fill="#df670b" fontSize="10" fontWeight="700">{t('Líneas')}</text>
  <text x="447" y="43" fill="var(--manual-green)" fontSize="10" fontWeight="700">{t('Espacios')}</text>
  {[0,1,2,3,4].map(i=><g key={i}><line x1="110" y1={118-i*12} x2="420" y2={118-i*12} stroke="var(--manual-muted)" strokeWidth=".55"/><line x1="78" y1={118-i*12} x2="120" y2={118-i*12} stroke="#df670b" strokeWidth=".7"/><text x="65" y={121-i*12} textAnchor="middle" fill="#df670b" fontSize="10" fontWeight="700">{i+1}</text></g>)}
  {[0,1,2,3].map(i=><g key={i}><line x1="400" y1={112-i*12} x2="453" y2={112-i*12} stroke="var(--manual-green)" strokeWidth=".7" strokeDasharray="3 2"/><text x="464" y={115-i*12} fill="var(--manual-green)" fontSize="10" fontWeight="700">{i+1}</text></g>)}
  <text x="40" y="147" fill="currentColor" fontSize="9">{t('Numeración de abajo hacia arriba. Cada guía verde señala un espacio.')}</text>
 </g>
}
function Diagram({id,settings,prose}:{id:string;settings:DemonstrationSettings&{volume?:number};prose?:ReactNode}){
 const kids=useLearningMode()==='kids'
 const {t,svg:translateSvg,es}=useBookTranslation()
 const vectors=useContext(ManualVectorContext)
 const v=vectors[id],demo=useNoteDemonstration(settings),performance=useBookAudio(settings.volume,()=>{demo.stop();settings.onDemoStart?.()},settings.bpm)
 const play=(i:number)=>{performance.stop();const event=v.audio?.events.find(e=>e.visualIndex===i&&(!e.vectorId||e.vectorId===id));void demo.play([{frequency:event?.frequency??lessonNote(v.notes[i].pitch).frequency,beats:event?event.duration/.92*(settings.bpm??100)/60:v.notes[i].beats??4/v.notes[i].dur,index:i}],{preview:true})}
 if(kids&&v.kind==='pyramid')return <DurationGarden settings={settings}/>
 const graphic=<svg viewBox={`${v.minDisplayWidth?0:v.kind.startsWith('grand')?10:25} ${(v.viewY??0)-(vectors!==defaultVectors?10:0)} ${v.width-(v.minDisplayWidth?0:v.kind.startsWith('grand')?20:50)} ${v.height+(vectors!==defaultVectors?20:0)}`} aria-label={`${es?"Diagrama del manual":"Manual diagram"}: ${v.kind}`} role="group" style={{width:'100%',minWidth:v.minDisplayWidth,maxHeight:v.kind==='values'?290:v.kind==='pyramid'?420:vectors!==defaultVectors?520:380}}>
   {v.kind==='staffmap'?<StaffMapLabels/>:<EngravedScore svg={translateSvg(v.svg)}/>}
   {v.notes.map((n,i)=><g key={i} role="button" tabIndex={0} aria-label={n.label?t(n.label):`${es?"Escuchar":"Listen to"} ${names[n.pitch[0]]}${n.pitch.slice(1)}`} onClick={()=>play(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play(i)}}} className={styles.note}>
    <rect x={n.x-12} y={n.y-23} width={24} height={40} rx={6} fill={(demo.active===i||performance.active.includes(i))?'#ff820044':'transparent'}/><circle cx={n.x} cy={n.y} r={10} fill="none" className={styles.focusRing}/>
   </g>)}
  </svg>
 const readableGraphic=v.minDisplayWidth?<div data-expanded-score tabIndex={0} role="region" aria-label={es?'Cuadro musical; desplázate horizontalmente para ver todas las columnas':'Music chart; scroll horizontally to see all columns'} style={{overflowX:'auto',maxWidth:'100%'}}>{graphic}</div>:graphic
 const controls=<>{v.notes.length>0&&<ListenExampleCard playing={demo.playing||performance.playing} title={t('Escuchar ejemplo')} detail={(performance.sectionCount>1?`${es?"Pentagrama":"Staff"} ${performance.section+1}/${performance.sectionCount} · `:"")+((demo.count||performance.count)?`${es?"Cuenta previa":"Count-in"}: ${demo.count||performance.count}`:`♩ = ${v.audio?.bpm??settings.bpm??100} · ${t("Toca también las notas para escucharlas.")}`)} onClick={()=>v.audio?(performance.playing?performance.stop():void performance.play(v.audio,id)):demo.playing?demo.stop():void demo.play(v.notes.map((n,index)=>({frequency:lessonNote(n.pitch).frequency,beats:n.beats??4/n.dur,index})))}/>}

 {performance.error&&<p role="alert">{t('No se pudo iniciar el sonido. Inténtalo de nuevo.')}</p>}</>
 return prose?<div className={styles.listeningLayout}><div className={styles.listeningText}>{prose}{controls}</div><div className={`${styles.diagram} ${styles.expandedDiagram}`}>{readableGraphic}</div></div>:<div className={styles.diagram}>{readableGraphic}{controls}</div>
}
const highlights=['lectura, escritura, audición, entonación y análisis','comprender, leer, escribir y analizar','de lo simple a lo complejo','audición interior','dificultad gradual','sin exigir formación vocal previa','se retoman y amplían','objetivos definidos','cinco líneas y cuatro espacios','Cada figura dura la mitad de la anterior','reading, writing, listening, singing and analysis','understand, read, write and analyze','from simple to complex','inner hearing','gradual difficulty','without requiring prior vocal training','are revisited and expanded','defined objectives','five lines and four spaces','Each note value lasts half as long as the previous one']
function emphasize(text:string){text=text.replaceAll('<link href=','<a target="_blank" rel="noreferrer" href=').replaceAll('</link>','</a>');return highlights.reduce((html,phrase)=>html.replace(phrase,`<mark>${phrase}</mark>`),text)}
function LearningOverview({blocks}:{blocks:ManualBlock[]}){
 const {t}=useBookTranslation()
 const groups:{title?:string;paragraphs:ManualBlock[]}[]=[{paragraphs:[]}]
 for(const block of blocks){if(block.type==='h')groups.push({title:block.text,paragraphs:[]});else groups[groups.length-1].paragraphs.push(block)}
 return <div className={styles.learning}>{groups.map((g,i)=><div key={i} className={styles.learningCard}>{g.title&&<h3>{t(g.title)}</h3>}{g.paragraphs.map((p,j)=><p key={j} dangerouslySetInnerHTML={{__html:emphasize(t(p.text??''))}}/>)}</div>)}</div>
}
export function ManualBookPage({page,settings,practice=false}:{page:ManualPage;settings:DemonstrationSettings&{volume?:number};practice?:boolean}){
 const {t,svg:translateSvg,es}=useBookTranslation()
 const vectors=useContext(ManualVectorContext)
 const otherClef=page.blocks.find(b=>b.type==='bass-writing'||b.type==='alto-writing')
 if(otherClef)return <ClefWriting clef={otherClef.type==='bass-writing'?'F':'C'} settings={settings}/>
 const writing=page.blocks.find(b=>b.type==='treble-writing')
 if(writing)return <TrebleClefWriting legend={t(writing.text??'')} settings={settings}/>
 const interactive=page.blocks.find(b=>b.type==='interactive')
 if(interactive)return <FirstSolfeoLesson paginated controlledStep={interactive.step} {...settings}/>
 if(page.blocks[0]?.type==='manual-cover')return <div className={styles.manualCover}><p>LATIN MUSIC MASTERY</p><h2>{es?"SOLFEO":"APPLIED"}<br/>{es?"APLICADO":"SOLFEGE"}</h2><h3>{es?"Lectura y comprensión":"Reading and understanding"}<br/>{es?"del lenguaje musical":"musical language"}</h3><p>{t("MANUAL DE ESTUDIO")}</p><p>{t("Teoría · lectura · escritura · entonación")}</p><p>{t("Dirección pedagógica: Raffy Pérez")}</p><small>{t("Edición de trabajo 0.3 · Octubre 2026")}</small></div>
 const renderBlock=(b:ManualBlock,i:number)=>b.type==='diagram'&&b.vector?b.animation==='module-two-completion'?<ModuleTwoCompletion key={i} settings={settings}/>:b.animation==='module-two-conduct'?<ModuleTwoConducting key={i} id={b.vector} vector={vectors[b.vector]} settings={settings}/>:b.kind==='values'?<ManualValuesTable key={i} svg={vectors[b.vector].svg} settings={settings}/>:b.kind==='blank'&&vectors===defaultVectors?<ManualWritingStaff key={i} settings={settings}/>:<Diagram key={i} id={b.vector} settings={settings}/>:b.type==='h'?b.text===page.title&&!practice?null:<h3 key={i}>{t(b.text??'')}</h3>:<div className={b.type==='small'?styles.small:undefined} key={i} dangerouslySetInnerHTML={{__html:emphasize(t(b.text??''))}}/>
 const valuesBlock=page.blocks.find(b=>b.type==='diagram'&&b.kind==='values'&&b.vector)
 const staffDemo=!practice&&page.blocks.some(b=>b.kind==='staffmap')&&page.title==='Pentagrama, líneas y espacios'
 const illustrated=page.layout!=='full-width'&&page.blocks.some(b=>b.type==='diagram')&&page.blocks.some(b=>b.type==='p')
 const bookColumns=illustrated&&vectors!==defaultVectors
 const diagrams=page.blocks.filter(b=>b.type==='diagram')
 const sourceSections:ManualBlock[][]=[]
 if(page.layout==='source-sections')for(const block of page.blocks){if(block.type==='h'||!sourceSections.length)sourceSections.push([]);sourceSections[sourceSections.length-1].push(block)}
 const expandedDiagram=bookColumns&&diagrams.length===1&&!diagrams[0].animation&&diagrams[0].kind!=='values'?diagrams[0]:undefined
 return <section data-book={vectors!==defaultVectors||undefined} className={`${styles.sheet} ${staffDemo?styles.staffPage:''} ${page.blocks.some(b=>b.animation==='module-two-conduct')?styles.conductPage:''} ${page.blocks.some(b=>b.animation==='module-two-completion')?styles.completionPage:''} ${page.blocks.some(b=>b.kind==='values')?styles.valuesPage:''} ${/^(Solucionario|Referencias)/.test(page.title)?styles.answerPage:''}`}>
  {!practice&&<div className={styles.heading}><span>{es?"SOLFEO APLICADO":"APPLIED SOLFEGE"}{page.blocks[0]?.pdfPage?` · ${es?"PÁGINA":"MANUAL PAGE"} ${page.blocks[0].pdfPage}${es?" DEL MANUAL":""}`:''}</span><h2>{t(page.title)}</h2><i/></div>}
  {page.layout==='source-sections'?<div className={styles.sourceSections}>{sourceSections.map((blocks,i)=>{const diagram=blocks.find(b=>b.type==='diagram'&&b.vector);return diagram?.vector?<Diagram key={i} id={diagram.vector} settings={settings} prose={<div className={styles.bookProse}>{blocks.filter(b=>b.type!=='diagram').map(renderBlock)}</div>}/>:<div key={i}>{blocks.map(renderBlock)}</div>})}</div>:expandedDiagram?.vector?<Diagram id={expandedDiagram.vector} settings={settings} prose={<div className={styles.bookProse}>{page.blocks.filter(b=>b.type!=='diagram').map(renderBlock)}</div>}/>:valuesBlock?.vector?<ManualValuesTable svg={vectors[valuesBlock.vector].svg} settings={settings} prose={<div className={styles.blocks}>{page.blocks.filter(b=>b.type!=='diagram').map(renderBlock)}</div>}/>:page.title.startsWith('Aprendizaje progresivo')?<LearningOverview blocks={page.blocks}/>:<div className={`${styles.blocks} ${bookColumns?styles.bookIllustrated:illustrated?styles.illustrated:''}`}>
   {bookColumns?<><div className={styles.bookProse}>{page.blocks.filter(b=>b.type!=='diagram').map(renderBlock)}</div><div className={styles.bookFigures}>{page.blocks.filter(b=>b.type==='diagram').map(renderBlock)}</div></>:page.blocks.map(renderBlock)}
  </div>}
  {staffDemo&&<StaffLinesPractice settings={settings}/>}
 </section>
}
export function ManualPractice({number,settings,onComplete,manual}:{number:number;manual?:{id?:string;title:string;practice:ManualPage[]};settings:DemonstrationSettings&{volume?:number};onComplete:()=>void}){
 const {t,es}=useBookTranslation()
 const lesson=manual??moduleOneLessons[number-1],key=`lmm-manual-${manual?.id??`m01-c${number}`}-written`,[answer,setAnswer]=useState(''),[saved,setSaved]=useState(false),[step,setStep]=useState(0)
 useEffect(()=>{try{setAnswer(localStorage.getItem(key)??'')}catch{}},[key])
 return <div className="space-y-4 rounded-xl border bg-background p-4"><div className="flex items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{es?'Ejercicio':'Exercise'} · {step+1} / {lesson.practice.length}</p><h2 className="font-heading text-xl">{t(lesson.title)}</h2></div></div><ManualBookPage key={step} page={lesson.practice[step]} settings={settings} practice/>
 <label className="block space-y-2"><span>{t('Mis respuestas y apuntes')}</span><textarea value={answer} onChange={e=>{setAnswer(e.target.value);setSaved(false)}} className="min-h-36 w-full rounded-xl border bg-background p-3" placeholder={t("Escribe tus respuestas. Para los dibujos, utiliza una hoja pautada.")}/></label><Button variant="outline" onClick={()=>{try{localStorage.setItem(key,answer);setSaved(true)}catch{setSaved(false)}}}>{t('Guardar respuestas')}</Button>{saved&&<span role="status" className="ml-3 text-sm text-muted-foreground">{t('Guardadas en este navegador.')}</span>}
 <nav aria-label={es?"Pasos del ejercicio":"Practice steps"} className="flex justify-between gap-3 border-t pt-4"><Button variant="outline" disabled={step===0} onClick={()=>setStep(step-1)}>{t('Anterior')}</Button><Button onClick={()=>step<lesson.practice.length-1?setStep(step+1):onComplete()}>{t(step<lesson.practice.length-1?'Siguiente':'Continuar →')}</Button></nav>
 </div>
}
