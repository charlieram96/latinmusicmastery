'use client'

// Ready check (L2): the input choice, the mic test and the latency
// calibration in one full-width screen of three panels. Each panel fills in
// by itself and pops a green check; any of them can be changed. The logic and
// storage are the exercise session's (audio mode, useCalibration); this is
// only the presentation. Start playing lives in the action bar.

import { useMicSetupWizard, type MicSetup } from './mic-setup-wizard'
import { MicrophoneLevelMeter } from './microphone-level-meter'
import { useState, type ReactNode } from 'react'
import { LoopbackLatency } from '@/components/settings/loopback-latency'
import { TimingStage } from '@/components/settings/timing-stage'
import { MicOff, RotateCcw, Play, Bluetooth, Check, Headphones, Loader2, Mic, Piano, Speaker, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { availableInputModes, type AudioMode } from '@/lib/play-sense/input-modes'
import { readyChecks, type CheckState } from '@/lib/play-sense/ready-check'
import type { Instrument } from '@/lib/play-sense/types'
import { ActionMessage, LessonAction } from './lesson-mode/lesson-frame'
import './lesson-mode/lesson-mode.css'

export interface ReadyCheckProps {
  completionLabel?: string
  onCancelSetup?: () => void
  forceFresh?: boolean
  onProfileRestored?: () => void
  getTimingElapsed?: () => number
  timingHits?: Array<{ elapsed: number; offsetMs: number; beat: number }>
  onCancelCalibration?: () => void
  micSetup?: MicSetup
  instrument: Instrument
  audioMode: AudioMode | null
  onMode: (mode: AudioMode) => void
  /** 0–1 input level from the mic test. */
  inputLevel: number
  inputPeak?: number
  micOpen: boolean
  micHeard: boolean
  deviceLabel: string | null
  /** Why the mic could not open (permission denied, no device), if it failed. */
  micError?: string | null
  onTestMic: () => void
  calibrating: boolean
  calibrationBeat: number
  calibrationVisual?: { phase: 'count-in' | 'measuring'; countInBeat: number; beat: number; pulse: number } | null
  totalCalibrationBeats: number
  calibrationError: string | null
  latencyMs: number | null
  onCalibrate: () => void
  bleConnected: boolean
  bleConnecting?: boolean
  bleError?: boolean
  onConnectBle: () => void
  /** Static staff preview of the exercise. */
  preview: ReactNode
  meta: string
  onStart: () => void
}

const MODE_ICON: Record<AudioMode, typeof Headphones> = { headphones: Headphones, 'speaker-safe': Speaker, midi: Piano, playsense: Bluetooth }
const BASE = 'dashboard.classViewer.lessonMode.ready'

function Panel({ id, state, art, title, children }: { id: string; state: CheckState; art: ReactNode; title: string; children: ReactNode }) {
  const { t } = useTranslation()
  return <section data-ready-panel={id} data-check={state} className="lx-rcard" aria-labelledby={`lx-ready-${id}`}>
    <div className="lx-rart">{art}</div>
    <div className="lx-rbody">
      <b id={`lx-ready-${id}`}>{title}</b>
      {children}
    </div>
    {(state === 'done' || state === 'skipped') && <span className="lx-ok" role="img" aria-label={t(`${BASE}.done`)}><Check className="h-4 w-4" strokeWidth={3} /></span>}
    {state === 'running' && id !== 'input' && <span className="lx-ok lx-ok-running" aria-hidden><Loader2 className="h-4 w-4 motion-safe:animate-spin" /></span>}
  </section>
}

export function ReadyCheck(props: ReadyCheckProps) {
  const { t, locale } = useTranslation()
  const { instrument, audioMode, onMode, inputLevel, inputPeak = 0, micOpen, micHeard, deviceLabel, micError = null, onTestMic, calibrating, calibrationBeat,
    totalCalibrationBeats, calibrationError: rawCalibrationError, latencyMs, onCalibrate, bleConnected, bleConnecting, bleError, onConnectBle, preview, meta, onStart } = props
  const calibrationError = rawCalibrationError === 'timing-insufficient' ? (locale==='es'?'Detectamos menos de 12 palmadas asociadas a los 16 pulsos. Revisa el micrófono y repite siguiendo el clic.':'Fewer than 12 claps matched the 16 pulses. Check the microphone and repeat following the click.') : rawCalibrationError === 'timing-inconsistent' ? (locale==='es'?'La variación entre palmadas es demasiado grande para validar esta prueba. Repite con un pulso más regular; no compensaremos esa irregularidad.':'Clap timing varies too much to validate this check. Repeat with a steadier pulse; this variation will not be compensated.') : rawCalibrationError
  const [loopbackOpen,setLoopbackOpen] = useState(false)
  const [timingOpen,setTimingOpen] = useState(false)
  const [timingConfirmed,setTimingConfirmed] = useState(false)
  const wizard = useMicSetupWizard({...props, calibrationError, micSetup: props.micSetup ? {...props.micSetup,timingResult: !props.getTimingElapsed || timingConfirmed ? props.micSetup.timingResult : null} : undefined, onCalibrate: () => {
    if (props.getTimingElapsed && (audioMode === 'headphones' || audioMode === 'speaker-safe')) {setTimingConfirmed(false);setTimingOpen(true)}
    else props.onCalibrate()
  }})
  const checks = readyChecks({ audioMode, micOpen, micHeard: wizard.enabled ? micOpen && wizard.noiseMeasured : micHeard, calibrated: wizard.enabled ? wizard.timingReviewed : latencyMs != null, calibrating, bleConnected })
  const modes = availableInputModes(instrument)
  const micMode = audioMode === 'headphones' || audioMode === 'speaker-safe'
  const device = deviceLabel || t(`${BASE}.defaultMic`)
  const InputIcon = audioMode === 'midi' ? Piano : audioMode === 'playsense' ? Bluetooth : Mic
  const summary = [
    audioMode ? t(`${BASE}.modes.${audioMode}`) : null,
    micMode && micOpen && micHeard ? t(`${BASE}.microphone`) + ' ✓' : null,
    latencyMs != null && audioMode !== 'midi' && (!wizard.enabled || wizard.timingReviewed) ? `${Math.round(latencyMs)} ms` : null,
  ].filter(Boolean).join(' · ')
  const allSet = checks.sound === 'done' && checks.input === 'done' && (checks.timing === 'done' || checks.timing === 'skipped')

  if (wizard.restoring) return <div role="status" className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
    <Loader2 aria-hidden className="h-7 w-7 animate-spin text-primary" />
    <p className="text-lg font-semibold">{locale === 'es' ? 'Preparando tu turno…' : 'Preparing your turn…'}</p>
  </div>

  return <div data-ready-check className="lx-ready">
    {loopbackOpen && <LoopbackLatency getLiveAudioInput={props.micSetup?.getLiveAudioInput} deviceLabel={device} onClose={()=>setLoopbackOpen(false)} />}
    {timingOpen && <TimingStage onClose={confirmed=>{setTimingConfirmed(!!confirmed);setTimingOpen(false)}} setup={{...props,calibrationError}} />}
    <div className="lx-rhead">
      {props.onCancelSetup && <Button type="button" variant="outline" className="mb-3" onClick={props.onCancelSetup}>{locale==='es'?'Cancelar y conservar calibración anterior':'Cancel and keep previous calibration'}</Button>}
      <span className="lx-eyebrow">{t(`${BASE}.eyebrow`)}</span>
      <h2 className="lx-screen-h2">{t(`${BASE}.title`)}</h2>
      <p className="text-muted-foreground">{wizard.enabled ? (locale === 'es' ? 'Sigue el asistente: sonido, micrófono, tiempo e instrumento.' : 'Follow the guide: sound, microphone, timing and instrument.') : t(`${BASE}.intro`)}</p>
    </div>

    <div className={cn("lx-rgrid", wizard.enabled && "lx-rgrid-acoustic")}>
      <Panel id="sound" state={checks.sound} title={t(`${BASE}.sound`)}
        art={audioMode ? (() => { const Icon = MODE_ICON[audioMode]; return <Icon className="h-16 w-16" strokeWidth={1.5} /> })() : <Headphones className="h-16 w-16" strokeWidth={1.5} />}>
        <p className="text-sm text-muted-foreground">{t(`${BASE}.soundHint`)}</p>
        <div role="radiogroup" aria-label={t(`${BASE}.sound`)} className="lx-seg">
          {modes.map(mode => {
            const Icon = MODE_ICON[mode]
            return <button key={mode} type="button" role="radio" aria-checked={audioMode === mode} onClick={() => { onMode(mode); if (mode === 'headphones' || mode === 'speaker-safe') wizard.soundChosen() }}>
              <Icon aria-hidden className="h-3.5 w-3.5" />{t(`${BASE}.modes.${mode}`)}
            </button>
          })}
        </div>
      </Panel>

      <Panel id="input" state={checks.input}
        title={audioMode === 'midi' ? t(`${BASE}.midi`) : audioMode === 'playsense' ? t(`${BASE}.playsense`) : t(`${BASE}.microphone`)}
        art={micMode ? <MicrophoneLevelMeter rms={inputLevel} peak={inputPeak} active={micOpen} />
          : <InputIcon className="h-16 w-16" strokeWidth={1.5} />}>
        {!audioMode ? <p className="text-sm text-muted-foreground">{t(`${BASE}.pickFirst`)}</p>
          : audioMode === 'midi' ? <p className="text-sm text-muted-foreground">{t(`${BASE}.midiHint`)}</p>
            : audioMode === 'playsense' ? <>
              <p className="text-sm text-muted-foreground">{bleConnected ? t(`${BASE}.playsenseConnected`) : bleError ? t(`${BASE}.playsenseFailed`) : ''}</p>
              {!bleConnected && <Button type="button" variant="outline" size="sm" className="w-fit" disabled={bleConnecting} onClick={onConnectBle}>
                <Bluetooth className="h-3.5 w-3.5" />{bleConnecting ? t(`${BASE}.playsenseConnecting`) : t(`${BASE}.playsenseConnect`)}
              </Button>}
            </>
              : <>
                {props.micSetup && <div className="space-y-2">
                  <label className="block space-y-1 text-xs"><span>{locale === 'es' ? 'Entrada de audio' : 'Audio input'}</span>
                    <select aria-label={locale === 'es' ? 'Seleccionar micrófono' : 'Select microphone'} value={props.micSetup.selectedId}
                      disabled={calibrating} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                      onChange={event => { wizard.reset(); void props.micSetup?.onSelect(event.target.value) }}>
                      <option value="">{locale === 'es' ? 'Predeterminado del sistema' : 'System default'}</option>
                      {props.micSetup.devices.map((device,index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microphone ${index+1}`}</option>)}
                    </select>
                  </label>
                  <Button type="button" variant="outline" size="icon" aria-pressed={props.micSetup.muted}
                    aria-label={(!micOpen || props.micSetup.muted) ? (locale === 'es' ? 'Activar micrófono' : 'Enable microphone') : (locale === 'es' ? 'Silenciar micrófono' : 'Mute microphone')}
                    title={(!micOpen || props.micSetup.muted) ? (locale === 'es' ? 'Activar micrófono' : 'Enable microphone') : (locale === 'es' ? 'Silenciar micrófono' : 'Mute microphone')}
                    onClick={() => { if (!micOpen && !props.micSetup?.muted) onTestMic(); else props.micSetup?.onMute() }}>{props.micSetup.muted ? <MicOff className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4" />}</Button>
                </div>}
                {micError && !micOpen
                  ? <p role="alert" className="text-sm text-danger">{micError}</p>
                  : <p className="text-sm text-muted-foreground" aria-live="polite">
                    {props.micSetup?.muted ? (locale === 'es' ? 'Micrófono silenciado' : 'Microphone muted') : micOpen && micHeard ? t(`${BASE}.heard`, { device }) : micOpen ? t(`${BASE}.listening`, { device }) : t(`${BASE}.waiting`)}
                  </p>}
                {micOpen && <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-primary" onClick={onTestMic}
                  aria-label={locale === 'es' ? 'Repetir prueba de micrófono' : 'Repeat microphone test'} title={locale === 'es' ? 'Repetir prueba de micrófono' : 'Repeat microphone test'}>
                  <RotateCcw aria-hidden className="h-4 w-4" />
                </Button>}
                {!micOpen && !props.micSetup?.muted && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onTestMic}><Mic className="h-3.5 w-3.5" />{t(`${BASE}.testMic`)}</Button>}
              </>}
      </Panel>

      <Panel id="timing" state={checks.timing} title={t(`${BASE}.timing`)}
        art={micMode && props.getTimingElapsed ? <button type="button" onClick={wizard.startTiming} disabled={!micOpen} aria-label={locale==='es'?'Comprobar sincronización 3D':'Check 3D timing'} className="w-full h-full flex items-center justify-center text-primary"><svg viewBox="0 0 240 110" className="h-28 w-60" aria-hidden><path d="M95 8 30 100h180L145 8Z" fill="currentColor" opacity=".1"/><path d="M95 8 30 100M145 8l65 92M50 76h140" stroke="currentColor" strokeWidth="3"/><circle cx="120" cy="76" r="9" fill="currentColor"/><circle cx="120" cy="42" r="6" fill="currentColor" opacity=".6"/><circle cx="120" cy="18" r="3" fill="currentColor" opacity=".3"/></svg></button> : <span className="lx-clicks" data-live={calibrating && !micMode} data-clock={micMode ? 'audio' : undefined}>{Array.from({ length: 4 }, (_, i) =>
          <i key={i} data-active={calibrating && micMode && props.calibrationVisual?.pulse === i + 1} style={micMode ? undefined : { animationDelay: `${i * 0.4}s` }} />)}</span>}>
        {audioMode === 'midi' ? <p className="text-sm text-muted-foreground">{t(`${BASE}.timingSkipped`)}</p>
          : calibrating ? <>
            <p className="text-sm text-muted-foreground" aria-live="polite">{props.calibrationVisual?.phase === 'count-in'
              ? `${locale === 'es' ? 'Prepárate — escucha sin aplaudir' : 'Get ready — listen without clapping'} · ${props.calibrationVisual.countInBeat || '…'} / 4`
              : t(`${BASE}.measuring`, { beat: calibrationBeat, total: totalCalibrationBeats })}</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={totalCalibrationBeats} aria-valuenow={calibrationBeat} className="lx-calib">
              <i style={{ width: `${totalCalibrationBeats ? (calibrationBeat / totalCalibrationBeats) * 100 : 0}%` }} />
            </div>
          </> : <>
            <p className="text-sm text-muted-foreground">
              {calibrationError ?? (latencyMs != null && (!wizard.enabled || wizard.timingReviewed) ? (micMode ? `${locale === 'es' ? 'Desfase observado' : 'Observed offset'}: ${Math.round(latencyMs)} ms` : t(`${BASE}.latency`, { ms: Math.round(latencyMs) })) : t(`${BASE}.timingHint`))}
            </p>
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={!audioMode || (micMode && (!micOpen || props.micSetup?.muted))} onClick={wizard.enabled ? wizard.startTiming : onCalibrate}>
              <Timer className="h-3.5 w-3.5" />{latencyMs != null ? t(`${BASE}.measureAgain`) : t(`${BASE}.measure`)}
            </Button>
          </>}
        {micMode && props.micSetup && <Button type="button" variant="outline" size="sm" className="w-fit" disabled={calibrating || !micOpen || props.micSetup.muted} onClick={()=>setLoopbackOpen(true)}>
          <Timer className="h-3.5 w-3.5" />{locale==='es'?'Prueba automática de sincronización':'Automatic synchronization test'}
        </Button>}
      </Panel>
      {wizard.instrumentCard}
      {wizard.guide}
    </div>

    {preview && <div className="lx-preview">
      <div className="lx-pv-h"><span className="lx-eyebrow">{t(`${BASE}.preview`)}</span><span className="text-xs text-muted-foreground">{meta}</span></div>
      <div className="lx-pv-staff">{preview}</div>
    </div>}

    <LessonAction>
      <ActionMessage live icon={checks.canStart ? <Check className={cn('h-5 w-5', allSet && 'text-success')} strokeWidth={3} /> : <Headphones className="h-5 w-5" />}
        title={calibrating ? t(`${BASE}.measuringTitle`) : allSet ? t(`${BASE}.allSet`) : checks.canStart ? t(`${BASE}.readyWhenYouAre`) : t(`${BASE}.pickMode`)} detail={summary || undefined} />
      <Button type="button" variant="chunky-success" data-primary="" data-ready-start disabled={!checks.canStart || !wizard.canStart || (micMode && !!props.micSetup?.muted)} aria-label={props.completionLabel ?? t(`${BASE}.start`)} title={props.completionLabel ?? t(`${BASE}.start`)} onClick={onStart}>
        {props.completionLabel ? <><Check aria-hidden className="h-5 w-5" />{props.completionLabel}</> : <Play aria-hidden className="h-5 w-5" fill="currentColor" />}
      </Button>
    </LessonAction>
  </div>
}
