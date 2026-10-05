'use client'
import { useEffect, useState } from 'react'
import { Settings2, RotateCcw, Check } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReadyCheck } from '@/components/class-viewer/lesson-viewer/ready-check'
import { PlaysenseTestPanel } from '@/components/play-sense/playsense-test-panel'
import { useExerciseSession } from '@/hooks/use-exercise-session'
import { usePlaysense } from '@/contexts/playsense-context'
import { TIMING_EXERCISE } from './timing-stage'
import { ACOUSTIC_INSTRUMENTS } from '@/lib/audio/mic-setup'
import type { AcousticProfile } from '@/lib/audio/acoustic-profile'
import type { Instrument } from '@/lib/play-sense/types'

function CalibrationSetup({ onDone }: { onDone: () => void }) {
  const session = useExerciseSession()
  const playsense = usePlaysense()
  const { locale } = useTranslation()
  const [sensorTest,setSensorTest] = useState(false)
  const [instrument,setInstrument] = useState<Instrument>('timbale')
  useEffect(()=>{session.selectExercise({...TIMING_EXERCISE,instrument})},[instrument]) // Calibration only: never starts or saves an exercise attempt.
  useEffect(()=>{
    if ((session.audioMode==='headphones'||session.audioMode==='speaker-safe') && !session.isListening && !session.micMuted && !session.audioError) void session.testMic()
  },[session.audioMode,session.isListening,session.micMuted,session.audioError])
  if(sensorTest) return <PlaysenseTestPanel instrument={instrument} onBack={()=>setSensorTest(false)} onReady={onDone} />
  return <>
    {session.audioMode==='playsense' && <label className="mb-4 flex items-center gap-2 text-sm">{locale==='es'?'Instrumento de sensores':'Sensor instrument'}<select className="rounded-lg border bg-background p-2" value={instrument} onChange={event=>setInstrument(event.target.value as Instrument)}><option value="timbale">Timbales</option><option value="conga">Congas</option><option value="bongo">Bongó</option></select></label>}
    <ReadyCheck forceFresh instrument={instrument} audioMode={session.audioMode} onMode={session.setAudioMode}
      inputLevel={session.inputLevel} inputPeak={session.inputPeak} micOpen={session.isListening} micHeard={session.inputLevel>0.001}
      deviceLabel={session.micDeviceLabel} micError={session.audioError} onTestMic={session.testMic}
      micSetup={{getLiveAudioInput:session.getLiveAudioInput,devices:session.micDevices,selectedId:session.micDeviceId,muted:session.micMuted,onSelect:session.selectMicDevice,onMute:session.toggleMicMute,onsets:session.micOnsets,onFloor:session.setMicDetectionFloor,timingResult:session.calibrationData}}
      calibrating={session.isCalibrating} calibrationBeat={session.calibrationBeat} calibrationVisual={session.calibrationVisual}
      getTimingElapsed={session.getTimingElapsed} timingHits={session.timingHits} onCancelCalibration={session.cancelCalibration}
      totalCalibrationBeats={session.totalCalibrationBeats} calibrationError={session.calibrationError} latencyMs={session.calibrationData?.latencyMs??null} onCalibrate={session.startCalibration}
      bleConnected={playsense.connectionStatus==='connected'} onConnectBle={()=>void playsense.connect()}
      preview={null} meta="" completionLabel={locale==='es'?'Guardar y cerrar':'Save and close'}
      onStart={()=>{session.stopTestMic();if(session.audioMode==='playsense')setSensorTest(true);else onDone()}} />
  </>
}

export function AudioCalibration({userId}:{userId:string}) {
  const { locale } = useTranslation()
  const es=locale==='es'
  const [open,setOpen]=useState(false)
  const [history,setHistory]=useState<Array<{key:string;profile:AcousticProfile}>>([])
  const [finished,setFinished]=useState(false)
  useEffect(()=>{
    if(open) return
    const rows:Array<{key:string;profile:AcousticProfile}>=[]
    try {
      const prefix=`lmm.acoustic.v3.${encodeURIComponent(userId)}.`
      for(let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i)!
        if(!key.startsWith(prefix)||key.endsWith('.history'))continue
        const latest=JSON.parse(localStorage.getItem(key)||'null')
        const past=JSON.parse(localStorage.getItem(`${key}.history`)||'[]')
        const entries=Array.isArray(past)&&past.length?past:[latest]
        for(const profile of entries) if(profile?.version===3)rows.push({key,profile})
      }
    } catch { /* An unavailable local history must not block setup. */ }
    setHistory(rows.sort((a,b)=>b.profile.at.localeCompare(a.profile.at)))
  },[open,userId])
  return <Card className="mb-6" id="audio-calibration">
    <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" />{es?'Audio y calibración':'Audio and calibration'}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{es?'Sonido, micrófono, ambiente, Timing 3D e instrumento. También puedes acceder a la configuración existente de sensores PlaySense. Los perfiles y su historial se guardan para tu usuario en este navegador.':'Sound, microphone, room noise, 3D Timing and instrument. You can also access the existing PlaySense sensor setup. Profiles and their history are stored for your user in this browser.'}</p>
      {open ? <><Button variant="outline" onClick={()=>setOpen(false)}>{es?'Cancelar y conservar calibración anterior':'Cancel and keep previous calibration'}</Button><CalibrationSetup onDone={()=>{setOpen(false);setFinished(true)}} /></> : <>
        <Button onClick={()=>{setFinished(false);setOpen(true)}}><RotateCcw className="h-4 w-4" />{es?'Recalibrar desde el principio':'Recalibrate from the beginning'}</Button>
        {finished && <p className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />{es?'Preparación completada':'Setup completed'}</p>}
        <details><summary className="cursor-pointer text-sm font-medium">{es?'Historial de calibración':'Calibration history'} ({history.length})</summary><ul className="mt-3 max-h-60 space-y-2 overflow-y-auto text-sm">{history.map(({key,profile},i)=><li key={`${key}-${i}`} className="rounded-lg border p-3"><time>{new Date(profile.at).toLocaleString(locale)}</time><span className="ml-2">{ACOUSTIC_INSTRUMENTS.flatMap(group=>[...group.items]).find(item=>item[0]===key.split('.').at(-2))?.[es?1:2] ?? key.split('.').at(-2)} · {key.endsWith('.headphones')?(es?'Audífonos':'Headphones'):(es?'Altavoces':'Speakers')} · {profile.deviceLabel ?? (es?'Micrófono guardado':'Saved microphone')} · {profile.mode==='rhythm-only'?(es?'Solo ritmo':'Rhythm only'):(es?'Dinámica y ritmo':'Dynamics and rhythm')}</span></li>)}</ul></details>
      </>}
    </CardContent>
  </Card>
}
