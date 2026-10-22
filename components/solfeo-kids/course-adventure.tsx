'use client'
import { useState, type CSSProperties } from 'react'
import { useBookTranslation } from '@/components/solfeo/use-book-translation'
import { useTranslation } from '@/components/language-provider'
import { ManualBookPage, type ManualPage } from '@/components/solfeo/manual-book-page'
import { useNoteDemonstration, type DemonstrationSettings } from '@/components/solfeo/use-note-demonstration'
import type { QuizQuestion } from '@/types/modules'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { GardenFrame } from './first-garden'
import { KidsDiscovery } from './kids-discovery'
import { useAdventureTheme } from './adventure-theme'
import s from './course-adventure.module.css'
import { TrebleClefWriting } from '@/components/solfeo/treble-clef-writing'
import { ClefExplanation } from './clef-explanation'
import { useOutcomeSound } from './use-celebration-sound'
import { StaffBuilder } from './staff-builder'
import { lessonNote } from '@/lib/solfeo/notes'
export function AdventureCover({complete,title}:{complete:boolean;title:string}){
 useOutcomeSound(complete?'fanfare':undefined,complete?'lesson-complete':undefined)
 const {locale}=useTranslation(),es=locale==='es',theme=useAdventureTheme()
 const {t}=useBookTranslation()
 const [friend,setFriend]=useState(0)
 return <GardenFrame title={complete?(es?'¡Un descubrimiento más!':'One more discovery!'):t(title)} detail={complete?(es?'Ahora vamos a practicar lo que descubriste.':'Now let’s practise what you discovered.'):(es?theme.missionEs:theme.missionEn)} mascotMessage={es?'Estoy contigo. Explora a tu ritmo y pregunta cuando lo necesites.':'I’m with you. Explore at your pace and ask when you need help.'}>
 <div className={s.welcome}><button onClick={()=>setFriend(i=>(i+1)%theme.friends.length)} aria-label={es?'Saludar a un amigo':'Greet a friend'}>{theme.friends[friend]}</button><p>{es?'Toca a tu amigo. ¡La aventura empieza contigo!':'Tap your friend. The adventure starts with you!'}</p><div>{[es?'👀 Mira':'👀 Look',es?'👂 Escucha':'👂 Listen',es?'🎵 Prueba':'🎵 Try'].map(t=><span key={t}>{t}</span>)}</div></div>
 </GardenFrame>
}
export function AdventurePage({page,settings}:{page:ManualPage;settings:DemonstrationSettings&{volume?:number}}){
 const {locale}=useTranslation(),es=locale==='es',theme=useAdventureTheme()
 const {t}=useBookTranslation()
 const kind=page.blocks[0]?.type
 if(kind==='treble-writing')return <GardenFrame title={es?'El carpintero nos deja dos pistas':'The woodpecker leaves two clues'} detail={es?'Mira cómo dibujamos la clave. Después, el carpintero señala la segunda línea.':'Watch us draw the clef. Then the woodpecker marks the second line.'} hideMascot><TrebleClefWriting legend="" settings={settings} childFriendly/></GardenFrame>
 if(kind==='kids-clef')return <GardenFrame title={es?'La clave nos presenta a Sol':'The clef introduces G'} detail={es?'Mira cómo el símbolo nos dice el nombre de esta nota.':'Watch how the symbol tells us this note’s name.'} mascotMessage={es?'Yo te lo muestro: la espiral abraza la segunda línea, y esta nota se llama Sol. Puedes mirar y escuchar otra vez.':'Let me show you: the spiral wraps around the second line, and this note is G. You can watch and listen again.'}><ClefExplanation/></GardenFrame>
 if(kind==='kids-staff-fruits')return <StaffBuilder fruits/>
 if(kind==='kids-staff-builder')return <StaffBuilder/>
 if(kind==='manual-cover')return <AdventureCover complete={false} title={t(page.title)}/>
 return <GardenFrame title={t(page.title)} detail={es?theme.missionEs:theme.missionEn} mascotMessage={es?'Mira un detalle a la vez. En las partituras, toca las notas o escucha el ejemplo.':'Look at one detail at a time. On scores, tap the notes or listen to the example.'}>
 <div className={s.content}>{kind?.startsWith('kids-')?<KidsDiscovery kind={kind.slice(5) as 'notes'|'staff'|'clef'}/>:<ManualBookPage page={page} settings={settings}/>}</div>
 </GardenFrame>
}
export function AdventureQuiz({questions,classId,nextHref}:{questions:QuizQuestion[];classId:string;nextHref:string}){
 const {locale}=useTranslation(),es=locale==='es',theme=useAdventureTheme()
 return <GardenFrame quiz hideMascot title={es?`El reto: ${theme.es}`:`Challenge: ${theme.en}`} detail={es?'Escucha, elige y descubre. La lechuza te ayuda si lo necesitas.':'Listen, choose and discover. Owl helps when you need it.'}><QuizRunner questions={questions} classItemId={classId} nextHref={nextHref}/></GardenFrame>
}
export function AdventurePractice({pages,questions,classId,onComplete}:{pages:ManualPage[];questions:QuizQuestion[];classId:string;onComplete:()=>void}){
 const {locale}=useTranslation(),es=locale==='es',theme=useAdventureTheme()
 const [page,setPage]=useState(0)
 const checking=page>=pages.length
 return <GardenFrame quiz={checking} hideMascot={checking&&questions.length>0} title={es?'¡Vamos a probar!':'Let’s try it!'} detail={es?theme.missionEs:theme.missionEn} mascotMessage={es?'Escucha el modelo y prueba por partes. Avanza cuando hayas practicado.':'Listen to the model and try it in parts. Continue when you have practised.'}>
 {!checking?<><div className={s.content}><ManualBookPage page={pages[page]} practice settings={{bpm:80,volume:.5,metronome:false,countInBars:0}}/></div><nav className={s.actions} aria-label={es?'Pasos de la práctica':'Practice steps'}><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>{es?'Atrás':'Back'}</button><span>{page+1} / {pages.length}</span><button onClick={()=>setPage(p=>p+1)}>{es?'Ya lo practiqué →':'I practised it →'}</button></nav></>:<>{questions.length>0?<QuizRunner key={classId} kind="Exercise" classItemId={classId+'-practice'} questions={questions}/>:<p>{es?'¡Terminaste el recorrido de práctica! Ahora prueba el reto.':'You finished the practice path! Now try the challenge.'}</p>}<div className={s.actions}>{pages.length>0&&<button onClick={()=>setPage(0)}>{es?'Volver a practicar':'Practise again'}</button>}<button onClick={onComplete}>{es?'Ir al quiz →':'Go to quiz →'}</button></div></>}
 </GardenFrame>
}
export function StaffAdventure({onComplete}:{onComplete:()=>void}){
 const {locale}=useTranslation(),es=locale==='es'
 const [step,setStep]=useState(0),[selected,setSelected]=useState<number|null>(null),[reaction,setReaction]=useState<{result:'correct'|'wrong';id:number}>()
 const sound=useNoteDemonstration({metronome:false,countInBars:0,volume:.5})
 const [audioError,setAudioError]=useState(false)
 const pitches=['E4','F4','G4','A4','B4','C5','D5','E5','F5']
 const targets=[0,2,4,6,8,1,3,5,7],target=targets[step],complete=step===targets.length
 const label=(i:number)=>`${i%2?(es?'Espacio':'Space'):(es?'Línea':'Line')} ${Math.floor(i/2)+1}`
 const choose=(i:number)=>{setSelected(i);setAudioError(false);void sound.play([{frequency:lessonNote(pitches[i]).frequency,beats:1,index:i}],{preview:true}).catch(()=>setAudioError(true));if(complete)return;const good=i===target;setReaction(r=>({result:good?'correct':'wrong',id:(r?.id??0)+1}));if(good)setStep(n=>n+1)}
 return <GardenFrame quiz growth={complete?8:undefined} reaction={reaction} title={es?'El edificio de los pajaritos':'The little birds’ building'} detail={complete?(es?'¡Encontraste cinco líneas y cuatro espacios!':'You found five lines and four spaces!'):(es?`Lleva el pajarito a: ${label(target).toLowerCase()}. Cuenta desde abajo.`:`Take the bird to: ${label(target).toLowerCase()}. Count from the bottom.`)} mascotMessage={reaction?.result==='wrong'?(es?'La lechuza te da una pista: empieza por abajo. Una línea cruza la nota; un espacio queda entre dos líneas.':'Owl’s clue: start at the bottom. A line crosses the note; a space sits between two lines.'):(es?'Las líneas son los pisos y los espacios viven entre ellos. ¡Vamos de abajo hacia arriba!':'Lines are the floors and spaces live between them. Let’s go from bottom to top!')}>
 <div className={s.staffViewport}><div className={s.staffGame}>{complete&&<div className={s.birdCelebration} aria-hidden="true">
 {Array.from({length:8},(_,i)=><div className={s.paradeBird} key={i} style={{'--bird-delay':`${-i*.85}s`,'--bird-color':['#ffca62','#8ddbd4','#c2a2ed','#ffadb9'][i%4]} as CSSProperties}><svg viewBox="0 0 48 42"><path d="M15 31l-3 8m13-8 3 8" stroke="#ad7136" strokeWidth="3"/><ellipse cx="22" cy="24" rx="15" ry="12" fill="var(--bird-color)"/><circle cx="31" cy="14" r="10" fill="var(--bird-color)"/><path d="m39 14 8 4-8 3" fill="#ed881d"/><path d="M9 24 1 17l2 12" fill="var(--bird-color)"/><path className={s.birdWing} d="M24 24Q3 3 8 26Q13 35 24 24" fill="var(--bird-color)" stroke="#614a7833" strokeWidth="2"/><circle cx="34" cy="12" r="2.5" fill="#283852"/><circle cx="35" cy="11" r=".8" fill="white"/></svg></div>)}
 {[22,50,77].map((left,j)=><div className={s.finishBurst} key={left} style={{left:`${left}%`,top:`${12+j%2*25}%`}}>{Array.from({length:8},(_,i)=><span key={i} style={{'--angle':`${i*45}deg`,'--spark-color':['#ffb52e','#b69aef','#68c8bc','#ff8ba6'][i%4],animationDelay:`${j*.7}s`} as CSSProperties}>✦</span>)}</div>)}
 </div>}{[0,2,4,6,8].map(i=><div className={s.staffLine} style={{bottom:20+i*23}} key={i}><span>{i/2+1}</span></div>)}{Array.from({length:9},(_,i)=><button key={i} className={s.staffSpot} style={{bottom:2+i*23,left:`${12+i*8.5}%`}} onClick={()=>choose(i)} aria-label={label(i)} aria-pressed={selected===i}>{selected===i?'🐦':<span data-kids-notehead="html" className={s.noteHead} aria-hidden="true"/>}</button>)}</div></div>
 {reaction?.result==='wrong'&&<div className={s.owl} role="status">🦉 {es?`Busca ${label(target).toLowerCase()}. Mira los números a la izquierda.`:`Find ${label(target).toLowerCase()}. Look at the numbers on the left.`}</div>}
 {audioError&&<p role="alert">{es?'No se pudo iniciar el sonido. Vuelve a tocar una nota.':'Audio could not start. Tap a note again.'}</p>}
 <p className={s.progress}>{step} / 9 {es?'hogares encontrados':'homes found'}</p>
 {complete&&<div className={s.actions}><button onClick={()=>{setStep(0);setSelected(null);setReaction(undefined)}}>{es?'Jugar otra vez':'Play again'}</button><button onClick={onComplete}>{es?'Ir al quiz →':'Go to quiz →'}</button></div>}
 </GardenFrame>
}
