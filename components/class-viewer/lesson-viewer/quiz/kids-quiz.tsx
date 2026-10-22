'use client'
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { CourseSequenceContext } from '@/components/solfeo/course-sequence-navigation'
import { Volume2 } from 'lucide-react'
import { femaleVoices } from '@/lib/narration/text'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import { useTranslation } from '@/components/language-provider'
import type { QuizEngine } from '@/hooks/use-quiz-engine'
import type { QuizQuestion } from '@/types/modules'
import { useOutcomeSound } from '@/components/solfeo-kids/use-celebration-sound'
import { saveReward } from '@/lib/quiz/local-rewards'
import { percentScore } from '@/lib/quiz/engine'
import { gradeQuestionScore, hasAnswer, type Choice } from '@/lib/quiz/grading'
import { useAnswerLabels } from './use-answer-labels'
import { AudioPrompt } from './audio-prompt'
import { QuestionInput } from './question-input'
import s from './kids-quiz.module.css'
import { useAdventureTheme } from '@/components/solfeo-kids/adventure-theme'
import { Timbalito, useTimbalito } from '@/components/learning-mode/timbalito'
import { KidsCorcheita, AnswerFireworks } from '@/components/solfeo-kids/answer-reaction'

const habitats=[['🐦','🌿','🌱'],['🐠','🫧','🐚'],['🦋','🌸','🌼'],['🐿️','🌳','🍃'],['🐝','🌻','🌷'],['🐰','🌙','⭐']]
const notePitches:Record<string,string>={Do:'C4',Re:'D4',Mi:'E4',Fa:'F4',Sol:'G4',La:'A4',Si:'B4'}
const colors=['#ffbdca','#ffe39a','#a7dcd5','#c6b4ef','#bce394','#b5d3ff']
export function KidsQuiz({questions,engine,finished,onFinish,onRestart,nextHref,rewardId}:{rewardId?:string;questions:QuizQuestion[];engine:QuizEngine;finished:boolean;onFinish:()=>void;onRestart:()=>void;nextHref?:string|null}){
 const {locale}=useTranslation(),es=locale==='es'
 const timbalito=useTimbalito()
 const courseSequence=useContext(CourseSequenceContext)
 const destination=courseSequence.next
 const nextTitle=destination && (!nextHref || destination.href === nextHref) ? destination.title : undefined
 const nextLabel=nextTitle ? `${es?'Siguiente':'Next'}: ${nextTitle}` : es?'Siguiente actividad':'Next activity'
 const sound=useNoteDemonstration({metronome:false,countInBars:0})
 const {bannerCorrect}=useAnswerLabels()
 const [treeOpen,setTreeOpen]=useState(false)
 const [evaluation,setEvaluation]=useState<Record<string,number>>({})
 const [celebration,setCelebration]=useState(0)
 const [attempt,setAttempt]=useState(0)
 const [answerCue,setAnswerCue]=useState<'ok'|'bad'>()
 useEffect(()=>{
  if(!celebration)return
  const scene=gameRef.current?.closest('[data-first-garden]')
  scene?.setAttribute('data-kids-reaction','correct')
  const timer=setTimeout(()=>{setCelebration(0);scene?.removeAttribute('data-kids-reaction')},2400)
  return()=>{clearTimeout(timer);scene?.removeAttribute('data-kids-reaction')}
 },[celebration])
 const gameRef=useRef<HTMLElement>(null)
 const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([])
 useEffect(()=>{
  if(!window.speechSynthesis)return
  const load=()=>setVoices(femaleVoices(window.speechSynthesis.getVoices(),locale))
  load();window.speechSynthesis.addEventListener('voiceschanged',load)
  return()=>window.speechSynthesis.removeEventListener('voiceschanged',load)
 },[locale])
 const [index,setIndex]=useState(0),[retry,setRetry]=useState(false),[speechError,setSpeechError]=useState(false)
 useEffect(()=>{
  const scene=gameRef.current?.closest('[data-first-garden]')
  if(retry)scene?.setAttribute('data-kids-reaction','wrong')
  return()=>{if(scene?.getAttribute('data-kids-reaction')==='wrong')scene.removeAttribute('data-kids-reaction')}
 },[retry])
 const theme=useAdventureTheme()
 const habitat=theme.id==='garden'?habitats[index%habitats.length]:[theme.friends[index%3],theme.decor[0],theme.decor[1]]
 const q=questions[index],answer=engine.state.answers[q.id],done=q.id in engine.state.graded
 useEffect(()=>{
  if(window.matchMedia('(min-width:801px)').matches)gameRef.current?.closest('[data-quiz-garden]')?.scrollIntoView({block:'start',behavior:'instant'})
 },[treeOpen,retry,index,done])
 useEffect(()=>()=>{window.speechSynthesis?.cancel()},[])
 useEffect(()=>{window.speechSynthesis?.cancel()},[index,locale,finished])
 const speak=(text:string)=>{
  if(!window.speechSynthesis){setSpeechError(true);return}
  window.speechSynthesis.cancel();setSpeechError(false)
  const voice=new SpeechSynthesisUtterance(text)
  const selected=femaleVoices(window.speechSynthesis.getVoices(),locale)[0]??voices[0]
  if(selected)voice.voice=selected
  voice.lang=selected?.lang??(es?'es-MX':'en-US');voice.rate=.98;voice.pitch=1
  voice.onerror=(event)=>{if(event.error!=='canceled'&&event.error!=='interrupted')setSpeechError(true)}
  window.speechSynthesis.speak(voice)
 }
 const choose=(value:unknown)=>{if(done)return;engine.setAnswer(q.id,value);setRetry(false)
  const label=((q.options as {choices?:Choice[]})?.choices??[]).find(c=>c.id===value)?.text?.trim()
  if(label&&notePitches[label])void sound.play([{frequency:lessonNote(notePitches[label]).frequency,beats:1,index:0}],{preview:true}).catch(()=>{})
 }
 const check=()=>{
  if(!hasAnswer(q,answer)||done)return
  setAttempt(n=>n+1)
  const score=gradeQuestionScore(q,answer)
  setAnswerCue(score>=1?'ok':'bad')
  setEvaluation(previous=>q.id in previous?previous:{...previous,[q.id]:score})
  if(score>=1){engine.check(q.id);setRetry(false);setCelebration(n=>n+1)}else setRetry(true)
 }
 const percentage=percentScore(questions,evaluation)
 const passed=percentage>=70
 useOutcomeSound(finished?(passed?'fanfare':'bad'):answerCue,finished?'finished':attempt||undefined)
 const allEvaluated=questions.every(item=>item.id in evaluation)
 const [rewardSaved,setRewardSaved]=useState<boolean|null>(null)
 useEffect(()=>{if(!finished){setRewardSaved(null);return}if(rewardId&&window.location.pathname.startsWith('/dashboard/'))setRewardSaved(saveReward(rewardId,percentage))},[finished,rewardId,percentage])
 const allSolved=questions.every(item=>item.id in engine.state.graded)
 const visit=(i:number)=>{sound.stop();setCelebration(0);setIndex(i);setRetry(false);setTreeOpen(false)}
 const next=()=>{if(allSolved)onFinish();else{const nextIndex=questions.findIndex((item,i)=>i>index&&!(item.id in engine.state.graded));visit(nextIndex>=0?nextIndex:questions.findIndex(item=>!(item.id in engine.state.graded)))}}
 const message=done?(es?'¡Lo descubriste! Vamos al siguiente reto.':'You found it! Let’s try the next challenge.'):retry?(es?'La lechuza nos ayuda. ¡Prueba con su pista!':'Owl is helping us. Try with her clue!'):(es?'Escucha, mira y elige. ¡Yo te acompaño!':'Listen, look and choose. I’m here with you!')
 if(finished)return <section className={s.game} aria-label={es?'Aventura completada':'Adventure complete'}><div className={s.finishArt} aria-hidden="true">{theme.id==='garden'?'🌻 🦋 🌸':theme.friends.join(' ')}</div><h2>{theme.id!=='garden'?(es?'¡Completaste esta aventura!':'You completed this adventure!'):es?'¡Hiciste florecer el camino!':'You made the path bloom!'}</h2><p>{es?'Escuchaste, probaste y descubriste. ¡Cada paso cuenta!':'You listened, tried and discovered. Every step counts!'}</p><div className={s.evaluation} role="status"><h3>{es?'Mi evaluación final':'My final evaluation'}</h3><strong className={s.score}>{percentage} / 100</strong><p>{passed?(es?'🌟 ¡Aprobado!':'🌟 Passed!'):(es?'🌱 Aún no aprobado. ¡Podemos practicar otra vez!':'🌱 Not passed yet. Let’s practise again!')}</p><p>{es?`${questions.filter(item=>(evaluation[item.id]??0)>=1).length} de ${questions.length} respuestas completamente correctas al primer intento.`:`${questions.filter(item=>(evaluation[item.id]??0)>=1).length} of ${questions.length} fully correct first answers.`}</p><small>{es?'Cada pregunta vale lo mismo. Se incluyen los puntos parciales. Para aprobar: 70 / 100. Las pistas y correcciones son para practicar.':'Each question has equal weight, including partial credit. Passing score: 70 / 100. Hints and corrections are for practice.'}</small></div>{rewardSaved!==null&&<p>{rewardSaved?(es?'🌟 Tu mejor nota cuenta en Logros.':'🌟 Your best score counts in Achievements.'):(es?'No se pudo guardar el progreso en este navegador.':'Progress could not be saved in this browser.')} <Link href="/dashboard/achievements">{es?'Ver mis logros →':'View my achievements →'}</Link></p>}<button className={s.action} onClick={()=>{onRestart();setEvaluation({});setAnswerCue(undefined);setIndex(0);setRetry(false);setAttempt(0);setCelebration(0)}}>{es?'Volver a jugar':'Play again'} ↻</button>{nextHref&&<Link className={s.action} href={nextHref}>{nextLabel} →</Link>}</section>
 return <section ref={gameRef} className={s.game} data-habitat={index%6} data-tree-open={treeOpen} data-kids-reaction={celebration?'correct':undefined} aria-label={es?'Juego de preguntas':'Question game'}>
  {celebration>0&&<AnswerFireworks sound={false} key={celebration}/>}
  <div className={s.treeControl}><button className={s.treeButton} aria-expanded={treeOpen} aria-controls="kids-question-tree" onClick={()=>setTreeOpen(!treeOpen)}><span aria-hidden="true">{theme.id==='garden'?'🌳':theme.icon}</span>{theme.id==='garden'?(es?'Mi árbol de preguntas':'My question tree'):(es?'Mi mapa de preguntas':'My question map')}</button>{treeOpen&&<nav id="kids-question-tree" className={s.questionTree} aria-label={es?'Ramas de preguntas':'Question branches'}>{questions.map((item,i)=><button key={item.id} aria-current={i===index?'step':undefined} onClick={()=>visit(i)}><span aria-hidden="true">{item.id in engine.state.graded?'🌸':'🍃'}</span><strong>{i+1}</strong><span>{item.question}</span></button>)}</nav>}</div>
  <div className={s.path} aria-label={es?`Reto ${index+1} de ${questions.length}`:`Challenge ${index+1} of ${questions.length}`}>
   {questions.map((item,i)=><span key={item.id} data-current={i===index} data-grown={item.id in engine.state.graded}><span aria-hidden="true">{theme.id==='garden'?(i===index?'🦋':item.id in engine.state.graded?'🌻':'🌱'):(i===index?theme.icon:item.id in engine.state.graded?'⭐':'○')}</span><small>{i+1}</small></span>)}
  </div>
  <div className={s.discoveryScene} key={q.id} data-solved={done}><div className={s.scenery} aria-hidden="true"><span>{habitat[1]}</span><span>{habitat[2]}</span><span>{habitat[1]}</span></div><div className={s.prompt}><span className={s.guide} aria-hidden="true">{habitat[0]}</span><div><small>{es?'ESCUCHA · TOCA · DESCUBRE':'LISTEN · TAP · DISCOVER'}</small><h3>{q.question}</h3></div><button className={`${s.listen} ${s.listenFlower}`} onClick={()=>speak(q.question)} aria-label={es?'Escuchar la pregunta':'Listen to the question'}><span className={s.flowerSpeaker} aria-hidden="true"><span>{theme.id==='garden'?['🐦','🐠','🌸','🌳','🌻','🐰'][index%6]:theme.friends[index%3]}</span><Volume2 size={20}/></span> <span>{es?'Escuchar':'Listen'}</span></button></div>
  {/después de Re|after Re/i.test(q.question)&&<div className={s.noteBridge} aria-hidden="true"><span>Re<small>🌿</small></span><b>→</b><span data-arrived={done}>{done?'Mi':'?'}<small>🌿</small></span><i data-arrived={done}>🐦</i></div>}
  {q.image_url&&<img className={s.questionImage} src={q.image_url} alt={es?'Imagen de la pregunta':'Question image'}/>}
  {q.question_type==='audio_choice'&&q.audio_url&&(q.options as {optionMode?:string})?.optionMode!=='audio'&&<div className={s.audioHabitat}><AudioPrompt src={q.audio_url}/></div>}
  {q.question_type==='multiple_choice'||(q.question_type==='audio_choice'&&(q.options as {optionMode?:string})?.optionMode!=='audio')?<div className={s.choices} role="radiogroup" aria-label={q.question}>{((q.options as {choices?:Choice[]})?.choices??[]).map((choice,i)=><button key={choice.id} role="radio" aria-checked={answer===choice.id} disabled={done} onClick={()=>choose(choice.id)} className={s.character} style={{'--friend':colors[i%colors.length]} as CSSProperties}><span className={s.answerCreature} aria-hidden="true">{theme.id!=='garden'?theme.friends[i%3]:index%6===1?['🐠','🐟','🐡'][i%3]:index%6===4?['🌻','🌷','🌼'][i%3]:['🐦','🐸','🦋'][i%3]}</span><strong>{choice.text}</strong><span className={s.pick} aria-hidden="true">{answer===choice.id?'✓':'♪'}</span></button>)}</div>:<div className={s.otherInput}><QuestionInput question={q} answer={answer} isGraded={done} onChange={choose}/></div>}
  </div>
  {retry&&<aside className={s.owlHelp} role="status"><div className={s.owl} aria-hidden="true"><span className={s.cap}>🎓</span>🦉<span className={s.wing}>🪽</span></div><div className={s.scroll}><strong>{es?'La lechuza tiene una pista':'Owl has a clue'}</strong><p>{bannerCorrect(q)||(es?'Mira la explicación y vuelve a probar.':'Read the explanation and try again.')}</p>{q.explanation&&<small>{q.explanation}</small>}<button className={s.listen} onClick={()=>speak([bannerCorrect(q),q.explanation].filter(Boolean).join('. '))} aria-label={es?'Escuchar a la lechuza':'Listen to the owl'}><Volume2 size={20} aria-hidden="true"/></button></div></aside>}
  <div className={s.coach} data-success={done} role="status">{timbalito?<Timbalito key={`${q.id}-${attempt}`} sad={retry} celebrating={!!celebration}/>:<KidsCorcheita key={`${q.id}-${attempt}`} sad={retry}/>}<div><strong>{timbalito?(es?'Timbalito te acompaña':'Timbalito is with you'):(es?'Corcheita te acompaña':'Corcheita is with you')}</strong><p>{message}</p></div><button className={s.listen} onClick={()=>speak(message)} aria-label={es?'Escuchar la pista':'Listen to the hint'}><Volume2 size={20} aria-hidden="true"/></button></div>
  {speechError&&<p role="status">{es?'La voz no está disponible en este navegador. Puedes leer la consigna con tu acompañante.':'Voice is unavailable in this browser. Read the prompt with your helper.'}</p>}
  {allEvaluated&&!allSolved&&<button className={s.action} onClick={onFinish}>{es?'Ver mi evaluación final':'See my final evaluation'}</button>}
  <div className={s.actions}>{done?<button className={s.action} onClick={next}>{allSolved?(es?'Ver mi evaluación final':'See my final evaluation'):(es?'Siguiente pregunta':'Next question')} →</button>:<button className={s.action} disabled={!hasAnswer(q,answer)} onClick={check}>{retry?(es?'Probar otra vez':'Try again'):(es?'¡Esta es mi respuesta!':'This is my answer!')} ✨</button>}{retry&&!allEvaluated&&<button className={s.action} onClick={()=>{const unseen=questions.findIndex(item=>!(item.id in evaluation));if(unseen>=0)visit(unseen)}}>{es?'Continuar a la siguiente pregunta →':'Continue to the next question →'}</button>}</div>
 </section>
}
