'use client'
import {useRef,useState} from 'react'
import {useTranslation} from '@/components/language-provider'
import {useNoteDemonstration} from '@/components/solfeo/use-note-demonstration'
import {LessonNarration} from '@/components/lesson-narration/lesson-narration'
import {VideoWatermark} from '@/components/playsense-studio/shared/video-watermark'
import {GardenFrame} from './first-garden'
import {KidsCorcheita,AnswerFireworks} from './answer-reaction'
import s from './mascot-entrance.module.css'

export function MascotEntrance({onEnter,onMusic}:{onEnter:()=>void;onMusic:()=>void}){
 const {locale}=useTranslation(),es=locale==='es'
 const [restartId,setRestartId]=useState(0)
 const [movie,setMovie]=useState(0)
 const [walking,setWalking]=useState(false)
 const [storyRead,setStoryRead]=useState(false)
 const [chapter,setChapter]=useState(0),[revealed,setRevealed]=useState(0)
 const sound=useNoteDemonstration({bpm:100,metronome:false,countInBars:0,volume:.4})
 const [audioError,setAudioError]=useState(false)
 const chapters=es?[
  {icon:'👋',title:'Soy Corcheíta',text:'Soy la mascota oficial de este curso y voy a ser tu guía. Antes de abrir nuestra puerta, déjame contarte una pequeña historia sobre la música.'},
  {icon:'🔔',title:'Un sonido despierta',text:'Una mañana escuché una campanita: ¡tin! Le contesté con mi voz. Podemos hacer sonidos cantando, dando palmas o tocando instrumentos.'},
  {icon:'🤫',title:'El silencio también participa',text:'Después de cantar, hice una pausa. La canción no había terminado: ese ratito sin tocar ni cantar también tenía su lugar. Escucha: sonido, sonido, silencio… ¡sonido!'},
  {icon:'🎶',title:'¡Eso es música!',text:'Elegí qué sonidos hacer, cuánto duraban y cuándo descansar. Así creé una pequeña melodía. La música es el arte de organizar sonidos y silencios en el tiempo para crear y expresar.'},
  {icon:'📖',title:'Del sonido al papel',text:'Quise compartir mi melodía y la escribí con signos musicales: eso es la notación. Con el solfeo aprenderemos a leer y cantar las notas siguiendo su ritmo. ¡Bienvenido! Abre la puerta y ven a conocer nuestro jardín.'}
 ]:[
  {icon:'👋',title:'I’m Corcheita',text:'I’m the official mascot of this course and I’ll be your guide. Before we open our door, let me tell you a little story about music.'},
  {icon:'🔔',title:'A sound wakes up',text:'One morning I heard a little bell: ding! I answered with my voice. We can make sounds by singing, clapping or playing instruments.'},
  {icon:'🤫',title:'Silence joins in',text:'After singing, I paused. The song was not over: that moment without playing or singing had its own place. Listen: sound, sound, silence… sound!'},
  {icon:'🎶',title:'That is music!',text:'I chose which sounds to make, how long they lasted and when to rest. I made a little melody. Music is the art of organising sounds and silences in time to create and express.'},
  {icon:'📖',title:'From sound to paper',text:'I wanted to share my melody, so I wrote it with musical symbols: that is notation. Through solfege we will learn to read and sing notes in rhythm. Welcome! Open the door and discover our garden.'}
 ]
 const reset=()=>{sound.stop();window.dispatchEvent(new Event('lmm-book-sound-start'));setWalking(false);setMovie(0);setChapter(0);setRevealed(0);setStoryRead(false);setAudioError(false);setRestartId(n=>n+1)}
 const move=(next:number)=>{sound.stop();setWalking(false);setChapter(next);if(next===4)setStoryRead(true);setRevealed(n=>Math.max(n,next))}
 const sample=()=>{setAudioError(false);void sound.play((chapter===1?[{frequency:784,beats:1,index:0}]:[{frequency:523.25,beats:1,index:0},{frequency:659.25,beats:1,index:1},{beats:1,index:2},{frequency:783.99,beats:1,index:3}]),{preview:true}).catch(()=>setAudioError(true))}
 const narration=useRef<HTMLDivElement>(null)
 const continueStory=()=>{sound.stop();if(storyRead){begin();return}if(movie<4){setMovie(n=>n+1);return}watchMovie()}
 const watchMovie=()=>move(1)
 const finishStory=()=>{setStoryRead(true);move(0)}
 const ready=storyRead
 const begin=()=>{if(walking||!ready)return;sound.stop();setWalking(true);onMusic()}
 return <div className={s.intro}>
 <div className="relative"><GardenFrame hideMascot title={es?'¡Hola! Soy Corcheíta':'Hello! I’m Corcheita'} label={es?'TU AVENTURA MUSICAL EMPIEZA AQUÍ':'YOUR MUSICAL ADVENTURE STARTS HERE'} detail={es?'Tu amiga en el mundo de la música':'Your friend in the world of music'}>
  <nav className={s.chapters} aria-label={es?'La historia de la música':'The story of music'}>{chapters.slice(0,revealed+1).map((item,i)=><button key={item.title} disabled={walking} aria-current={chapter===i?'step':undefined} onClick={()=>move(i)}><span aria-hidden="true">{item.icon}</span>{item.title}</button>)}</nav>
  <div ref={narration} className={s.speech} aria-live="polite"><h3>{chapters[chapter].title}</h3><p>{chapter===0&&storyRead?(es?'¡Ya conoces nuestra pequeña historia! Toca la puerta o ven conmigo para empezar a aprender música.':'You have finished our short story! Tap the door or come with me to start learning music.'):chapter===0&&movie>0?(movie===1?(es?'Quiero escribir una canción… ¡Uy! Las notas, los silencios y los tiempos se me han enredado. Voy a intentarlo otra vez.':'I want to write a song… Oops! My notes, rests and timing are all tangled. Let me try again.'):movie===2?(es?'Todavía no sé cómo ordenarlos… Lechuza, ¿me ayudas?':'I don’t know how to arrange them yet… Owl, can you help me?'):movie===3?(es?'La lechuza dice: «No pasa nada, Corcheíta. Se aprende paso a paso. Entra por esa puerta y aprenderás a escribir y organizar los sonidos, los silencios y sus duraciones. ¡Vamos juntos!»':'Owl says: “It’s okay, Corcheita. We learn step by step. Through that door you will learn to write and organise sounds, rests and their durations. Let’s go together!”'):(es?'La lechuza recomienda: «Antes de entrar por la puerta, veamos una pequeña historia sobre la música. Descubriremos qué es la música. Toca Ver pequeña historia y aprendamos juntos, paso a paso».':'Owl recommends: “Before we enter the door, let’s watch a short story about music. We will discover what music is. Tap Watch a short story and let’s learn together, step by step.”')):chapters[chapter].text}</p>{chapter>0&&<nav className={s.storyControls} aria-label={es?'Páginas de la pequeña historia':'Short story pages'}><button disabled={chapter===1} onClick={()=>move(chapter-1)}>{es?'← Anterior':'← Previous'}</button><span>{chapter} / 4</span>{chapter<4&&<button onClick={sample}>{es?'🔊 Escuchar el ejemplo':'🔊 Hear the example'}</button>}<button onClick={()=>chapter<4?move(chapter+1):finishStory()}>{chapter<4?(es?'Siguiente →':'Next →'):(es?'Terminar pequeña historia':'Finish short story')}</button><button onClick={()=>move(0)}>{es?'Volver a Corcheíta':'Back to Corcheita'}</button></nav>}</div>
  <div className={s.storyControls}>
   <button onClick={reset}>{es?'↺ Volver al principio':'↺ Back to the beginning'}</button>
   <button disabled={chapter===0&&movie===0&&!walking} onClick={()=>{if(walking){reset();return}if(chapter===0){sound.stop();setMovie(n=>Math.max(0,n-1))}else move(chapter-1)}}>{es?'← Volver':'← Back'}</button>
   <button disabled={walking} onClick={watchMovie}>{es?'🎬 Ver pequeña historia':'🎬 Watch a short story'}</button>

   {chapter===0&&<button disabled={walking} onClick={continueStory}>{ready?(es?'Entrar al curso →':'Enter the course →'):(es?'Sigue la historia →':'Continue the story →')}</button>}
  </div>
  {chapter>=2&&chapter<=3&&<div className={s.soundTrail} aria-label={es?'Dos sonidos, un silencio y otro sonido':'Two sounds, one rest and another sound'}>{['♪','♪',es?'Silencio':'Rest','♪'].map((item,i)=><span key={i} data-active={sound.playing&&sound.active===i}>{item}</span>)}</div>}
  {audioError&&<p role="alert">{es?'No se pudo iniciar el sonido. Toca el ejemplo para intentarlo otra vez.':'Audio could not start. Tap the example to try again.'}</p>}
  <div className={s.stage} data-walking={walking} data-watching={chapter>0} data-movie={chapter===0?movie:undefined}>
   <div className={s.decor} aria-hidden="true">♪<span>✦</span>♫<span>✧</span></div>
   {chapter===0&&<div className={s.tangled} aria-label={es?'Corcheíta intenta colocar notas y silencios en cinco líneas':'Corcheita tries to arrange notes and rests on five lines'}>{[0,1,2,3,4].map(i=><i key={i}/>)}{['♪','𝄽','♫','𝄾','♪'].map((note,i)=><b key={i} style={{'--piece':i} as import('react').CSSProperties}>{note}</b>)}<span>⏱</span></div>}
   {chapter===0&&movie>=3&&<aside className={s.owl} aria-label={es?'La lechuza nos ayuda':'Owl helps us'}><span aria-hidden="true">🦉🎓</span><strong>{es?'¡Aprendamos juntos! →':'Let’s learn together! →'}</strong></aside>}
   <div className={s.trail} aria-hidden="true"/>
   <button className={s.mascot} disabled={walking||chapter>0} aria-label={chapter>0?(es?'Corcheíta mira la pequeña historia':'Corcheita watches the short story'):!ready?(es?'Corcheíta: sigue la historia':'Corcheita: continue the story'):(es?'Corcheíta: vamos a la puerta':'Corcheita: let’s go to the door')} onClick={continueStory} onAnimationEnd={event=>{if(event.target!==event.currentTarget)return;if(walking)onEnter()}}><KidsCorcheita sad={chapter===0&&movie===2} lookingUp={chapter>0}/></button>
   <button className={s.door} aria-label={es?'Abrir la puerta del curso':'Open the course door'} disabled={walking||!ready||chapter>0} onClick={begin}><span className={s.doorLeaf}><b aria-hidden="true">♪</b><i/></span><strong>{walking?(es?'¡Vamos!':'Let’s go!'):!ready?(es?'Primero, la historia':'First, the story'):(es?'Entrar':'Enter')}</strong></button>
   {walking&&<AnswerFireworks/>}
  </div>
  <div className={s.listen}><LessonNarration target={narration} language={locale} resetKey={`mascot-introduction-${chapter}-${movie}-${restartId}`}/><span>{es?'Escucha a Corcheíta':'Listen to Corcheita'}</span></div>
 </GardenFrame><VideoWatermark staticStage/></div>
 <details className={s.sources}><summary>{es?'Para el profe: concepto y fuentes':'For teachers: concept and sources'}</summary><p>{es?'Definición adaptada para esta introducción, no cita literal ni definición universal única. Larousse describe la producción y combinación de sonidos y su organización temporal; la RAE destaca su dimensión expresiva. Las pausas del ejemplo muestran cómo el silencio participa en esa organización. La notación representa la música por escrito; el solfeo trabaja su lectura rítmica y entonada.':'This introduction uses an adapted definition, not a direct quotation or a single universal definition. Larousse describes producing, combining and organising sounds in time; the RAE highlights expression. Our example demonstrates how rests participate in that organisation. Notation represents music in writing; solfege develops rhythmic reading and singing.'}</p><ul><li><a href="https://www.larousse.fr/encyclopedie/divers/musique/187823" target="_blank" rel="noreferrer">Larousse — Musique</a></li><li><a href="https://www.larousse.fr/encyclopedie/musdico/son/170154" target="_blank" rel="noreferrer">Dictionnaire de la musique — Son</a></li><li><a href="https://dle.rae.es/música" target="_blank" rel="noreferrer">RAE — Música</a></li><li><a href="https://dle.rae.es/solfear" target="_blank" rel="noreferrer">RAE — Solfear</a></li></ul></details>
 </div>
}
