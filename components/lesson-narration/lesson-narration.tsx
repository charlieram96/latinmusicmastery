'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Headphones, Pause, Play, Square, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/components/language-provider'
import { femaleVoices, narrationChunks } from '@/lib/narration/text'

const OMIT = 'button,nav,input,textarea,select,script,style,svg,canvas,video,audio,[aria-hidden="true"],[hidden],[inert],[data-narration-ignore],[data-lesson-community],.sr-only'
/** Read authored visible text only, never player controls, answers, comments or hidden content. */
export function collectNarration(root: HTMLElement) {
  const paragraphs: {element: HTMLElement; text: string}[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode, parent = node.parentElement
    if (!parent || parent.closest(OMIT) || !node.textContent?.trim()) continue
    const block = parent.closest<HTMLElement>('p,h1,h2,h3,h4,li,td,th,figcaption,blockquote') ?? parent.closest<HTMLElement>('div') ?? parent
    if (getComputedStyle(parent).visibility === 'hidden' || !parent.getClientRects().length) continue
    const previous = paragraphs[paragraphs.length-1]
    if (previous?.element === block) previous.text += ' ' + node.textContent.trim()
    else paragraphs.push({element:block,text:node.textContent.trim()})
  }
  return paragraphs.flatMap(p => narrationChunks(p.text).map(text => ({element:p.element,text})))
}

