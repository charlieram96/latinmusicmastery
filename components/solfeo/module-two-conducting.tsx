'use client'
import {useId} from 'react'
import {useBookTranslation} from './use-book-translation'
import {useBookAudio} from './use-book-audio'
import {ListenExampleCard} from './listen-example-card'
import type {Vector} from './manual-book-page'
import type {DemonstrationSettings} from './use-note-demonstration'
export function ModuleTwoConducting({vector,id,settings}:{vector:Vector;id:string;settings:DemonstrationSettings&{volume?:number}}){
 const {es,svg}=useBookTranslation(),name='conduct'+useId().replace(/[^a-zA-Z0-9]/g,'')
 const playback=useBookAudio(settings.volume,settings.onDemoStart),bpm=settings.bpm??100,beat=60/bpm,points=vector.notes
 const duration=points.length*beat
 const frames=points.map((p,i)=>`${i/points.length*100}%{transform:translate(${p.x}px,${p.y}px)}`).join('')+`100%{transform:translate(${points[0].x}px,${points[0].y}px)}`
 return <div className="space-y-2 text-foreground" style={{'--manual-muted':'hsl(var(--muted-foreground))','--manual-green':'#265b4d','--manual-line':'hsl(var(--border))'} as React.CSSProperties}>
 <svg viewBox="160 40 340 245" role="img" aria-label={es?`Marcación animada de ${points.length}/4`:`Animated conducting in ${points.length}/4`} className="mx-auto w-full" style={{height:180}}>
 <g dangerouslySetInnerHTML={{__html:svg(vector.svg).replaceAll('#252723','currentColor').replaceAll('#686d67','var(--manual-muted)')}}/>
 {playback.playing&&playback.count===0&&<circle className={name} r="16" fill="none" stroke="#f58215" strokeWidth="4" style={{animation:`${name} ${duration}s linear 4 both`}}/>}
 </svg>
 <style>{`@keyframes ${name}{${frames}}@media(prefers-reduced-motion:reduce){.${name}{animation:none!important;opacity:0}}`}</style>
 <ListenExampleCard playing={playback.playing} title={es?'Ver y escuchar la marcación':'Watch and hear the conducting pattern'} detail={es?`${points.length}/4 · Cuatro compases · Repite el recorrido con la mano.`:`${points.length}/4 · Four measures · Follow the pattern with your hand.`} onClick={()=>playback.playing?playback.stop():void playback.play({bpm,duration:duration*4,pulses:Array.from({length:points.length*4},(_,i)=>({start:i*beat,beat:i%points.length+1,beatsPerBar:points.length,beatSeconds:beat})),events:Array.from({length:points.length*4},(_,i)=>({frequency:i%points.length===0?1400:1000,start:i*beat,duration:.05,gain:0,visualIndex:i%points.length,pitch:'click'}))},id)}/>
 {playback.error&&<p role="alert">{es?'No se pudo iniciar el sonido. Inténtalo de nuevo.':'Audio could not start. Try again.'}</p>}
 </div>
}
