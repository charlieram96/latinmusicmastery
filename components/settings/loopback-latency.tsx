'use client'
import { recordSessionLatency } from '@/lib/audio/session-latency'
import { attachLatencyRecorder, type LiveAudioInput } from '@/lib/audio/live-audio-input'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StageHighway } from '@/components/play-sense/stage-highway/StageHighway'
import { audibleTime } from '@/lib/audio/audible-clock'
import { SYNC_BEAT_SECONDS, SYNC_COUNT_IN_SECONDS, SYNC_FIRST_NOTE, SYNC_OFFSETS, SYNC_EXERCISE } from '@/lib/audio/sync-probe-plan'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { analyzeLoopback, makeLatencyProbe, PROBE_COUNT, type LoopbackResult } from '@/lib/audio/loopback-latency'

export function LoopbackLatency({ getLiveAudioInput, deviceLabel, onClose }: {getLiveAudioInput?:()=>LiveAudioInput|null;deviceLabel:string;onClose:()=>void}) {
  const { locale }=useTranslation(), es=locale==='es'
  const [busy,setBusy]=useState(false), [result,setResult]=useState<LoopbackResult|null>(null), [error,setError]=useState('')
  const [compensation,setCompensation]=useState<number|null>(null)
  const [diagnostics,setDiagnostics]=useState<{gaps:number;gapRanges:string;zeroMs:number;referenceMs:number|null;referenceOk:boolean}|null>(null)
  const [stageReady,setStageReady]=useState(false)
  const [visualBeat,setVisualBeat]=useState(-1)
  const clock=useRef<{context:AudioContext;start:number}|null>(null)
  const frozen=useRef(-SYNC_COUNT_IN_SECONDS)
  const getElapsed=useCallback(()=>clock.current ? audibleTime(clock.current.context)-clock.current.start : frozen.current,[])
  const previous=useRef<{context:AudioContext;stream:MediaStream;ms:number}|null>(null)
  const [difference,setDifference]=useState<number|null>(null)
  const cleanup=useRef<()=>void>(()=>{}), generation=useRef(0)
  useEffect(()=>()=>{generation.current++;cleanup.current()},[])
  function cancel(){generation.current++;cleanup.current();setBusy(false)}
  async function start() {
    cancel()
    const run=++generation.current
    setBusy(true);setError('');setResult(null);setDifference(null);setDiagnostics(null);setCompensation(null)
    let node:AudioWorkletNode|null=null
    let detach:(()=>void)|undefined
    let frame=0
    let timer:ReturnType<typeof setTimeout>|undefined
    const sources:AudioBufferSourceNode[]=[]
    const dispose=()=>{clearTimeout(timer);cancelAnimationFrame(frame);frozen.current=getElapsed();clock.current=null;sources.forEach(source=>{try{source.stop()}catch{};source.disconnect()});detach?.()}
    cleanup.current=dispose
    try {
      const live=getLiveAudioInput?.()
      if(!live) throw new Error('Open the microphone first')
      const {context:ctx,stream}=live
      const recorder=await attachLatencyRecorder(live)
      detach=recorder.dispose
      if(run!==generation.current){dispose();return}
      if(getLiveAudioInput?.()?.context!==ctx || getLiveAudioInput?.()?.stream!==stream){dispose();throw new Error('Audio session changed')}
      node=recorder.node
      const rate=ctx.sampleRate, startFrame=Math.ceil((ctx.currentTime+.25)*rate)
      const offsets=SYNC_OFFSETS
      clock.current={context:ctx,start:startFrame/rate+SYNC_FIRST_NOTE}
      const animate=()=>{if(run!==generation.current)return;setVisualBeat(Math.floor(getElapsed()/SYNC_BEAT_SECONDS));frame=requestAnimationFrame(animate)}
      frame=requestAnimationFrame(animate)
      const length=Math.ceil((SYNC_FIRST_NOTE+PROBE_COUNT*4*SYNC_BEAT_SECONDS+.3)*rate)
      node.port.onmessage=({data}:{data:{samples:Float32Array;reference:Float32Array;received:number;discontinuities:number;gaps:Array<{fromFrame:number;toFrame:number}>;maxZeroRun:number}})=>{
        if(run!==generation.current)return
        dispose()
        if(data.received!==length){setError(es?'La captura se interrumpió. Revisa la conexión y repite.':'Capture was interrupted. Check the connection and repeat.');setBusy(false);return}
        if(getLiveAudioInput?.()?.context!==ctx || getLiveAudioInput?.()?.stream!==stream){setError(es?'Cambió la sesión de audio. Repite la prueba.':'Audio session changed. Repeat the test.');setBusy(false);return}
        const measured=analyzeLoopback(data.samples,rate,offsets)
        const reference=analyzeLoopback(data.reference,rate,offsets)
        const referenceOk=reference.detected===PROBE_COUNT && reference.delaysMs.every(ms=>Math.abs(ms)<=1)
        setDiagnostics({gaps:data.discontinuities,gapRanges:data.gaps.map(g=>`${(g.fromFrame/rate).toFixed(3)}–${(g.toFrame/rate).toFixed(3)} s`).join(', '),zeroMs:data.maxZeroRun/rate*1000,referenceMs:reference.medianMs,referenceOk})
        measured.reliable=measured.reliable && referenceOk && data.discontinuities===0 && data.maxZeroRun/rate<.02
        setCompensation(recordSessionLatency(live,measured))
        if(measured.reliable && measured.medianMs!==null){
          const last=previous.current
          if(last?.context===ctx && last.stream===stream)setDifference(measured.medianMs-last.ms)
          previous.current={context:ctx,stream,ms:measured.medianMs}
        }
        setResult(measured);setBusy(false)
      }
      node.onprocessorerror=()=>{if(run!==generation.current)return;dispose();setBusy(false);setError(es?'No se pudo grabar la prueba. Repite.':'The test could not be recorded. Please repeat.')}
      node.port.postMessage({type:'record',startFrame,length})
      const probe=makeLatencyProbe(rate), buffer=ctx.createBuffer(1,probe.length,rate)
      buffer.copyToChannel(new Float32Array(probe),0)
      offsets.forEach(offset=>{const source=ctx!.createBufferSource();source.buffer=buffer;source.connect(ctx!.destination);source.connect(node!,0,1);source.start(startFrame/rate+offset);sources.push(source)})
      // The distinctive downbeat probe is the accented click. Other beats use a
      // quieter tone; they are not targets for the loopback matcher.
      const weak=ctx.createBuffer(1,Math.round(rate*.025),rate)
      const weakSamples=weak.getChannelData(0)
      for(let i=0;i<weakSamples.length;i++)weakSamples[i]=.06*Math.sin(2*Math.PI*650*i/rate)*Math.exp(-i/(rate*.005))
      for(let beat=-4;beat<PROBE_COUNT*4;beat++){
        if(beat>=0 && beat%4===0)continue
        const click=ctx.createBufferSource();click.buffer=beat===-4?buffer:weak
        click.connect(ctx.destination);click.start(startFrame/rate+SYNC_FIRST_NOTE+beat*SYNC_BEAT_SECONDS);sources.push(click)
      }
      timer=setTimeout(()=>{if(run!==generation.current)return;generation.current++;dispose();setBusy(false);setError(es?'No llegó la grabación. Mantén esta pestaña activa y repite.':'No recording received. Keep this tab active and repeat.')},Math.ceil((length/rate+5)*1000))
    } catch {
      dispose()
      if(run===generation.current){setBusy(false);setError(es?'La sesión del micrófono no está disponible. Cierra esta ventana y activa el micrófono.':'The microphone session is unavailable. Close this window and enable the microphone.')}
    }
  }
  return <Dialog open onOpenChange={open=>{if(!open){cancel();onClose()}}}>
    <DialogContent className="sm:max-w-5xl max-h-[90dvh] overflow-y-auto">
      <DialogTitle>{es?'Sincronización automática · Timing 3D':'Automatic synchronization · 3D Timing'}</DialogTitle>
      <DialogDescription>{es?'Quítate los audífonos. Acerca un auricular a 2–5 cm del micrófono y silencia los speakers. No aplaudas ni hables.':'Take off your headphones. Place one earpiece 2–5 cm from the microphone and mute the speakers. Do not clap or speak.'}</DialogDescription>
      <p className="text-sm text-muted-foreground">{deviceLabel} · {es?'Sesión de audio activa':'Active audio session'}</p>
      <p className="text-sm">{es?'4/4 · 100 BPM · Un compás de preparación. El centro de la bolita cruza el centro de la línea en el clic acentuado del tiempo 1. Sin palmadas.':'4/4 · 100 BPM · One count-in bar. The note center crosses the line center on the accented beat 1 click. No clapping.'}</p>
      <div className="relative h-[min(42vh,360px)] min-h-56 overflow-hidden rounded-xl bg-black">
        <StageHighway exercise={SYNC_EXERCISE} sessionState={busy?'playing':'selecting'} getElapsedSeconds={getElapsed}
          playheadProgress={0} currentScore={0} currentCombo={0} currentAccuracy={0} metronomeBeat={visualBeat<0?0:visualBeat%4+1}
          eventResultsLength={0} eventResults={[]} showHud={false} hideCountdown showThemePicker={false} fill onStatus={status=>setStageReady(status==='ready')} />
        {busy && <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 text-center text-white pointer-events-none">
          <span className="text-xs">{visualBeat<0?(es?'Preparación':'Count-in'):(es?'Compás':'Bar')+' '+Math.min(PROBE_COUNT,Math.floor(visualBeat/4)+1)}</span>
          <strong className="block text-3xl text-primary">{visualBeat < -4?'…':((visualBeat%4+4)%4)+1}</strong>
        </div>}
      </div>
      <div role="status" aria-live="polite" className="rounded-xl border border-border p-4 space-y-2 text-sm">
        {busy ? <p className="text-primary">{es?'Midiendo 8 primeros tiempos · unos 23 segundos…':'Measuring 8 downbeats · about 23 seconds…'}</p> : result ? <>
          <p className={result.reliable?'text-success':'text-destructive'}>{result.reliable?(es?'Estable dentro de esta prueba':'Stable within this test'):(es?'Medición no válida: repite la prueba':'Invalid measurement: repeat the test')}</p>
          <p className={compensation!==null?'text-success':'text-primary'}>{compensation!==null ? (es?`Compensación activa: ${compensation.toFixed(1)} ms · solo esta sesión de audio`:`Compensation active: ${compensation.toFixed(1)} ms · this audio session only`) : (es?'Sin compensación: se necesitan dos rondas válidas, completas y separadas por un máximo de 10 ms.':'No compensation: two valid complete rounds within 10 ms are required.')}</p>
          <p>{es?'Pulsos reconocidos':'Pulses recognized'}: {result.detected}/{result.total}</p>
          {result.medianMs!==null && <p>{es?'Ida y vuelta':'Round trip'}: {result.medianMs.toFixed(1)} ms · IQR: {result.iqrMs?.toFixed(1)} ms</p>}
          {difference!==null && <p className={Math.abs(difference)<=10?'text-success':'text-destructive'}>{es?'Cambio respecto a la prueba anterior (misma sesión)':'Change from previous test (same session)'}: {difference>0?'+':''}{difference.toFixed(1)} ms</p>}
          {diagnostics && <div className="border-t border-border pt-2 space-y-1">
            <p>{es?'Referencia interna':'Internal reference'}: {diagnostics.referenceOk?'OK':(es?'Revisar':'Check')} · {diagnostics.referenceMs?.toFixed(2) ?? '—'} ms</p>
            <p>{es?'Saltos de bloques':'Block gaps'}: {diagnostics.gaps} · {es?'Ceros consecutivos':'Consecutive zeros'}: {diagnostics.zeroMs.toFixed(1)} ms</p>
            {diagnostics.gaps>0 && <p>{es?'Tramos interrumpidos de la grabación':'Interrupted recording intervals'}: {diagnostics.gapRanges}</p>}
            <p className="text-xs text-muted-foreground">{es?'Estos controles comprueban la captura dentro del navegador; no descartan cambios en el hardware.':'These checks verify capture inside the browser; they do not rule out hardware changes.'}</p>
          </div>}
          <table className="w-full text-xs tabular-nums text-left"><thead><tr><th>{es?'Pulso':'Pulse'}</th><th>ms</th><th>{es?'Correlación':'Correlation'}</th><th>{es?'Detectado':'Detected'}</th></tr></thead><tbody>{result.pulses.map((pulse,i)=><tr key={i}><td>{i+1}</td><td>{pulse.delayMs?.toFixed(1) ?? '—'}</td><td>{pulse.correlation.toFixed(2)}</td><td>{pulse.accepted?'✓':'—'}</td></tr>)}</tbody></table>
          {result.clipped && <p>{es?'La entrada saturó. Baja el volumen del auricular para repetir.':'Input clipped. Lower the headphone volume before repeating.'}</p>}
          {!result.reliable && !result.clipped && <p>{diagnostics && diagnostics.gaps>0 ? (es?'Hubo una interrupción dentro de la grabación. No se aplicará compensación.':'There was an interruption within the recording. No compensation will be applied.') : diagnostics && !diagnostics.referenceOk ? (es?'Falló la referencia interna del audio. No es un problema de orientación del auricular.':'The internal audio reference failed. Earpiece positioning is not the cause.') : result.detected<7 ? (es?'No se reconocieron suficientes pulsos. Comprueba la posición del auricular.':'Too few pulses were recognized. Check the earpiece position.') : (es?'La captura o los tiempos no cumplen los controles de estabilidad. No se aplicará compensación.':'Capture or timing failed the stability checks. No compensation will be applied.')}</p>}
        </> : <p>{error || (es?'Listo para emitir 8 pulsos de prueba.':'Ready to play 8 test pulses.')}</p>}
      </div>
      <p className="text-xs text-muted-foreground">{es?'Diagnóstico de salida + recorrido acústico + entrada. No mide la pantalla. Dos rondas válidas activan la compensación técnica para esta sesión; al cerrar o cambiar el audio deberá validarse de nuevo. El audio se analiza localmente y no se guarda.':'Output + acoustic path + input diagnostic. Does not measure screen delay. Two valid rounds activate timing compensation for this session; closing or changing audio requires revalidation. Audio is analyzed locally and is not saved.'}</p>
      <div className="flex gap-2"><Button onClick={()=>void start()} disabled={busy || !stageReady}>{result||error?(es?'Repetir':'Repeat'):(es?'Comenzar prueba':'Start test')}</Button><Button variant="outline" onClick={()=>{cancel();onClose()}}>{busy?(es?'Cancelar':'Cancel'):(es?'Cerrar':'Close')}</Button></div>
    </DialogContent>
  </Dialog>
}
