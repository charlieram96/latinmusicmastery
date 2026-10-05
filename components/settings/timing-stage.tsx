'use client'
import { useEffect, useRef, useState } from 'react'
import { StageHighway } from '@/components/play-sense/stage-highway/StageHighway'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import type { ReadyCheckProps } from '@/components/class-viewer/lesson-viewer/ready-check'

import { assessTiming, saveTimingCompensation, timingPresets, TIMING_BPM } from '@/lib/audio/timing-compensation'

export const TIMING_EXERCISE: ExerciseDefinition = {
  id: 'microphone-timing', title: 'Timing', description: '', instrument: 'timbale', bpm: TIMING_BPM,
  timeSignature: [4, 4], measures: 4, loopCount: 1, swing: 0, difficulty: 'beginner',
  events: Array.from({length:16},(_,i)=>({measure:Math.floor(i/4)+1,beat:i%4+1,instrument:'timbale',technique:'shell',surface:'cascara',hand:'R',duration:1,vexKey:'c/4',accent:false})),
}
export function TimingStage({ onClose, setup }: { onClose: (confirmed?: boolean) => void; setup: ReadyCheckProps }) {
  const { locale } = useTranslation()
  const es = locale === 'es'
  const [ready,setReady] = useState(false)
  const [started,setStarted] = useState(false)
  const [hasRun,setHasRun] = useState(false)
  const [preset, setPreset] = useState(0)
  const [verifiedPreset, setVerifiedPreset] = useState<number | null>(null)
  const [leak, setLeak] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const startedAt = useRef(Infinity)
  const resultPanel = useRef<HTMLDivElement>(null)
  const presets = timingPresets(TIMING_BPM)
  // Presentation only: preserve preset identities and their stored millisecond values.
  const displayPresets = [0, 4, 3, 1, 2].map(index => ({ index, value: presets[index] }))
  const labels = es ? ['Sin compensación', 'Semifusa', 'Garrapatea', 'Fusa', 'Semicorchea'] : ['No compensation', 'Sixty-fourth note', 'One-hundred-twenty-eighth note', 'Thirty-second note', 'Sixteenth note']
  const ms = presets[preset]
  const formatMs = (value: number) => value.toFixed(Number.isInteger(value * 10) ? 1 : 2)
  const nextPreset = presets.map((value, index) => ({ value, index })).filter(option => option.value > ms).sort((a, b) => a.value - b.value)[0]?.index
  useEffect(() => {
    if (!setup.calibrating || setup.calibrationVisual?.phase !== 'count-in' || (setup.getTimingElapsed?.() ?? 0) >= -.2) return
    // During count-in the student is instructed to stay silent. An onset here
    // may be speaker bleed or room noise, so it cannot validate a clap test.
    if ((setup.micSetup?.onsets ?? []).some(hit => hit.timestamp >= startedAt.current)) setLeak(true)
  }, [setup.calibrating, setup.calibrationVisual?.phase, setup.micSetup?.onsets, setup.getTimingElapsed])
  useEffect(()=>{if(setup.calibrating)setHasRun(true)},[setup.calibrating])
  const hits = hasRun || setup.calibrating ? setup.timingHits ?? [] : []
  const last = hits.at(-1)
  const assessment = assessTiming(hits, ms)
  const passed = assessment.passed && !leak && !setup.calibrationError
  const correctedLast = last ? last.offsetMs - ms : 0
  const measuring = setup.calibrationVisual?.phase === 'measuring'
  const finished = hasRun && !setup.calibrating
  const residualMs = assessment.median - ms
  const resultStatus = leak || setup.calibrationError || !assessment.stable
    ? (es ? 'Prueba no válida · repite' : 'Invalid check · repeat')
    : passed ? (es ? 'Dentro del margen de sincronización' : 'Within synchronization tolerance')
    : residualMs > 0 ? (es ? 'Aplausos atrasados' : 'Claps are late')
    : residualMs < 0 ? (es ? 'Aplausos adelantados' : 'Claps are early')
    : (es ? 'Precisión insuficiente' : 'Insufficient accuracy')
  useEffect(() => {
    if (!finished) return
    resultPanel.current?.focus({ preventScroll: true })
    resultPanel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [finished])
  const results = Array.from(new Map(hits.map(hit => [hit.beat, {eventIndex:hit.beat,grade: Math.abs(hit.offsetMs - ms)<=50 ? 'perfect' as const : 'ok' as const}])).values())
  return <Dialog open onOpenChange={value=>{if(!value){setup.onCancelCalibration?.();onClose()}}}>
    <DialogContent className="sm:max-w-5xl max-h-[95dvh] overflow-y-auto">
      <DialogTitle>{es?'Sincronización · Timing 3D':'Synchronization · 3D Timing'}</DialogTitle>
      <DialogDescription>{es?'Aplaude cuando la nota cruce la línea, siguiendo el clic. Primero escucha cuatro tiempos de preparación. Esta prueba no califica tu progreso.':'Clap as the note crosses the line, following the click. First listen to four count-in beats. This check does not grade your progress.'}</DialogDescription>
      <section className="rounded-lg border p-3 space-y-2">
        <h3 className="font-semibold">{es ? 'Compensación de latencia' : 'Latency compensation'}</h3>
        <p className="text-sm text-muted-foreground">{es ? 'Primero prueba sin compensación. Sigue el clic sin anticiparte. Si hay un retraso constante, prueba el siguiente ajuste. Recomendamos dos tomas de 97–100 %, pero puedes guardar el ajuste que elijas con cualquier resultado.' : 'Start without compensation. Follow the click without anticipating it. For a consistent delay, try the next setting. We recommend two takes at 97–100%, but you can save your chosen setting with any result.'}</p>
        <div role="group" aria-label={es ? 'Elegir compensación' : 'Choose compensation'} className="flex flex-wrap gap-2">{displayPresets.map(({ value, index }) => <button type="button" key={index} aria-pressed={preset === index} disabled={setup.calibrating} onClick={() => {
          if (preset === index) return
          setPreset(index); setVerifiedPreset(null); setHasRun(false); setStarted(false); setLeak(false); setSaveError(false)
        }} className={`rounded border px-2 py-1 text-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${preset === index ? 'border-primary text-primary bg-primary/10' : 'text-foreground'}`}>{labels[index]} · {formatMs(value)} ms</button>)}</div>
        <p className="text-xs text-muted-foreground">{es ? 'Puedes elegir cualquier ajuste y volver a Sin compensación antes de guardar. Al cambiar, puedes probar de nuevo o guardar directamente.' : 'Choose any setting or return to No compensation before saving. After changing it, test again or save directly.'}</p>
        <p className="text-xs text-muted-foreground">{TIMING_BPM} BPM · {setup.audioMode === 'speaker-safe' ? (es ? 'Altavoces: guarda silencio durante la cuenta para comprobar si el micrófono capta el clic. Si lo capta, baja el volumen o usa audífonos.' : 'Speakers: stay silent during count-in to check for click pickup. If detected, lower the volume or use headphones.') : (es ? 'Audífonos · el ajuste se guarda para este micrófono y modo.' : 'Headphones · the setting is saved for this microphone and mode.')}</p>
      </section>
      <div className="relative h-[min(52vh,460px)] min-h-60 overflow-hidden rounded-xl bg-black">
        <StageHighway exercise={TIMING_EXERCISE} sessionState={setup.calibrating ? (measuring?'playing':'countdown') : 'selecting'}
          getElapsedSeconds={setup.getTimingElapsed} playheadProgress={0} currentScore={0} currentCombo={0} currentAccuracy={0}
          metronomeBeat={setup.calibrationBeat} eventResultsLength={results.length} eventResults={results}
          showHud={false} hideCountdown showThemePicker={false} fill onStatus={status=>setReady(status==='ready')} />
        {setup.calibrating && !measuring && <div className="absolute inset-0 grid place-content-center text-center text-white pointer-events-none"><span>{es?'Prepárate · solo escucha':'Get ready · listen only'}</span><strong className="text-6xl">{setup.calibrationVisual?.countInBeat || '…'}</strong></div>}
        {finished && <div ref={resultPanel} tabIndex={-1} role="status" aria-label={es ? 'Resultado de precisión' : 'Accuracy result'} className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-background p-5 text-center text-foreground outline-none">
          <h3 className="text-lg font-semibold">{es ? 'Precisión de la prueba' : 'Test accuracy'}</h3>
          <strong className="text-6xl font-bold tabular-nums text-primary">{assessment.score.toFixed(1)} %</strong>
          <p className="text-lg font-semibold">{resultStatus}</p>
          <p className="text-sm text-muted-foreground">{es ? 'Objetivo: 97–100 %' : 'Target: 97–100%'}</p>
          <p className="text-sm">{hits.length ? `${es ? 'Desfase después de compensar' : 'Offset after compensation'}: ${residualMs > 0 ? '+' : ''}${residualMs.toFixed(1)} ms` : (es ? 'No se detectaron aplausos.' : 'No claps detected.')}</p>
          <p className="text-sm">{es ? 'Compensación aplicada' : 'Applied compensation'}: {formatMs(ms)} ms · {labels[preset]}</p>
        </div>}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums" aria-live="polite">
        <span>{es?'Palmadas detectadas':'Claps detected'}: {hits.length} / 16</span>
        {last && <span className={Math.abs(correctedLast)<=50?'text-success':'text-primary'}>{Math.abs(correctedLast)<=50 ? (es?'A tiempo':'On time') : correctedLast<0 ? (es?'Antes':'Early') : (es?'Después':'Late')} · {correctedLast.toFixed(0)} ms</span>}
      </div>
      {finished && <div className="space-y-2 text-sm" aria-live="polite">
        <p>{es ? 'Resultado de sincronización' : 'Timing check result'}: {assessment.score.toFixed(1)} % · {labels[preset]} · {formatMs(ms)} ms</p>
        <p>{leak ? (es ? 'Se detectó sonido durante la cuenta sin aplausos. No podemos confirmar que sean tus palmadas. Baja el volumen o usa audífonos y repite.' : 'Sound was detected during the silent count-in. We cannot confirm these are your claps. Lower the volume or use headphones and repeat.') : setup.calibrationError || (!assessment.stable ? (es ? 'Repite: necesitamos 16 palmadas regulares, sin golpes adicionales.' : 'Repeat: we need 16 steady claps without extra hits.') : passed ? (verifiedPreset === preset ? (es ? 'Segunda toma correcta. Puedes guardar el ajuste.' : 'Second successful take. You can save this setting.') : (es ? 'Buen resultado. Repite el mismo ajuste para confirmarlo.' : 'Good result. Repeat this setting to confirm it.')) : (es ? 'El resultado aún no alcanza el objetivo.' : 'The result has not reached the target yet.'))}</p>
      </div>}
      {saveError && <p role="alert" className="text-sm text-primary">{es ? 'No se pudo guardar: cambió el dispositivo o el navegador no permite guardar el ajuste. Repite con el micrófono activo.' : 'Could not save: the device changed or browser storage is unavailable. Repeat with the microphone active.'}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!ready || setup.calibrating || !setup.micOpen} onClick={()=>{
          setVerifiedPreset(finished && passed ? preset : null)
          setStarted(true);setHasRun(false);setLeak(false);setSaveError(false)
          const live = setup.micSetup?.getLiveAudioInput?.()
          startedAt.current = live?.context.currentTime ?? Infinity
          setup.onCalibrate()
        }}>{started?(es?'Repetir este ajuste':'Repeat this setting'):preset === 0?(es?'Comenzar sin compensación':'Start without compensation'):(es?'Probar ajuste seleccionado':'Test selected setting')}</Button>
        {finished && !passed && !leak && assessment.stable && assessment.median > ms && nextPreset !== undefined && <Button variant="outline" onClick={()=>{
          setPreset(nextPreset!);setVerifiedPreset(null);setHasRun(false);setLeak(false);setSaveError(false)
          const live = setup.micSetup?.getLiveAudioInput?.()
          startedAt.current = live?.context.currentTime ?? Infinity
          setup.onCalibrate()
        }}>{es?'Probar':'Try'} {labels[nextPreset!]} · {formatMs(presets[nextPreset!])} ms</Button>}
        <Button variant="outline" disabled={setup.calibrating || !setup.micOpen} onClick={()=>{
          const live = setup.micSetup?.getLiveAudioInput?.()
          if (!saveTimingCompensation(live, setup.audioMode, ms)) { setSaveError(true); return }
          onClose(true)
        }}>{es?'Guardar compensación y continuar':'Save compensation and continue'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
