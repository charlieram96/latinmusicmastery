'use client'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { courseQuestions, type CourseQuestion } from '@/lib/solfeo/course-assessment'
import type { QuizQuestion } from '@/types/modules'
import type { ManualPage } from '@/components/solfeo/manual-book-page'
import type { DemonstrationSettings } from '@/components/solfeo/use-note-demonstration'
import s from './first-garden.module.css'
import { HabitatScenery } from './habitat-scenery'
import { useAdventureTheme } from './adventure-theme'
import { useOutcomeSound } from './use-celebration-sound'
import { KidsCorcheita, AnswerFireworks } from './answer-reaction'
const names=['Do','Re','Mi','Fa','Sol','La','Si','Do']
const pitches=['C4','D4','E4','F4','G4','A4','B4','C5']
const letters=['C','D','E','F','G','A','B','C']
const colors=['#ffa3b0','#ffcf8f','#ffe887','#bce79c','#8cddd5','#a9cdf8','#c8b2ec','#ffa3b0']
function useGardenSound(settings?:DemonstrationSettings&{volume?:number}) {
 const [error,setError]=useState(false)
 const audio=useNoteDemonstration({...settings,bpm:100,metronome:false,countInBars:0})
 const play=(index:number,beats=1)=>{setError(false);void audio.play([{frequency:lessonNote(pitches[index]).frequency,beats,index}],{preview:true}).catch(()=>setError(true))}
 return {...audio,play,error}
}
function Corchea({message,footnote,surprised=false,onReplay,dreamOpen}:{message?:string;footnote?:string;surprised?:boolean;onReplay?:()=>void;dreamOpen?:boolean}) {
 const {locale}=useTranslation(),es=locale==='es',[hint,setHint]=useState(0)
 const theme=useAdventureTheme()
 const tips=es?['¡Psst! Soy Corcheita. ¿Qué nota viene después de Re?','Mi viene después de Re. ¡Toca Mi y escúchala!','¿Sabías que Do también tiene una letra? Es C.']:['Psst! I’m Corcheita. Which note comes after Re?','Mi comes after Re. Tap Mi and listen!','Did you know Do has a letter name too? It is C.']
 return <aside className={`${s.mascot} ${surprised?s.surprised:''}`}><button onClick={()=>onReplay?onReplay():setHint((hint+1)%tips.length)} aria-expanded={dreamOpen} aria-label={dreamOpen!==undefined?(es?`Corcheita: ${dreamOpen?'ocultar':'mostrar'} sueño`:`Corcheita: ${dreamOpen?'hide':'show'} dream`):onReplay?(es?'Corcheita: volver a soñar':'Corcheita: dream again'):es?'Corcheita: otra pista':'Corcheita: another hint'}><svg viewBox="0 0 100 120" aria-hidden="true"><path d="M55 80V28Q85 30 76 52Q70 43 58 42" stroke="#7251b1" strokeWidth="7" fill="#bba1eb" strokeLinejoin="round"/><ellipse cx="40" cy="81" rx="22" ry="18" transform="rotate(-18 40 81)" fill="#bba1eb" stroke="#7251b1" strokeWidth="3"/><path d="M23 75L10 59M59 74L81 66M31 98L25 110H13M48 97L57 109H70" stroke="#7251b1" strokeWidth="5" fill="none" strokeLinecap="round"/><circle className={s.eye} cx="33" cy="77" r="3" fill="#283852"/><circle className={s.eye} cx="47" cy="75" r="3" fill="#283852"/><path className={s.smile} d="M35 86Q42 92 49 84" stroke="#283852" fill="none" strokeWidth="2.5" strokeLinecap="round"/>{surprised&&<ellipse className={s.gasp} cx="42" cy="86" rx="4" ry="5" fill="#283852"/>}</svg></button>{dreamOpen!==false&&<p tabIndex={onReplay?0:undefined}><strong>Corcheita</strong>{message?(hint===0?message:hint===1?(es?theme.missionEs:theme.missionEn):(es?'Escucha otra vez y busca un detalle. Tu profe también puede ayudarte.':'Listen again and look for one detail. Your teacher can help too.')):tips[hint]}{footnote&&<small className={s.mysteryHint}>{footnote}</small>}</p>}</aside>
}
function Landscape({growth}:{growth?:number}){const theme=useAdventureTheme();return <div className={s.landscape} aria-hidden="true"><HabitatScenery/><div className={s.nightStars}>{Array.from({length:18},(_,i)=><span key={i} style={{left:`${10+(i*29)%75}%`,top:`${3+i*5}%`,fontSize:`${8+i%3*4}px`,animationDelay:`${-i*.47}s`}}>{i%3===0?'✧':'✦'}</span>)}</div><div className={`${s.cornerSun} ${s.daySun}`} data-complete={growth===8}><svg viewBox="0 0 180 180"><g className={s.sunRays}>{Array.from({length:12},(_,i)=><g key={i} transform={`rotate(${i*30} 90 90)`}><path className={s.sunRay} d="M90 23V7" stroke="#ffbf36" strokeWidth="8" strokeLinecap="round"/></g>)}</g><g className={s.sunFace}><circle cx="90" cy="90" r="52" fill="#ffda62"/><circle cx="73" cy="82" r="4" fill="#684a35"/><circle cx="107" cy="82" r="4" fill="#684a35"/><ellipse cx="65" cy="96" rx="8" ry="5" fill="#ffaf72"/><ellipse cx="115" cy="96" rx="8" ry="5" fill="#ffaf72"/><path d="M77 101Q90 116 104 100" fill="none" stroke="#684a35" strokeWidth="4" strokeLinecap="round"/></g></svg></div><div className={`${s.cornerSun} ${s.nightMoon}`} data-complete={growth===8}><svg viewBox="0 0 180 180"><g className={s.moonFace}><circle cx="90" cy="90" r="52" fill="#e2eaff"/><circle cx="65" cy="65" r="10" fill="#becce8"/><circle cx="117" cy="109" r="12" fill="#c5d2ed"/><circle cx="71" cy="113" r="6" fill="#c5d2ed"/><path className={s.moonRest} d="M76 86q5 5 10 0m15 0q5 5 10 0M83 101q10 10 20 0" fill="none" stroke="#54618d" strokeWidth="3" strokeLinecap="round"/><g className={s.moonHappy}><ellipse cx="81" cy="85" rx="5" ry="7" fill="#405079"/><ellipse cx="106" cy="85" rx="5" ry="7" fill="#405079"/><circle cx="82" cy="82" r="2" fill="white"/><circle cx="107" cy="82" r="2" fill="white"/><path d="M80 100Q94 124 108 100Z" fill="#586391"/><path d="M86 109q8-5 16 0" stroke="#f5a9bd" strokeWidth="4"/></g></g><g className={s.moonStars} fill="#f9e6a6"><path d="m150 34 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m154 126 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g></svg></div>{theme.id!=='garden'&&<div className={s.environment} data-environment={theme.id}>{Array.from({length:12},(_,i)=><span key={i} style={{left:`${(i*31)%96}%`,top:`${(i*17)%85}%`,'--delay':`${i*.7}s`} as CSSProperties}>{theme.id==='ocean'||theme.id==='detective'?(i%3?'🫧':theme.decor[i%3]):theme.id==='space'?(i%3?'✦':theme.decor[i%3]):theme.decor[i%3]}</span>)}</div>}<span className={s.cloud}>{theme.id==='space'?'🪐':theme.id==='ocean'?'🫧':'☁'}</span><span className={s.butterfly}>{theme.id==='garden'?'🦋':theme.friends[0]}</span><span className={s.flowers}>{theme.id==='garden'?'🌼 🌷 🌱 🌸':theme.decor.join(' ')}{theme.id==='garden'&&<svg className={s.flowerHat} viewBox="0 0 50 30"><path d="M10 24L17 5H35L42 24Z" fill="#ffbe58"/><path d="M5 24H47" stroke="#e58a22" strokeWidth="5" strokeLinecap="round"/></svg>}</span><span className={s.rabbit}>{theme.id==='garden'?'🐇':theme.friends[1]}</span></div>}
export function GardenFrame({title,detail,children,label,mascotMessage,mascotFootnote,dreamKey=0,onDreamReplay,history=false,dreamOpen,growth,hideMascot=false,quiz=false,reaction}:{reaction?:{result:'correct'|'wrong';id:number};quiz?:boolean;hideMascot?:boolean;growth?:number;dreamOpen?:boolean;history?:boolean;dreamKey?:number;onDreamReplay?:()=>void;title:string;detail:string;children:ReactNode;label?:string;mascotMessage?:string;mascotFootnote?:string}) {
 const {locale}=useTranslation(),es=locale==='es'
 const theme=useAdventureTheme()
 const [paused,setPaused]=useState(false)
 const [expiredReaction,setExpiredReaction]=useState<typeof reaction>()
 const activeReaction=reaction!==expiredReaction?reaction:undefined
 useOutcomeSound(reaction?.result==='wrong'?'bad':reaction?.result==='correct'?(growth===8?'fanfare':'ok'):undefined,reaction?.id)
 useEffect(()=>{if(!reaction)return;const timer=setTimeout(()=>setExpiredReaction(reaction),2400);return()=>clearTimeout(timer)},[reaction])
 const sceneRef=useRef<HTMLElement>(null)
 useEffect(()=>{
  if(!quiz)return
  const frame=sceneRef.current
  const header=document.querySelector('header[aria-label="Cabecera de la clase"], [aria-label="Cabecera de la clase"]')
  const update=()=>frame?.style.setProperty('--garden-header-height',`${header?.getBoundingClientRect().height??100}px`)
  update()
  const observer=new ResizeObserver(update)
  if(header)observer.observe(header)
  const raf=requestAnimationFrame(()=>frame?.scrollIntoView({block:'start',behavior:'instant'}))
  return()=>{observer.disconnect();cancelAnimationFrame(raf)}
 },[quiz,reaction])
 return <section style={{'--garden-sky':theme.sky,'--garden-ground':theme.ground} as CSSProperties} data-environment={theme.id} ref={sceneRef} data-quiz-garden={quiz||undefined} data-kids-reaction={activeReaction?.result} className={`${s.scene} ${history?s.historyScene:''}`} data-history={history||undefined} data-paused={paused} data-first-garden>
  <Landscape growth={growth}/><div className={s.reactionWeather} aria-hidden="true">☁️<span>💧　💧　💧　💧　💧</span></div>{activeReaction?.result==='correct'&&<AnswerFireworks sound={false} key={activeReaction.id}/>}<div className={s.sceneContent}><div className={s.eyebrow}>{label??(es?'DESCUBRE JUGANDO':'DISCOVER THROUGH PLAY')}</div><h2>{title}</h2><p className={s.instruction}>{detail}</p>{children}{!hideMascot&&(activeReaction?<aside className={s.mascot}><KidsCorcheita sad={activeReaction.result==='wrong'}/><p><strong>Corcheita</strong>{mascotMessage}</p></aside>:<Corchea key={dreamKey} message={mascotMessage} footnote={mascotFootnote} surprised={dreamKey>0&&dreamOpen!==false} onReplay={onDreamReplay} dreamOpen={dreamOpen}/>)}</div>
  <button className={s.motion} onClick={()=>setPaused(!paused)} aria-pressed={paused}>{paused?(es?'Activar animaciones':'Play animations'):(es?'Pausar animaciones':'Pause animations')}</button>
 </section>
}
function Friends({onPlay,active,compact=false,mystery=false}:{onPlay:(i:number)=>void;active:number|null;compact?:boolean;mystery?:boolean}) {
 const {locale}=useTranslation(),es=locale==='es'
 return <div className={`${s.friends} ${compact?s.compact:''}`}>{names.map((name,i)=><button key={i} style={{background:colors[i],marginBottom:compact?0:i*5}} className={`${s.friend} ${mystery?s.mysteryFriend:''}`} onClick={()=>onPlay(i)} aria-label={mystery?(es?`Escuchar sonido misterioso ${i+1}`:`Listen to mystery sound ${i+1}`):`${name} ${pitches[i]}`} aria-pressed={active===i}><span aria-hidden="true">• •</span><strong aria-hidden={mystery||undefined}>{mystery?'?':name}</strong>{!mystery&&<small>{letters[i]}{i===7?' ↑':''}</small>}</button>)}</div>
}
export function GardenCover({complete}:{complete:boolean}){
 useOutcomeSound(complete?'fanfare':undefined,complete?'lesson-complete':undefined)
 const {locale}=useTranslation(),es=locale==='es',sound=useGardenSound()
 return <GardenFrame title={complete?(es?'¡Tu jardín ya tiene música!':'Your garden has music!'):(es?'¡La música empieza contigo!':'Music starts with you!')} detail={complete?(es?'Conociste las notas, sus letras y su historia. Ahora vamos a jugar.':'You explored notes, letters and their story. Now let’s play.'):(es?'Toca un sonido misterioso y escucha. En la siguiente página descubrirás su nombre.':'Tap a mystery sound and listen. Discover its name on the next page.')} label={es?'ORIGEN Y NOMBRES DE LAS NOTAS':'ORIGINS AND NOTE NAMES'} mascotFootnote={!complete?(es?'¿Todavía no sabes cuál es? Pasa a la siguiente página, «¡Conoce a las notas!», y te enseño.':'Not sure which one it is yet? Go to the next page, “Meet the notes!”, and I’ll show you.'):undefined}>
 <Friends onPlay={i=>sound.play(i)} active={sound.active} compact mystery={!complete}/>
 <div className={s.trail}><span>👂 {es?'Escucha':'Listen'}</span><span>🌻 {es?'Explora':'Explore'}</span><span>🧩 {es?'Juega':'Play'}</span></div>
 <p className={s.feedback} role="status">{sound.error?(es?'Toca otra vez para iniciar el sonido.':'Tap again to start audio.'):complete?(es?'Un paso más. ¡Puedes seguir practicando!':'Another step! Keep exploring.'):(es?'Con tu instructor · Raffy Pérez':'With your instructor · Raffy Pérez')}</p>
 </GardenFrame>
}
function GardenHistory(){
 const {locale}=useTranslation(),es=locale==='es'
 const [selected,setSelected]=useState<number|null>(null),[replay,setReplay]=useState(0),[dreamOpen,setDreamOpen]=useState(false)
 const chapters=es?[
  {title:'Ut y sus amigos',icon:'🌱',date:'Italia · siglo XI',text:'¡Viajamos unos mil años atrás! En la Europa medieval, los cantores buscaban maneras de recordar y compartir melodías. En Italia, Guido de Arezzo relacionó sonidos, líneas escritas y sílabas. Ut, Re, Mi, Fa, Sol y La salieron del comienzo de seis frases de un himno llamado Ut queant laxis.',hint:'¡Una canción ayudó a recordar los nombres! Las líneas permitían ver mejor si el sonido subía o bajaba.'},
  {title:'Llega Si',icon:'🌿',date:'Un nombre que llegó después',text:'La familia todavía no tenía a Si. Más adelante se formó su nombre con las iniciales de Sancte Iohannes, palabras del mismo himno dedicadas a san Juan. Así se añadió otra sílaba a la familia.',hint:'¡Si llegó después! Su nombre guarda las iniciales S e I de Sancte Iohannes.'},
  {title:'De Ut a Do',icon:'🌻',date:'Desde el siglo XVII',text:'Con el paso del tiempo, Do se fue usando en lugar de Ut. Este cambio se difundió desde el siglo XVII. El pentagrama y la manera de escribir cuánto dura cada sonido también se desarrollaron durante muchos siglos: ¡muchas personas ayudaron a construir nuestra escritura musical!',hint:'¡La música tiene una historia muy larga! Hoy cantamos Do, Re, Mi, Fa, Sol, La y Si.'}
 ]:[
  {title:'Ut and friends',icon:'🌱',date:'Italy · 11th century',text:'Let’s travel back about a thousand years! In medieval Europe, singers needed ways to remember and share melodies. In Italy, Guido of Arezzo connected sounds, written lines and syllables. Ut, Re, Mi, Fa, Sol and La came from the beginnings of six phrases in a hymn called Ut queant laxis.',hint:'A song helped singers remember the names! Lines made it easier to see whether a sound went up or down.'},
  {title:'Si arrives',icon:'🌿',date:'A name added later',text:'The family did not yet include Si. Later, its name was formed from the initials of Sancte Iohannes, words in the same hymn addressed to Saint John. Another syllable joined the family.',hint:'Si arrived later! Its name holds the initials S and I from Sancte Iohannes.'},
  {title:'From Ut to Do',icon:'🌻',date:'From the 17th century',text:'Over time, Do came into use in place of Ut. This change spread from the 17th century. The staff and ways of writing how long sounds last also developed over many centuries. Many people helped build our musical writing!',hint:'Music has a long history! Today we sing Do, Re, Mi, Fa, Sol, La and Si.'}
 ]
 const chapter=selected===null?null:chapters[selected]
 const reveal=(i:number)=>{setSelected(i);setDreamOpen(true);setReplay(n=>n+1)}
 const toggleDream=()=>{if(dreamOpen)setDreamOpen(false);else reveal(selected??0)}
 return <GardenFrame history title={es?'Una historia que florece':'A story that blooms'} detail={es?'Toca una semilla y viaja con Corcheita al pasado. Toca a Corcheita para mostrar u ocultar su sueño.':'Tap a seed and travel back in time with Corcheita. Tap Corcheita to show or hide her dream.'} dreamKey={replay} dreamOpen={dreamOpen} onDreamReplay={toggleDream} mascotMessage={chapter?chapter.text+' '+chapter.hint:(es?'¿De dónde vienen los nombres? ¡Despertemos una historia!':'Where do the names come from? Let’s wake up a story!')}>
 <div className={s.historyLayout}><div className={s.seeds}>{chapters.map((c,i)=><button key={c.title} onClick={()=>reveal(i)} aria-pressed={selected===i}><span aria-hidden="true">{c.icon}</span><small>{i+1}</small><strong>{c.title}</strong></button>)}</div>
 <div className={s.dreamStage}>
 {chapter&&dreamOpen?<div key={replay} className={s.dreamSequence} data-shape={selected} aria-hidden="true">
 <div className={s.sparkles}>{Array.from({length:16},(_,i)=><i key={i} style={{'--angle':`${i*22.5}deg`,'--spark':colors[i%7]} as CSSProperties}>✦</i>)}</div>
 <div className={s.dreamCloud}><svg className={s.thoughtShape} viewBox="0 0 600 360" preserveAspectRatio="none"><path d="M70 285C15 288 0 225 34 193C-6 151 18 95 69 93C58 43 113 9 157 38C181 -1 245 -1 272 29C311 -7 376 0 397 36C447 11 501 40 503 79C560 66 599 115 576 157C615 190 604 250 560 265C567 312 513 343 471 324C438 365 373 365 341 337C301 367 245 361 221 333C178 360 122 341 119 310C95 319 77 306 70 285Z"/></svg><small>{chapter.date}</small><h3>{chapter.title}</h3><p>{chapter.hint}</p></div><span className={s.dreamTail}><i/><i/><i/></span>
 </div>:chapter?null:<p className={s.dreamPrompt}>{es?'☁ Aquí aparecen los sueños de Corcheita…':'☁ Corcheita’s dreams appear here…'}</p>}
 </div></div>
 {chapter&&dreamOpen&&<p className={s.dreamCaption} role="status">{es?'Toca a Corcheita para ocultar el sueño y su explicación.':'Tap Corcheita to hide the dream and its explanation.'}</p>}
 </GardenFrame>
}
export function GardenPage({page,settings}:{page:ManualPage;settings:DemonstrationSettings&{volume?:number}}){
 const {locale}=useTranslation(),es=locale==='es'
 const sound=useGardenSound(settings)
 const [selected,setSelected]=useState<number|null>(null)
 const kind=page.blocks[0]?.type
 const title=kind==='garden-notes'?(es?'¡Conoce a las notas!':'Meet the notes!'):kind==='garden-history'?(es?'Una historia que florece':'A story that blooms'):kind==='garden-letters'?(es?'Cada nota tiene una letra':'Every note has a letter'):(es?'Sonidos que suben y duran':'Sounds go higher and last longer')
 const detail=kind==='garden-notes'?(es?'Toca cada personaje. Después de Si llega otro Do, más agudo.':'Tap each friend. After Si comes another, higher Do.'):kind==='garden-history'?(es?'Toca las tres semillas para descubrir la historia.':'Tap the three seeds to discover the story.'):kind==='garden-letters'?(es?'Toca una flor y descubre la letra de su nota.':'Tap a flower to discover its note letter.'):(es?'Escucha y compara. ¿Qué cambia en cada sonido?':'Listen and compare. What changes in each sound?')
 if(kind==='garden-history')return <GardenHistory/>
 return <GardenFrame title={title} detail={detail} mascotMessage={kind==='garden-history'?(es?'¡Psst! Ut es el nombre antiguo que estamos descubriendo.':'Psst! Ut is the older name we are discovering.'):kind==='garden-letters'?(es?'La flor cambia de aspecto, pero su nota sigue siendo la misma.':'The flower changes appearance, but its note stays the same.'):kind==='garden-sounds'?(es?'El Do corto dura menos y el Do largo dura más: cambia la duración. Entre Do grave y Do agudo cambia la altura.':'Short Do lasts less time and long Do lasts more: their duration changes. Low and high Do differ in pitch.'):undefined}>
 {kind==='garden-notes'?<Friends onPlay={i=>{setSelected(i);sound.play(i)}} active={sound.active}/>:kind==='garden-letters'?<div className={s.flowerBed}>{names.slice(0,7).map((name,i)=><button key={name} onClick={()=>{setSelected(i);sound.play(i)}} aria-pressed={selected===i} aria-label={`${name}: ${letters[i]}`}><span className={s.flower} style={{background:colors[i]}}>{selected===i?letters[i]:'✿'}</span><strong>{name}</strong><small>{selected===i?`${name} = ${letters[i]}`:(es?'Descubre':'Discover')}</small></button>)}</div>:<><div className={s.soundChoices}>{(es?['Do grave','Do agudo','Do corto','Do largo','Silencio']:['Low Do','High Do','Short Do','Long Do','Rest']).map((label,i)=><button key={label} aria-pressed={selected===i} onClick={()=>{setSelected(i);if(i===4)sound.stop();else sound.play(i===1?7:0,i===3?3:i===2?.5:1)}}><span aria-hidden="true">{['🐻','🐦','🌱','🌳','🤫'][i]}</span>{label}</button>)}</div><div className={s.soundWave} data-playing={sound.playing} data-sound={selected===null?'idle':['low','high','short','long','rest'][selected]} aria-hidden="true">{Array.from({length:15},(_,i)=><span key={i} style={{'--arc':`${Math.sin(i/14*Math.PI)*30}px`,'--delay':`${i*.025}s`} as CSSProperties}><i style={{background:colors[i%7]}}/></span>)}</div><p className={s.story}>{es?'Grave y agudo: cambia la altura. Corto y largo: cambia la duración. El silencio es tiempo sin sonido.':'Low and high: pitch changes. Short and long: duration changes. A rest is time without sound.'}</p></>}
 <p className={s.feedback} role="status">{sound.error?(es?'No se pudo iniciar el sonido. Vuelve a tocar.':'Audio could not start. Try tapping again.'):kind==='garden-notes'&&selected!==null?`${names[selected]} · ${letters[selected]}${selected===7?(es?' · más agudo':' · higher'):''}`:kind==='garden-letters'&&selected!==null?`${names[selected]} = ${letters[selected]}`:es?'Tómate tu tiempo. ¡Puedes explorar otra vez!':'Take your time. You can explore again!'}</p>
 </GardenFrame>
}
const quizData:CourseQuestion[]=[
 ['¿Qué nota viene después de Re?','Which note comes after Re?',['Mi','Sol','Do'],0,'Después de Re viene Mi.','Mi comes after Re.'],
 ['¿Qué letra acompaña a Do?','Which letter belongs to Do?',['A','C','F'],1,'Do también se llama C.','Do is also called C.'],
 ['Al subir, después de Si llega…','Going up, after Si comes…',['Fa','La','Do'],2,'Vuelve Do en un registro más agudo.','Do returns in a higher register.'],
 ['¿Qué nombre antiguo se usaba antes de Do?','Which older name was used before Do?',['Ut','Si','Sol'],0,'Guido usaba Ut; Do llegó después.','Guido used Ut; Do came later.'],
 ['¿Qué cambia entre un sonido corto y uno largo?','What changes between a short and a long sound?',['La duración','El nombre de Guido','La letra de la nota'],0,'La duración nos dice cuánto dura un sonido.','Duration tells us how long a sound lasts.'],
 ['¿Qué nos indica un silencio?','What does a rest tell us?',['Tocar más fuerte','Tiempo sin sonido','Cambiar de instrumento'],1,'El silencio indica tiempo sin sonido de esa voz o instrumento.','A rest indicates time without sound in that voice or instrument.'],
].map((row)=>{const [question_es,question_en,choices,correct,explanation_es,explanation_en]=row as [string,string,string[],number,string,string];const translations:Record<string,string>={'La duración':'Duration','El nombre de Guido':'Guido’s name','La letra de la nota':'The note letter','Tocar más fuerte':'Play louder','Tiempo sin sonido':'Time without sound','Cambiar de instrumento':'Change instrument'};return {question_es,question_en,choices:choices.map(es=>({es,en:translations[es]??es})),correct,explanation_es,explanation_en}})
export function GardenQuiz({classId,nextHref}:{questions:QuizQuestion[];classId:string;nextHref:string}) {
 const {locale}=useTranslation(),es=locale==='es'
 return <GardenFrame quiz hideMascot mascotMessage={es?'¡Cada descubrimiento abre una flor! Puedes volver a intentarlo.':'Each discovery opens a flower! You can try again.'} title={es?'El reto de la mariposa':'The butterfly challenge'} detail={es?'¡Ayuda a la mariposa a visitar seis flores! Escucha y elige a tu amigo.':'Help the butterfly visit six flowers! Listen and choose a friend.'}><div className={s.quiz}><QuizRunner kind="Quiz" classItemId={classId+'-garden-quiz'} questions={courseQuestions({id:classId+'-garden',questions:quizData},locale)} nextHref={nextHref}/></div></GardenFrame>
}
function GrowingFlower({stage}:{stage:number}) {
 return <svg viewBox="0 0 160 190" aria-hidden="true" className={s.growingFlower}>
  <ellipse cx="80" cy="153" rx="49" ry="7" fill="#ad794d" opacity=".25"/>
  {stage>=1&&<g className={s.growPart}><path d="M80 147v19m0-10-9 9m9-5 10 10" fill="none" stroke="#b58760" strokeWidth="3" strokeLinecap="round"/><ellipse cx="80" cy="145" rx="7" ry="5" fill="#97613a"/></g>}
  {stage>=2&&<g className={s.growPart} fill="none" stroke="#b58760" strokeWidth="2" strokeLinecap="round"><path d="M80 162v17m-9-15-11 8m30-3 12 7m-22-7-9 10m9-6 7 10"/></g>}
  {stage>=3&&<path className={s.growStem} d="M80 148Q73 112 80 66" fill="none" stroke="#55984c" strokeWidth="7" strokeLinecap="round"/>}
  {stage>=4&&<g className={s.growPart} fill="#83c95d" stroke="#55984c" strokeWidth="2"><path d="M78 125Q42 128 42 100Q68 99 78 125Z"/><path d="M78 106Q112 109 119 80Q88 81 78 106Z"/></g>}
  {stage>=6&&<g className={s.petals}>{Array.from({length:stage===6?4:stage===7?8:12},(_,i)=><ellipse key={i} className={s.growPetal} style={{animationDelay:`${i*65}ms`}} cx="80" cy="35" rx="10" ry="21" transform={`rotate(${i*30} 80 63)`} fill={i%2?'#ffd447':'#ffb928'} stroke="#eca524" strokeWidth="1.5"/>)}</g>}
  {stage>=5&&<g className={s.growPart}><circle cx="80" cy="63" r="19" fill="#89552f"/><circle cx="74" cy="60" r="2.3" fill="#fff1b3"/><circle cx="87" cy="60" r="2.3" fill="#fff1b3"/><path d="M74 69q7 7 13-1" fill="none" stroke="#fff1b3" strokeWidth="2" strokeLinecap="round"/></g>}
 </svg>
}
export function GardenPractice({onComplete}:{onComplete:()=>void}) {
 const {locale}=useTranslation(),es=locale==='es',sound=useGardenSound()
 const [step,setStep]=useState(0),[feedback,setFeedback]=useState('')
 const [reaction,setReaction]=useState<{result:'correct'|'wrong';id:number}>()
 const stages=es?['Despierta la raíz','La raíz se hace fuerte','¡Crece el tallo!','Se abren las hojitas','Un corazón de girasol','Llegan los primeros pétalos','¡Más pétalos de colores!','¡Floreció nuestro jardín!']:['Wake up the root','The root grows stronger','The stem grows!','Leaves open up','A sunflower heart','The first petals arrive','More colorful petals!','Our garden has bloomed!']
 const complete=step===8
 const play=(i:number)=>{
  sound.play(i)
  if(complete)return
  setReaction(previous=>({result:i===step?'correct':'wrong',id:(previous?.id??0)+1}))
  if(i===step){setStep(n=>Math.min(n+1,8));setFeedback(stages[step])}
  else setFeedback(es?`Probemos otra vez: busca ${names[step]}${step===7?', el agudo de la derecha':''}. Tu flor te espera.`:`Try again: find ${names[step]}${step===7?', the higher one on the right':''}. Your flower is waiting.`)
 }
 return <GardenFrame reaction={reaction} growth={step} mascotMessage={feedback||(es?'Cada nota correcta ayuda a crecer a nuestra flor. ¡Empieza por Do!':'Each correct note helps our flower grow. Start with Do!')} title={complete?(es?'¡Tu jardín ha florecido!':'Your garden has bloomed!'):(es?'¡Plantemos una melodía!':'Let’s plant a melody!')} detail={complete?(es?'Do, Re, Mi, Fa, Sol, La, Si… ¡Do! Lo hiciste crecer, nota a nota.':'Do, Re, Mi, Fa, Sol, La, Si… Do! You grew it, note by note.'):(es?`Toca ${names[step]}${step===0?' grave, a la izquierda':step===7?' agudo, a la derecha':''}. Cada sonido correcto hace crecer tu girasol.`:`Tap ${names[step]}${step===0?', low on the left':step===7?', high on the right':''}. Each correct sound grows your sunflower.`)}>
 <div className={s.growthGarden} data-complete={complete}>
  {complete&&<div className={s.sunflowerBackdrop} aria-hidden="true"><GrowingFlower stage={8}/></div>}
  <div className={s.heroFlower}><GrowingFlower stage={step}/></div>
  <div className={s.growthTrail} aria-label={es?'Crecimiento de la flor':'Flower growth'}>{names.map((name,i)=><div key={i} data-grown={i<step} aria-label={`${name}: ${i<step?stages[i]:(es?'por descubrir':'to discover')}`}><div className={s.miniFlower}><GrowingFlower stage={i<step?i+1:0}/></div><strong>{name}{i===7?' ↑':''}</strong></div>)}</div>
  {complete&&<div className={s.gardenCelebration} aria-hidden="true"><div className={s.flowerShower}>{Array.from({length:18},(_,i)=><span key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${i*75}ms`,'--flower-color':colors[i%7]} as CSSProperties}>{['🌻','🌼','🌸','🌷'][i%4]}</span>)}</div>{[20,50,80].map((left,j)=><div key={left} className={s.firework} style={{left:`${left}%`,top:`${20+j%2*30}%`}}>{Array.from({length:12},(_,i)=><i key={i} style={{'--angle':`${i*30}deg`,'--spark':colors[i%7],animationDelay:`${j*.25}s`} as CSSProperties}>✦</i>)}</div>)}</div>}
 </div>
 <p role="status" className={s.growthStatus}>{sound.error?(es?'Toca otra vez para iniciar el sonido.':'Tap again to start audio.'):feedback||(es?'Ocho notas, una flor. ¡Vamos a darle vida!':'Eight notes, one flower. Let’s bring it to life!')} <span>{step} / 8</span></p>
 {!complete?<Friends compact active={sound.active} onPlay={play}/>:<div><button className={s.primary} onClick={onComplete}>{es?'Ir al quiz':'Go to quiz'} →</button><button className={s.secondary} onClick={()=>{sound.stop();setStep(0);setFeedback('');setReaction(undefined)}}>{es?'Volver a plantar':'Plant again'}</button></div>}
 </GardenFrame>
}
