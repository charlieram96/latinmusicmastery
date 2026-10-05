'use client'

import { createClient } from '@/lib/supabase/client'
import { acousticProfileKey, readAcousticProfile, saveAcousticProfile, type AcousticProfile } from '@/lib/audio/acoustic-profile'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, MicOff, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { ACOUSTIC_INSTRUMENTS, clapDetectionFloor, noiseReference } from '@/lib/audio/mic-setup'
import type { CalibrationData, OnsetEvent } from '@/lib/play-sense/types'
import type { ReadyCheckProps } from './ready-check'

export interface MicSetup {
  getLiveAudioInput?: () => import('@/lib/audio/live-audio-input').LiveAudioInput | null
  devices: MediaDeviceInfo[]
  selectedId: string
  muted: boolean
  onSelect: (id: string) => Promise<void>
  onMute: () => void
  onsets: OnsetEvent[]
  onFloor: (floor: number | null, sampling?: boolean) => void
  timingResult: CalibrationData | null
}
type Step = 'sound' | 'mic' | 'noise' | 'timing' | 'instrument' | 'soft' | 'medium' | 'strong' | 'done'
const ORDER: Step[] = ['sound','mic','noise','timing','instrument','soft','medium','strong','done']

export function useMicSetupWizard(props: ReadyCheckProps) {
  const { locale } = useTranslation()
  const es = locale === 'es'
  const say = (a: string,b: string) => es ? a : b
  const [authResolved,setAuthResolved] = useState(false)
  const [profileChecked,setProfileChecked] = useState<string | null>(null)
  const [userId,setUserId] = useState<string | null>(null)
  const [restored,setRestored] = useState(false)
  const [saved,setSaved] = useState(false)
  const [pendingProfile,setPendingProfile] = useState<AcousticProfile | null>(null)
  useEffect(() => {
    if (!props.micSetup) return
    let active=true
    const client=createClient()
    void client.auth.getSession().then(({data}) => {if(active) {setUserId(data.session?.user.id ?? null);setAuthResolved(true)}}).catch(() => {if(active) setAuthResolved(true)})
    const {data} = client.auth.onAuthStateChange((_event,session) => {if(active) {setUserId(session?.user.id ?? null);setAuthResolved(true)}})
    return () => {active=false;data.subscription.unsubscribe()}
  },[])
  const [open,setOpen] = useState(true)
  const [soundConfirmed,setSoundConfirmed] = useState(false)
  const [step,setStep] = useState<Step>('sound')
  const [instrument,setInstrument] = useState('claps')
  const [elapsed,setElapsed] = useState(0)
  const [noise,setNoise] = useState<number | null>(null)
  const [hits,setHits] = useState<number[]>([])
  const [rhythmOnly,setRhythmOnly] = useState(false)
  const energies = useRef<number[]>([])
  const softEnergies = useRef<number[]>([])
  const [soft,setSoft] = useState<number[]>([])
  const [medium,setMedium] = useState<number[]>([])
  const [error,setError] = useState('')
  const [timingStarted,setTimingStarted] = useState(false)
  const [timingReviewed,setTimingReviewed] = useState(false)
  const [lastResult,setLastResult] = useState<string | null>(null)
  const samples = useRef<number[]>([])
  const input = useRef(props.inputLevel)
  input.current = props.inputLevel
  const lastHit = useRef(-Infinity)
  const setup = props.micSetup
  const enabled = !!setup && props.audioMode !== 'playsense' && props.audioMode !== 'midi'
  const readyMic = !!setup && props.micOpen && !setup.muted
  const selected = ACOUSTIC_INSTRUMENTS.flatMap(group => [...group.items]).find(item => item[0] === instrument)!
  const label = selected?.[es ? 1 : 2] ?? instrument
  const guideColumn = step === 'sound' ? 1 : ['mic','noise'].includes(step) ? 2 : step === 'timing' ? 3 : 4
  const sampling = step === 'soft' || step === 'medium' || step === 'strong'
  const reset = () => { setRestored(false);setStep('mic');setNoise(null);setElapsed(0);setHits([]);setSoft([]);setError('');setTimingReviewed(false);setLastResult(null);setup?.onFloor?.(null) }
  const profileKey = userId && setup?.selectedId && enabled && props.audioMode ? acousticProfileKey(userId,setup.selectedId,instrument,props.audioMode) : null
  const loadedKey = useRef<string | null>(null)
  const saveProfile = (profile: AcousticProfile) => {setSaved(false);setPendingProfile({...profile, deviceLabel:props.deviceLabel ?? undefined, timing: setup?.timingResult ? {latencyMs:setup.timingResult.latencyMs,iqrMs:setup.timingResult.iqrMs} : undefined})}
  useEffect(() => {
    if (!pendingProfile || !profileKey) return
    try {saveAcousticProfile(profileKey,pendingProfile);setSaved(true);setPendingProfile(null)}
    catch {setError(say('No se pudo guardar en este navegador. Revisa el almacenamiento local.','Could not save in this browser. Check local storage.'))}
  },[pendingProfile,profileKey])
  const wasListening = useRef(readyMic)
  useEffect(() => {
    if (wasListening.current && !readyMic && enabled && sampling) {
      setHits([]);setStep('instrument');setError(say('Prueba interrumpida. Activa el micrófono y repite la ronda.','Test interrupted. Enable the microphone and repeat the round.'))
    }
    wasListening.current = readyMic
  }, [readyMic,enabled,sampling])
  useEffect(() => {
    if (enabled && !sampling && step !== 'done') setup?.onFloor?.(null)
  }, [enabled,sampling,step])
  const previousDevice = useRef(setup?.selectedId)
  useEffect(() => {
    if (previousDevice.current !== setup?.selectedId) {
      previousDevice.current = setup?.selectedId
      if (enabled && step !== 'sound') reset()
    }
  }, [setup?.selectedId]) // A different input invalidates its acoustic measurements.
  useEffect(() => {
    if (props.forceFresh || !profileKey || profileKey === loadedKey.current || !readyMic || pendingProfile) return
    const changingProfile = loadedKey.current !== null
    loadedKey.current=profileKey
    setProfileChecked(profileKey)
    const profile=readAcousticProfile(profileKey)
    if (!profile) {if(changingProfile) reset();return}
    setup?.onFloor(profile.floor)
    setNoise(profile.noise);setSoundConfirmed(true);setTimingReviewed(true)
    setRhythmOnly(profile.mode==='rhythm-only');setSoft(profile.soft??[]);setMedium(profile.medium??[])
    setStep('done');setError('');setRestored(true);setSaved(true)
    props.onProfileRestored?.()
  },[profileKey,readyMic])
  useEffect(() => {
    if (!enabled || step !== 'noise') return
    if (!readyMic) { setStep('mic');setError(say('Activa el micrófono para medir.','Enable the microphone to measure.'));return }
    samples.current = [];setElapsed(0)
    const timer = setInterval(() => {
      samples.current.push(input.current)
      setElapsed(samples.current.length / 10)
      if (samples.current.length >= 80) {
        clearInterval(timer)
        const floor = noiseReference(samples.current)
        if (floor >= .1) {setError(say('Ruido alto: revisa la entrada o reduce el ruido y repite.','High noise: check the input or reduce noise and repeat.'));setStep('mic');return}
        setNoise(floor);setStep('timing');setError('')
      }
    },100)
    return () => clearInterval(timer)
  }, [step,enabled,readyMic])
  useEffect(() => {
    if (!enabled || !sampling || !readyMic || hits.length >= 3) return
    const incoming = (setup?.onsets ?? []).filter(hit => hit.timestamp > lastHit.current && Number.isFinite(hit.peak))
    if (!incoming.length) return
    const accepted: number[] = []
    for (const hit of incoming) {
      if (hit.timestamp - lastHit.current < 1) continue
      lastHit.current = hit.timestamp
      if ((hit.peak ?? 0) >= .999) {setError(say('Pico al límite digital. Baja la ganancia o aléjate y repite.','Digital limit reached. Lower input gain or move back and repeat.'));continue}
      if (noise != null && (hit.rms ?? 0) < Math.max(.0001, noise * 2) && (hit.peak ?? 0) < Math.max(.001, noise * 4)) {setError(say('Palmada demasiado cerca del ruido ambiente. Acércate un poco o reduce el ruido.','Clap too close to room noise. Move a little closer or reduce noise.'));continue}
      if (hits.length + accepted.length >= 3) break
      energies.current.push(hit.energy)
      // Compare like-for-like RMS levels, subtracting measured room power.
      const netRms = Math.sqrt(Math.max(1e-16, (hit.rms ?? 0) ** 2 - (noise ?? 0) ** 2))
      accepted.push(20 * Math.log10(netRms))
    }
    if (accepted.length) {setHits(old => [...old,...accepted].slice(0,3));setError('')}
  }, [setup?.onsets,enabled,sampling,readyMic,hits.length,noise,props.inputPeak,props.inputLevel])
  useEffect(() => {
    if (timingStarted && props.calibrating) setLastResult('running')
    if (timingStarted && lastResult === 'running' && !props.calibrating) {
      if (props.calibrationError) {setTimingStarted(false);setError(props.calibrationError)}
      else if (setup?.timingResult) {setTimingStarted(false);setTimingReviewed(true);setLastResult('done')}
    }
  }, [timingStarted,props.calibrating,props.calibrationError,setup?.timingResult,lastResult])
  useEffect(() => {
    if (enabled) document.querySelector(`[data-ready-panel="${['sound','input','timing','instrument'][guideColumn-1]}"]`)?.scrollIntoView?.({behavior:'smooth',block:'nearest',inline:'nearest'})
  },[guideColumn,enabled])
  useEffect(() => {
    if (!enabled || !sampling || !readyMic || hits.length >= 3) return
    const timer = setTimeout(() => setError(say('No se completaron tres golpes claros. Revisa la distancia y repite; no necesitas saturar el micrófono.','Three clear hits were not completed. Check your distance and retry; do not overload the microphone.')), 20000)
    return () => clearTimeout(timer)
  }, [enabled,sampling,readyMic,step,hits.length])
  const beginHits = (next: Step) => {
    energies.current = [];setup?.onFloor?.(null,true);setHits([]);setError('');lastHit.current = (setup?.onsets.at(-1)?.timestamp ?? -Infinity);setStep(next)
  }
  const median = (values: number[]) => [...values].sort((a,b) => a-b)[1] ?? 0
  const referenceLevel = step === 'medium' ? median(soft) : step === 'strong' ? median(medium) : null
  const ordered = [...hits].sort((a,b) => a-b)
  const difference = referenceLevel == null ? null : median(hits) - referenceLevel
  // Two +3 dB steps must fit below the -1 dBFS warning boundary.
  const lacksHeadroom = sampling && (step === 'soft' ? hits.length === 3 && median(hits) > -7 : step === 'medium' ? median(soft) > -7 || (hits.length === 3 && median(hits) > -4) : median(medium) > -4)
  const headroomMessage = say('La entrada no deja margen para separar suave, medio y fuerte. No es un fallo de ritmo. Continúa solo con ritmo, o baja la ganancia de entrada y vuelve a medir suaves.', 'The input leaves insufficient room for soft, medium and strong levels. This is not a rhythm error. Continue with rhythm only, or lower input gain and remeasure soft claps.')
  const roundError = !sampling || hits.length !== 3 ? ''
    : lacksHeadroom ? headroomMessage
    : Math.min(ordered[1] - ordered[0], ordered[2] - ordered[1]) > 6
      ? say('Las intensidades son muy diferentes. Repite o usa este nivel para ritmo.','These levels differ substantially. Retry or use this level for rhythm.')
      : difference != null && difference < 3
        ? say(`Diferencia medida: ${difference.toFixed(1)} dB. Se necesitan +3 dB sobre la ronda anterior. Repite esta ronda o vuelve a medir las suaves.`,`Measured difference: ${difference.toFixed(1)} dB. At least 3 dB above the previous round is required. Retry this round or remeasure soft claps.`)
        : ''
  const roundApproved = sampling && hits.length === 3 && !roundError && !error
  const confirmHits = () => {
    if (hits.length !== 3 || !readyMic) return
    if (roundError) {setError(roundError);return}
    if (step === 'soft') {softEnergies.current = [...energies.current];setSoft(hits);beginHits('medium')}
    else if (step === 'medium') {setMedium(hits);beginHits('strong')}
    else {
      const floor = clapDetectionFloor(softEnergies.current)
      if (floor == null) return
      setup?.onFloor?.(floor)
      // Persist only on this browser; raw microphone audio is never stored.
      saveProfile({version:3,noise:noise??0,floor,mode:'dynamics',soft,medium,strong:hits,at:new Date().toISOString()})
      setRhythmOnly(false);setError('');setStep('done')
    }
  }
  const useComfortableLevel = () => {
    const floor = clapDetectionFloor(energies.current)
    if (hits.length !== 3 || !readyMic || floor == null) return
    setup?.onFloor?.(floor)
    saveProfile({version:3,noise:noise??0,floor,mode:'rhythm-only',at:new Date().toISOString()})
    setRhythmOnly(true);setError('');setStep('done')
  }
  const startTiming = () => {
    if (noise == null) {setStep('mic');setOpen(true);return}
    setStep('timing');setOpen(true);setTimingStarted(true);setTimingReviewed(false);setError('');props.onCalibrate()
  }
  const soundChosen = () => {if(step === 'done') return;setSoundConfirmed(true);reset();setOpen(true)}
  const instrumentCard = enabled && props.audioMode ? <section data-ready-panel="instrument" data-check={step === 'done' ? 'done' : 'todo'} className="lx-rcard" aria-label={say('Instrumento','Instrument')}>
    <div className="lx-rart"><span role="img" aria-label={label} className="text-7xl drop-shadow-lg">{selected?.[3]}</span></div>
    <div className="lx-rbody">
      <b>{say('Instrumento','Instrument')}</b>
      <label className="space-y-2 text-sm"><span>{say('¿Qué vas a tocar?','What will you play?')}</span>
        <select aria-label={say('Seleccionar instrumento','Select instrument')} className="w-full rounded-lg border border-border bg-background px-3 py-2" value={instrument} onChange={event => {setInstrument(event.target.value);setStep('instrument');setHits([]);setSoft([]);setup?.onFloor?.(null);setOpen(true)}}>
          {ACOUSTIC_INSTRUMENTS.map(group => <optgroup key={group.group} label={group.group.split(' / ')[es ? 1 : 0]}>{group.items.map(item => <option key={item[0]} value={item[0]}>{item[es ? 1 : 2]}</option>)}</optgroup>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{instrument === 'claps' ? say('3 suaves · 3 medianas · 3 fuertes','3 soft · 3 medium · 3 strong') : say('Perfil disponible para seleccionar. La prueba experimental actual es solo de palmadas.','Available to select. The current experimental test is for claps only.')}</p>
      <Button variant="outline" size="icon" aria-label={say('Preparar instrumento','Prepare instrument')} onClick={() => {setStep('instrument');setOpen(true)}}><RotateCcw className="h-4 w-4" /></Button>
    </div>
    {step === 'done' && <span className="lx-ok"><Check className="h-4 w-4" /></span>}
  </section> : null
  const title = step === 'sound' ? say('Elige cómo vas a escuchar','Choose how you will listen') : step === 'mic' ? say('Selecciona tu micrófono','Select your microphone') : step === 'noise' ? say('Escuchando el ambiente','Listening to the room') : step === 'timing' ? say('Sigue el reloj del metrónomo','Follow the metronome clock') : step === 'instrument' ? say('Elige el instrumento','Choose your instrument') : step === 'done' ? say('Preparación completa','Setup complete') : say(`Da 3 palmadas ${step === 'soft' ? 'suaves' : step === 'medium' ? 'medianas' : 'fuertes'}`,`Clap 3 times: ${step === 'soft' ? 'soft' : step === 'medium' ? 'medium' : 'strong'}`)
  const guideError = error || roundError || (guideColumn === 2 ? props.micError : guideColumn === 3 ? props.calibrationError : null)
  const guideState = guideError ? 'error' : step === 'done' || (step === 'timing' && timingReviewed) || roundApproved ? 'done' : 'active'
  const guide = enabled ? <>
    {!open && <Button variant="outline" className="lx-guide-reopen" onClick={() => setOpen(true)}>{say('Abrir asistente','Open setup guide')}</Button>}
    {open && <aside aria-label={say('Asistente de preparación','Setup guide')} data-status={guideState} className="lx-setup-guide">
      <div className="lx-guide-heading"><span className="lx-guide-number">{Math.min(4,step === 'sound' ? 1 : ['mic','noise'].includes(step) ? 2 : step === 'timing' ? 3 : 4)} / 4</span><h3 className="flex-1 font-heading text-sm font-bold">{title}</h3><Button variant="ghost" size="icon" aria-label={say('Cerrar guía','Close guide')} onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <div className="lx-guide-content">
        {step === 'sound' && <><p>{say('Elige cómo escuchar y confirma.','Choose how to listen, then confirm.')}</p>{props.audioMode && <Button onClick={soundChosen}>{say('Confirmar Sound','Confirm Sound')}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</>}
        {step === 'mic' && <><p>{say('Elige el micrófono. Guarda silencio 8 s con el ruido ambiente habitual.','Choose your mic. Stay quiet for 8 s with your usual room noise.')}</p><Button disabled={!readyMic} onClick={() => {setError('');setStep('noise')}}>{say('Medir ambiente','Measure room noise')}</Button></>}
        {step === 'noise' && <><p>{say('No hables ni aplaudas todavía.','Do not speak or clap yet.')} {Math.max(0,Math.ceil(8-elapsed))} s</p><progress aria-label={say('Medición de ambiente','Room measurement')} className="h-2 w-full accent-primary" value={elapsed} max={8} /></>}
        {step === 'timing' && <><p>{say('Escucha 4 clics; después aplaude con cada pulso. Medimos desfase y variación, sin corregir tu ritmo.','Listen to 4 clicks, then clap on each beat. We measure offset and variation without correcting your rhythm.')}</p>{props.calibrating ? <p aria-live="polite">{props.calibrationVisual?.phase === 'count-in' ? `${say('Prepárate — escucha sin aplaudir','Get ready — listen without clapping')} · ${props.calibrationVisual.countInBeat || '…'} / 4` : `${say('Ahora aplaude con cada clic','Now clap with each click')} · ${props.calibrationBeat} / ${props.totalCalibrationBeats}`}</p> : <Button disabled={!readyMic} onClick={startTiming}>{say('Medir Timing','Measure Timing')}</Button>}{timingReviewed && setup?.timingResult && <><p>{say('Desfase observado','Observed offset')}: {Math.round(setup.timingResult.latencyMs)} ms · {say('Variación (IQR)','Variation (IQR)')}: {Math.round(setup.timingResult.iqrMs)} ms</p><Button onClick={() => setStep('instrument')}>{say('Continuar a Instrumento','Continue to Instrument')}</Button></>}</>}
        {step === 'instrument' && <><p>{label}. {say('Ahora probaremos golpes separados, sin seguir el metrónomo.','Now test separate sounds without following a metronome.')}</p><Button disabled={!readyMic || noise == null || !timingReviewed || instrument !== 'claps'} onClick={() => beginHits('soft')}>{say('Probar palmadas','Test claps')}</Button>{(noise == null || !timingReviewed) && <Button variant="outline" onClick={() => setStep(noise == null ? 'mic' : 'timing')}>{say('Completar pasos anteriores','Complete previous steps')}</Button>}{instrument !== 'claps' && <Button variant="outline" onClick={() => setInstrument('claps')}>{say('Usar palmadas por ahora','Use claps for now')}</Button>}</>}
        {sampling && <><p className="font-semibold">{say(step === 'soft' ? 'Suaves: bajitas, apenas sobre el ambiente.' : step === 'medium' ? 'Medianas: un poco más fuertes que las suaves.' : 'Fuertes: más intensas, sin saturar.',step === 'soft' ? 'Soft: quiet, just above room noise.' : step === 'medium' ? 'Medium: a little louder than soft.' : 'Strong: louder again, without clipping.')}</p><p>{say('Separa las palmadas al menos un segundo. Mantén la misma distancia al micrófono.','Leave at least one second between claps. Keep the same microphone distance.')}</p><p>{roundApproved ? say('Ronda aprobada. Confirma para continuar.','Round approved. Confirm to continue.') : say('Palmadas detectadas; pendientes de validar.','Claps detected; awaiting validation.')}</p>{referenceLevel != null && !lacksHeadroom && <p className="font-mono text-xs">{say('Referencia','Reference')}: {referenceLevel.toFixed(1)} dBFS · {say('Objetivo mínimo','Minimum target')}: {(referenceLevel + 3).toFixed(1)} dBFS</p>}<div className="flex gap-3" aria-label={`${hits.length} / 3`}>{[0,1,2].map(i => <span key={i} className={`grid h-8 w-8 place-items-center rounded-full border ${roundApproved ? 'border-green-500 bg-green-500/15 text-green-500' : i < hits.length ? (roundError ? 'border-red-500 text-red-500' : 'border-primary text-primary') : 'border-border'}`}>{roundApproved ? <Check className="h-5 w-5" /> : i+1}</span>)}</div><p className="font-mono text-xs">{hits.map(value => `${value.toFixed(1)} dBFS`).join(' · ')} {say('(RMS, ambiente descontado)','(RMS, room noise removed)')}</p><div className="flex gap-2"><Button variant="outline" size="icon" aria-label={say('Repetir tres palmadas','Repeat three claps')} onClick={() => beginHits(step)}><RotateCcw className="h-4 w-4" /></Button><Button disabled={hits.length !== 3 || !readyMic} onClick={lacksHeadroom ? useComfortableLevel : confirmHits}>{lacksHeadroom ? say('Continuar solo con ritmo','Continue with rhythm only') : say('Confirmar','Confirm')}</Button></div>{step !== 'soft' && <Button variant="outline" onClick={() => {setSoft([]);setMedium([]);softEnergies.current=[];beginHits('soft')}}>{say('Volver a medir suaves','Remeasure soft claps')}</Button>}{hits.length === 3 && <><Button variant="outline" disabled={!readyMic} onClick={useComfortableLevel}>{say('Usar este nivel para ritmo','Use this level for rhythm')}</Button><p>{say('Continúa sin calibrar suave/medio/fuerte. Se evaluará el ritmo.', 'Continue without soft/medium/strong calibration. Rhythm will be evaluated.')}</p>{(props.inputPeak ?? 0) > .708 && <p>{say('Estás cerca del límite digital. Para probar intensidades, baja la ganancia del micrófono o aléjate un poco.', 'You are near the digital limit. To test dynamics, lower microphone gain or move back a little.')}</p>}</>}</>}
        {step === 'done' && <><p role="status">{saved ? say('Calibración guardada en este navegador.','Calibration saved in this browser.') : say('Calibración activa, pendiente de guardar con tu sesión de usuario.','Calibration active, waiting to save with your user session.')}</p>{restored && <p>{say('Calibración guardada recuperada para este usuario, micrófono e instrumento. Si cambiaste ganancia o de lugar, vuelve a calibrar.','Saved calibration restored for this user, microphone and instrument. Recalibrate if gain or room changed.')}</p>}<Button variant="outline" onClick={()=>{reset();setSoundConfirmed(false);setStep('sound')}}>{say('Volver a calibrar','Recalibrate')}</Button><p>{rhythmOnly ? say('Nivel cómodo preparado. Evaluaremos el ritmo; las intensidades quedan sin calibrar.','Comfortable level ready. Rhythm will be evaluated; dynamics remain uncalibrated.') : say('Perfil de palmadas medido. La evaluación del ritmo empieza en el ejercicio.','Clap profile measured. Rhythm grading starts in the exercise.')}</p><Button disabled={!readyMic || !saved} onClick={props.onStart}>{props.completionLabel ?? say('Empezar ejercicio','Start exercise')}<ArrowRight className="ml-2 h-4 w-4" /></Button></>}
        {!readyMic && step !== 'sound' && <Button variant="outline" onClick={() => { if (setup?.muted) setup.onMute(); else props.onTestMic() }}>{say('Activar micrófono','Enable microphone')}</Button>}
        {!readyMic && step !== 'sound' && <p className="flex items-center gap-2 text-amber-500"><MicOff className="h-4 w-4" />{setup?.muted ? say('Micrófono silenciado. Actívalo para continuar.','Microphone muted. Enable it to continue.') : say('Esperando una entrada de micrófono activa.','Waiting for an active microphone input.')}</p>}
        {guideError && <p role="alert" className="text-red-500">{guideError}</p>}
        {step !== 'sound' && step !== 'noise' && !props.calibrating && <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" onClick={() => {const previous = ORDER[Math.max(0,ORDER.indexOf(step)-1)]; if (['soft','medium','strong'].includes(previous)) beginHits(previous); else {setStep(previous);setHits([]);setError('')}}}><ArrowLeft className="h-3 w-3" />{say('Atrás','Back')}</button>}
      </div>
    </aside>}
  </> : null
  const guideSlots = enabled ? [soundConfirmed,noise != null,timingReviewed,step === 'done'].map((done,index) => <div key={index} className="lx-guide-slot" data-guide-column={index+1} style={{gridColumn:index+1,gridRow:2}}>
    {guideColumn === index+1 ? guide : done ? <div className="lx-guide-confirmed" role="status"><Check className="h-3.5 w-3.5" />{say('Confirmado','Confirmed')}</div> : null}
  </div>) : null
  const restoring = !!props.onProfileRestored && !props.forceFresh && enabled && !props.micError && !setup?.muted && (
    !authResolved || (!!userId && !!props.audioMode && (!readyMic || (!!profileKey && profileChecked !== profileKey)))
  )
  return { restoring, guide:guideSlots,instrumentCard,soundChosen,startTiming,noiseMeasured: noise != null,timingReviewed,canStart: !enabled || (step === 'done' && saved), reset, step, enabled }
}
