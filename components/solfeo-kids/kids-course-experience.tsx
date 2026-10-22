'use client'
import { StaffStory } from './staff-story'
import { ModuleWelcome } from './module-welcome'
import { useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { FirstSolfeoDocumentLesson, type CourseBookLesson } from '@/components/solfeo/first-document-lesson'
import { ManualBookPage, type ManualPage } from '@/components/solfeo/manual-book-page'
import { ManualVectorContext } from '@/components/solfeo/manual-book-page'
import { CourseSequenceNavigation } from '@/components/solfeo/course-sequence-navigation'
import { LessonHeader, type LessonHeaderContext } from '@/components/solfeo/lesson-header'
import type { QuizQuestion } from '@/types/modules'
import { useLearningMode } from '@/components/learning-mode/store'
import { GardenCover, GardenPage, GardenPractice, GardenQuiz } from './first-garden'
import { AdventureThemeContext, adventureThemes } from './adventure-theme'
import { AdventureCover, AdventurePage, AdventureQuiz, AdventurePractice, StaffAdventure } from './course-adventure'
import styles from './kids.module.css'
import { ClefIntroduction } from './clef-introduction'
import { StaffRescueExercise } from './staff-rescue'
import { SolfeoBook } from './solfeo-book'
import { ModuleOneExperience } from '@/components/solfeo/module-one-experience'
import { CourseBookExperience } from '@/components/solfeo/course-book-experience'
const tips=[['Escucha, mira y descubre el nombre de cada signo.','Listen, look and discover each symbol.'],['Encuentra el pulso. Después, prueba el ritmo.','Find the pulse. Then try the rhythm.'],['Escucha los sonidos y observa cuánto se separan.','Listen and notice how far apart the notes are.'],['Divide el ritmo en pequeños pasos.','Break the rhythm into small steps.'],['Busca las notas que forman cada familia musical.','Find the notes in each musical family.'],['Escucha primero. Lee y canta un poquito a la vez.','Listen first. Read and sing a little at a time.'],['Mira las alteraciones antes de cantar.','Look at the accidentals before singing.'],['Explora cómo cambia el carácter de la música.','Explore how the character of music changes.'],['Sigue las señales para saber por dónde continuar.','Follow the signs to find where to go next.'],['Mira la clave antes de nombrar una nota.','Look at the clef before naming a note.'],['Practica una frase. Después une las frases.','Practice one phrase, then join the phrases.'],['Escucha con atención y comprueba lo que descubriste.','Listen carefully and check what you discovered.']]
/** Keep every source block/score; give dense prose its own short, navigable step. */
export function childPages(pages:ManualPage[]):ManualPage[]{
 return pages.flatMap(page=>{
  if(page.blocks.length<=1||page.blocks.some(b=>['interactive','treble-writing','bass-writing','alto-writing','manual-cover'].includes(b.type)))return [page]
  const groups:ManualPage['blocks'][]=[];let pending:ManualPage['blocks']=[]
  for(const block of page.blocks){pending.push(block);if(block.type==='diagram'||pending.filter(b=>b.type==='p').length>=1){groups.push(pending);pending=[]}}
  if(pending.length)groups.push(pending)
  return groups.map(blocks=>({...page,layout:undefined,blocks}))
 })
}
export function KidsCourseExperience({book,quiz,exercise,headerContext,welcome}:{welcome?:{startHref:string;lessons:string[]};book:CourseBookLesson;quiz:QuizQuestion[];exercise:QuizQuestion[];headerContext:LessonHeaderContext}){
 const {locale}=useTranslation(),es=locale==='es',[examStarted,setExamStarted]=useState(false)
 const mode=useLearningMode()
 const garden=mode==='kids'&&book.module===1&&book.number===1
 const tip=tips[book.module-1][es?0:1]
 const adapted=useMemo(()=>{
  let pages=childPages(book.pages)
  if(book.module===1&&book.number<=3){
   const kind=book.number===1?'notes':book.number===2?'staff':'clef'
   const introduction:ManualPage={title:es?['Los nombres de las notas','Líneas y espacios','La clave de Sol'][book.number-1]:['Note names','Lines and spaces','The treble clef'][book.number-1],blocks:[{type:'kids-'+kind}]}
   // Preserve all source explanations after the playful introduction.
   const textPage=(title:string,text:string):ManualPage=>({title,blocks:[{type:'p',text}]})
   pages=book.number===1?[introduction,
    textPage(es?'Una historia para cantar':'A story about singing',es?'Hace unos mil años, Guido de Arezzo ayudaba a aprender el canto con las sílabas <b>Ut, Re, Mi, Fa, Sol, La</b>. Más adelante se añadió <b>Si</b> y se empezó a usar <b>Do</b> en lugar de Ut.':'About a thousand years ago, Guido of Arezzo helped teach singing with the syllables <b>Ut, Re, Mi, Fa, Sol, La</b>. <b>Si</b> was added later, and <b>Do</b> came into use in place of Ut.'),
    textPage(es?'Un sonido, dos nombres':'One note, two names',es?'Las notas también tienen nombres con letras: <b>Do = C · Re = D · Mi = E · Fa = F · Sol = G · La = A · Si = B</b>. Después de Si, al subir, vuelve Do en un registro más agudo.':'Notes also have letter names: <b>Do = C · Re = D · Mi = E · Fa = F · Sol = G · La = A · Si = B</b>. Going up after Si, Do returns in a higher register.'),
    textPage(es?'Alto, bajo, corto, largo':'High, low, short, long',es?'La <b>altura</b> nos dice si un sonido es grave o agudo. La <b>duración</b> nos dice cuánto dura. Una misma nota puede durar más o menos. Un <b>silencio</b> indica tiempo sin sonido de esa voz o instrumento.':'<b>Pitch</b> tells us whether a sound is low or high. <b>Duration</b> tells us how long it lasts. The same note can last longer or shorter. A <b>rest</b> indicates time without sound in that voice or instrument.')
   ]:book.number===2?[introduction,
    {title:es?'Empezamos desde abajo':'Start at the bottom',blocks:[{type:'kids-staff-builder'}]},
    {title:es?'¿Línea o espacio?':'Line or space?',blocks:[{type:'kids-staff-fruits'}]}
   ]:[introduction,
    textPage(es?'Cinco líneas musicales':'Five musical lines',es?'Con clave de Sol, las líneas desde abajo son: <b>Mi · Sol · Si · Re · Fa</b>. Sol4 está en la segunda línea.':'In treble clef, the lines from the bottom are <b>E · G · B · D · F</b>. G4 is on the second line.'),
    textPage(es?'Cuatro espacios musicales':'Four musical spaces',es?'Los espacios desde abajo son: <b>Fa · La · Do · Mi</b>. Al pasar a la posición de arriba, avanzamos un nombre: Mi, Fa, Sol, La…':'The spaces from the bottom are <b>F · A · C · E</b>. Moving one position up advances one note name: E, F, G, A…'),
    {title:es?'Dibujamos la clave de Sol':'Draw the treble clef',blocks:[{type:'treble-writing'}]}
   ]
  }
  if(garden)pages=['notes','history','letters','sounds'].map(kind=>({title:kind,blocks:[{type:'garden-'+kind}]}))
  return {...book,pages}
 },[book,es,garden])
 if(mode==='classic') {
  const context={...headerContext,courseTitle:es?'Solfeo Aplicado · Mundo clásico':'Applied Solfege · Classic world'}
  return book.module===1?<ModuleOneExperience key={'classic-'+book.id} number={book.number} nextHref={book.nextHref} headerContext={context}/>:<CourseBookExperience key={'classic-'+book.id} classId={book.id.replace('local-solfeo-kids-','local-solfeo-')} nextHref={book.nextHref} headerContext={context}/>
 }
 if(welcome)return <ModuleWelcome moduleNumber={book.module} {...welcome} headerContext={headerContext}/>
 const theme=adventureThemes[book.module-1]??adventureThemes[0]
 return <AdventureThemeContext.Provider value={theme}><div className={styles.course} data-kids-course>
 <div className={styles.banner}><div className={`${styles.mascot} ${book.module===1?styles.bookMascot:''}`} aria-hidden="true">{book.module===1?<SolfeoBook/>:theme.icon}</div><div><small>{es?'SOLFEO INFANTIL APLICADO':'APPLIED SOLFEGE FOR KIDS'} · {es?'MUNDO INFANTIL · MÓDULO':'KIDS WORLD · MODULE'} {book.module}/12</small><h2>{es?theme.es:theme.en}</h2><p>{tip}</p></div></div>
 {book.exam?<><LessonHeader title={book.title} context={headerContext} tabs={null}/><div className="m-4 rounded-3xl border bg-background p-6"><p className="mb-4">{es?'¡Llegaste al reto del mundo! Responde a tu ritmo. Al terminar podrás revisar tus respuestas y volver a intentarlo.':'You reached the world challenge! Take your time. At the end you can review your answers and try again.'}</p><AdventureQuiz classId={book.id+'-quiz'} questions={quiz} nextHref={book.nextHref}/></div>{book.pages.length>0&&<details className="m-4 rounded-2xl bg-background p-4"><summary>{es?'Material del reto y referencias':'Challenge materials and references'}</summary><button className="my-3 rounded-xl bg-primary px-4 py-2 text-primary-foreground" onClick={()=>setExamStarted(!examStarted)}>{es?'Ver / ocultar material completo':'Show / hide complete material'}</button>{examStarted&&<ManualVectorContext.Provider value={book.vectors}>{[...book.pages,...(book.appendices??[])].map((p,i)=><div className={styles.page} key={i}><ManualBookPage page={p} settings={{bpm:100,volume:.5}}/></div>)}</ManualVectorContext.Provider>}</details>}<CourseSequenceNavigation activity={es?'Reto del módulo':'Module challenge'}/></>:<FirstSolfeoDocumentLesson renderCover={garden?GardenCover:({complete})=>book.module===1&&book.number===2&&!complete?<StaffStory/>:book.module===1&&book.number===3&&!complete?<ClefIntroduction/>:<AdventureCover complete={complete} title={book.title}/>}
 practiceRenderers={book.module===1&&book.number===2?[StaffRescueExercise,StaffAdventure]:undefined}
 renderPractice={garden?GardenPractice:({onComplete})=><AdventurePractice pages={childPages(book.practice)} questions={exercise} classId={book.id} onComplete={onComplete}/>}
 renderQuiz={garden?GardenQuiz:AdventureQuiz} book={adapted} lessonNumber={book.number} questions={quiz} exerciseQuestions={exercise} childFriendly headerContext={headerContext} renderPage={({page,settings})=>{
 if(garden)return <GardenPage page={page} settings={settings}/>
 return <AdventurePage page={page} settings={settings}/>
 }}/>}
 {book.module===1&&book.number<=3&&<details className="m-4 rounded-2xl border bg-background p-4"><summary className="cursor-pointer font-semibold">{es?'Para explorar con el profe: explicación completa del curso':'Explore with your teacher: complete course explanation'}</summary><ManualVectorContext.Provider value={book.vectors}>{book.pages.map((p,i)=><div className={styles.page} key={i}><ManualBookPage page={p} settings={{bpm:100,volume:.5}}/></div>)}</ManualVectorContext.Provider></details>}
 </div></AdventureThemeContext.Provider>
}