export function LessonNarration({target, resetKey, language, onStart}: {
  target?: RefObject<HTMLElement | null>; resetKey: string | number; language?: string; onStart?: () => void
}) {
  const {locale} = useTranslation(), es = locale === 'es', lang = language ?? locale
  const anchor = useRef<HTMLDivElement>(null)
  const [voices,setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selected,setSelected] = useState(''), [rate,setRate] = useState(1)
  const [state,setState] = useState<'idle'|'playing'|'paused'>('idle'), [error,setError] = useState('')
  const generation = useRef(0), active = useRef<HTMLElement|null>(null), utterance = useRef<SpeechSynthesisUtterance|null>(null)
  const owned = useRef(false)
  const [progress,setProgress] = useState(0)
  const seekTo = useRef<((percent:number,paused:boolean)=>void)|null>(null)
  const pendingSpeech = useRef<(()=>void)|null>(null)
  const clearHighlight = useCallback(() => { active.current?.removeAttribute('data-narration-active'); active.current=null },[])
  const stop = useCallback(() => {
    generation.current++
    if (owned.current && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    owned.current=false; utterance.current=null; seekTo.current=null; pendingSpeech.current=null; setProgress(0); clearHighlight(); setState('idle')
  },[clearHighlight])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load=()=>setVoices(femaleVoices(window.speechSynthesis.getVoices(),lang))
    load(); window.speechSynthesis.addEventListener('voiceschanged',load)
    return ()=>window.speechSynthesis.removeEventListener('voiceschanged',load)
  },[lang])
  useEffect(()=>{stop();setError('')},[resetKey,lang,stop])
  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(`lmm-narration:${lang}`)??'null')
      setSelected(typeof saved?.voice==='string'?saved.voice:'')
      setRate([.8,.9,1,1.1,1.2].includes(saved?.rate)?saved.rate:1)
    } catch { setSelected('');setRate(1) }
  },[lang])
  const savePreference=(voiceName:string,speed:number)=>{
    try {localStorage.setItem(`lmm-narration:${lang}`,JSON.stringify({voice:voiceName,rate:speed}))} catch { /* Playback works without persistent storage. */ }
  }
  useEffect(()=>{
    const cancel=()=>stop()
    window.addEventListener('lmm-book-sound-start',cancel)
    window.addEventListener('lmm-narration-start',cancel)
    return ()=>{window.removeEventListener('lmm-book-sound-start',cancel);window.removeEventListener('lmm-narration-start',cancel);stop()}
  },[stop])
  useEffect(()=>{
    const root=target?.current??anchor.current?.closest<HTMLElement>('[data-narration-scope]')
    const pauseNarration=()=>stop()
    root?.addEventListener('play',pauseNarration,true)
    return ()=>root?.removeEventListener('play',pauseNarration,true)
  },[target,resetKey,stop])
  const voice=voices.find(v=>v.voiceURI===selected)??voices[0]
  const toggle=()=>{
    if(state==='playing'){window.speechSynthesis.pause();setState('paused');return}
    if(state==='paused'){window.speechSynthesis.resume();const pending=pendingSpeech.current;pendingSpeech.current=null;pending?.();setState('playing');return}
    if(!voice){setError(es?'No hay una voz femenina disponible para este idioma en este navegador.':'No female voice is available for this language in this browser.');return}
    const root=target?.current??anchor.current?.closest<HTMLElement>('[data-narration-scope]')
    const parts=root?collectNarration(root):[]
    if(!parts.length){setError(es?'Esta página no tiene texto para narrar.':'This page has no text to narrate.');return}
    window.dispatchEvent(new Event('lmm-narration-start'))
    onStart?.(); window.dispatchEvent(new Event('lmm-book-sound-start'))
    // Pause visible lesson media rather than competing with its soundtrack.
    root?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media=>media.pause())
    let id=++generation.current
    const starts=parts.map((_,index)=>parts.slice(0,index).reduce((sum,p)=>sum+p.text.length+1,0))
    const total=parts.reduce((sum,p)=>sum+p.text.length+1,0)
    setError('');setState('playing');owned.current=true
    const speak=(index:number,offset=0,paused=false)=>{
      if(id!==generation.current)return
      if(index>=parts.length){stop();return}
      clearHighlight();active.current=parts[index].element;active.current.setAttribute('data-narration-active','')
      setProgress(Math.round((starts[index]+offset)/total*100))
      const speech=new SpeechSynthesisUtterance(parts[index].text.slice(offset))
      const speechGeneration=id
      speech.onboundary=(event)=>{if(speechGeneration===generation.current)setProgress(Math.min(100,Math.round((starts[index]+offset+event.charIndex)/total*100)))}
      utterance.current=speech;speech.voice=voice;speech.lang=voice.lang;speech.rate=rate;speech.pitch=1
      speech.onend=(event)=>{
        if(speechGeneration!==generation.current)return
        if(typeof event?.elapsedTime==='number' && event.elapsedTime<=0 && speech.text.length>50){stop();setError(es?'Esta voz no produjo audio. Prueba otra voz en ajustes.':'This voice produced no audio. Try another voice in settings.');return}
        speak(index+1)
      }
      speech.onerror=()=>{if(speechGeneration===generation.current){stop();setError(es?'No se pudo reproducir la voz. Intenta otra voz en ajustes.':'Voice playback failed. Try another voice in settings.')}}
      const play=()=>{if(speechGeneration===generation.current)window.speechSynthesis.speak(speech)}
      if(paused)pendingSpeech.current=play
      else play()
    }
    seekTo.current=(percent,paused)=>{
      id=++generation.current
      window.speechSynthesis.cancel()
      pendingSpeech.current=null
      const position=Math.min(total-2,Math.round(total*percent/100))
      let index=starts.length-1
      while(index>0 && starts[index]>position)index--
      index=Math.max(0,index)
      let offset=Math.min(parts[index].text.length-1,Math.max(0,position-starts[index]))
      // Seek to a whole word, never start narration in the middle of one.
      while(offset>0 && !/\s/.test(parts[index].text[offset-1]))offset--
      if(!paused)window.speechSynthesis.resume()
      speak(index,offset,paused)
    }
    speak(0)
  }
  const label=state==='playing'?(es?'Pausar narración':'Pause narration'):state==='paused'?(es?'Continuar narración':'Resume narration'):(es?'Escuchar la lección':'Listen to lesson')
  return <div ref={anchor} data-narration-ignore data-narration-state={state} className="flex flex-wrap items-center gap-2">
    <Button type="button" size="icon" variant={state==='idle'?'outline':'default'} aria-label={label} title={label} onClick={toggle}>
      {state==='playing'?<Pause size={18}/>:state==='paused'?<Play size={18}/>:<Headphones size={19}/>}
    </Button>
    {state!=='idle'&&<Button type="button" size="icon" variant="outline" onClick={stop} aria-label={es?'Detener narración':'Stop narration'}><Square size={15}/></Button>}
    {state!=='idle'&&<div className="flex items-center gap-2">
      <input type="range" min={0} max={100} step={1} value={progress}
        aria-label={es?'Progreso de la narración':'Narration progress'}
        aria-valuetext={`${progress}%`} title={es?'Arrastra para adelantar o retroceder':'Drag to skip forward or back'}
        className="h-6 w-28 cursor-pointer accent-[#f58b19] sm:w-36"
        onChange={event=>seekTo.current?.(Number(event.target.value),state==='paused')}/>
      <span className="w-9 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{progress}%</span>
    </div>}
    <Popover><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={es?'Ajustes de narración':'Narration settings'} title={es?'Ajustes de narración':'Narration settings'}><Settings2 size={15}/></Button></PopoverTrigger>
      <PopoverContent side="top" align="start" className="z-[250] w-80 max-w-[90vw] space-y-3">
        <h3 className="font-semibold">{es?'Escuchar la lección':'Listen to lesson'}</h3>
        <label className="grid gap-1 text-sm">{es?'Voz femenina':'Female voice'}<select className="w-full rounded border bg-background p-2" value={voice?.voiceURI??''} onChange={e=>{stop();setSelected(e.target.value);savePreference(e.target.value,rate)}}>
          {!voices.length&&<option value="">{es?'Sin voz disponible':'No voice available'}</option>}
          {voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
        </select></label>
        <label className="flex items-center gap-2 text-sm">{es?'Velocidad':'Speed'}<select value={rate} onChange={e=>{stop();setRate(Number(e.target.value));savePreference(voice?.voiceURI??'',Number(e.target.value))}} className="rounded border bg-background p-1">{[.8,.9,1,1.1,1.2].map(r=><option key={r} value={r}>{r}×</option>)}</select></label>
        <p className="text-xs text-muted-foreground">{es?'Voz sintética. Se priorizan las voces naturales disponibles; la calidad depende del navegador y del dispositivo.':'Synthetic voice. Available natural voices are preferred; quality depends on your browser and device.'}</p>
      </PopoverContent>
    </Popover>
    {error&&<p role="alert" className="max-w-xs text-xs text-destructive">{error}</p>}
    <style>{'[data-narration-active]{background:color-mix(in srgb, var(--color-primary, #f58b19) 14%, transparent);border-radius:4px;box-shadow:inset 3px 0 #f58b19;}'}</style>
  </div>
}
