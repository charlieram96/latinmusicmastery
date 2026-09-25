'use client'

// Ready check (L2): the input choice, the mic test and the latency
// calibration in one full-width screen of three panels. Each panel fills in
// by itself and pops a green check; any of them can be changed. The logic and
// storage are the exercise session's (audio mode, useCalibration); this is
// only the presentation. Start playing lives in the action bar.

import type { ReactNode } from 'react'
import { Bluetooth, Check, Headphones, Loader2, Mic, Piano, Speaker, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import { availableInputModes, type AudioMode } from '@/lib/play-sense/input-modes'
import { readyChecks, type CheckState } from '@/lib/play-sense/ready-check'
import type { Instrument } from '@/lib/play-sense/types'
import { ActionMessage, LessonAction } from './lesson-mode/lesson-frame'
import './lesson-mode/lesson-mode.css'

export interface ReadyCheckProps {
  instrument: Instrument
  audioMode: AudioMode | null
  onMode: (mode: AudioMode) => void
  /** 0–1 input level from the mic test. */
  inputLevel: number
  micOpen: boolean
  micHeard: boolean
  deviceLabel: string | null
  onTestMic: () => void
  calibrating: boolean
  calibrationBeat: number
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
    <div className="lx-rart" aria-hidden>{art}</div>
    <div className="lx-rbody">
      <b id={`lx-ready-${id}`}>{title}</b>
      {children}
    </div>
    {(state === 'done' || state === 'skipped') && <span className="lx-ok" role="img" aria-label={t(`${BASE}.done`)}><Check className="h-4 w-4" strokeWidth={3} /></span>}
    {state === 'running' && <span className="lx-ok lx-ok-running" aria-hidden><Loader2 className="h-4 w-4 motion-safe:animate-spin" /></span>}
  </section>
}

export function ReadyCheck(props: ReadyCheckProps) {
  const { t } = useTranslation()
  const { instrument, audioMode, onMode, inputLevel, micOpen, micHeard, deviceLabel, onTestMic, calibrating, calibrationBeat,
    totalCalibrationBeats, calibrationError, latencyMs, onCalibrate, bleConnected, bleConnecting, bleError, onConnectBle, preview, meta, onStart } = props
  const checks = readyChecks({ audioMode, micOpen, micHeard, calibrated: latencyMs != null, calibrating, bleConnected })
  const modes = availableInputModes(instrument)
  const micMode = audioMode === 'headphones' || audioMode === 'speaker-safe'
  const device = deviceLabel || t(`${BASE}.defaultMic`)
  const InputIcon = audioMode === 'midi' ? Piano : audioMode === 'playsense' ? Bluetooth : Mic
  const summary = [
    audioMode ? t(`${BASE}.modes.${audioMode}`) : null,
    micMode && micHeard ? t(`${BASE}.microphone`) + ' ✓' : null,
    latencyMs != null && audioMode !== 'midi' ? `${Math.round(latencyMs)} ms` : null,
  ].filter(Boolean).join(' · ')
  const allSet = checks.sound === 'done' && checks.input === 'done' && (checks.timing === 'done' || checks.timing === 'skipped')

  return <div data-ready-check className="lx-ready">
    <div className="lx-rhead">
      <span className="lx-eyebrow">{t(`${BASE}.eyebrow`)}</span>
      <h2 className="lx-screen-h2">{t(`${BASE}.title`)}</h2>
      <p className="text-muted-foreground">{t(`${BASE}.intro`)}</p>
    </div>

    <div className="lx-rgrid">
      <Panel id="sound" state={checks.sound} title={t(`${BASE}.sound`)}
        art={audioMode ? (() => { const Icon = MODE_ICON[audioMode]; return <Icon className="h-16 w-16" strokeWidth={1.5} /> })() : <Headphones className="h-16 w-16" strokeWidth={1.5} />}>
        <p className="text-sm text-muted-foreground">{t(`${BASE}.soundHint`)}</p>
        <div role="radiogroup" aria-label={t(`${BASE}.sound`)} className="lx-seg">
          {modes.map(mode => {
            const Icon = MODE_ICON[mode]
            return <button key={mode} type="button" role="radio" aria-checked={audioMode === mode} onClick={() => onMode(mode)}>
              <Icon aria-hidden className="h-3.5 w-3.5" />{t(`${BASE}.modes.${mode}`)}
            </button>
          })}
        </div>
      </Panel>

      <Panel id="input" state={checks.input}
        title={audioMode === 'midi' ? t(`${BASE}.midi`) : audioMode === 'playsense' ? t(`${BASE}.playsense`) : t(`${BASE}.microphone`)}
        art={micMode ? <span className="lx-meter" data-live={micOpen}>{Array.from({ length: 9 }, (_, i) =>
          <i key={i} style={{ transform: `scaleY(${Math.max(0.12, Math.min(1, inputLevel * 3 * (0.55 + ((i * 37) % 9) / 18)))})` }} />)}</span>
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
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {micHeard ? t(`${BASE}.heard`, { device }) : micOpen ? t(`${BASE}.listening`, { device }) : t(`${BASE}.waiting`)}
                </p>
                {!micOpen && <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onTestMic}><Mic className="h-3.5 w-3.5" />{t(`${BASE}.testMic`)}</Button>}
              </>}
      </Panel>

      <Panel id="timing" state={checks.timing} title={t(`${BASE}.timing`)}
        art={<span className="lx-clicks" data-live={calibrating}>{Array.from({ length: 4 }, (_, i) =>
          <i key={i} style={{ animationDelay: `${i * 0.4}s` }} />)}</span>}>
        {audioMode === 'midi' ? <p className="text-sm text-muted-foreground">{t(`${BASE}.timingSkipped`)}</p>
          : calibrating ? <>
            <p className="text-sm text-muted-foreground" aria-live="polite">{t(`${BASE}.measuring`, { beat: calibrationBeat, total: totalCalibrationBeats })}</p>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={totalCalibrationBeats} aria-valuenow={calibrationBeat} className="lx-calib">
              <i style={{ width: `${totalCalibrationBeats ? (calibrationBeat / totalCalibrationBeats) * 100 : 0}%` }} />
            </div>
          </> : <>
            <p className="text-sm text-muted-foreground">
              {calibrationError ?? (latencyMs != null ? t(`${BASE}.latency`, { ms: Math.round(latencyMs) }) : t(`${BASE}.timingHint`))}
            </p>
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={!audioMode} onClick={onCalibrate}>
              <Timer className="h-3.5 w-3.5" />{latencyMs != null ? t(`${BASE}.measureAgain`) : t(`${BASE}.measure`)}
            </Button>
          </>}
      </Panel>
    </div>

    <div className="lx-preview">
      <div className="lx-pv-h"><span className="lx-eyebrow">{t(`${BASE}.preview`)}</span><span className="text-xs text-muted-foreground">{meta}</span></div>
      <div className="lx-pv-staff">{preview}</div>
    </div>

    <LessonAction>
      <ActionMessage live icon={checks.canStart ? <Check className={cn('h-5 w-5', allSet && 'text-success')} strokeWidth={3} /> : <Headphones className="h-5 w-5" />}
        title={allSet ? t(`${BASE}.allSet`) : checks.canStart ? t(`${BASE}.readyWhenYouAre`) : t(`${BASE}.pickMode`)} detail={summary || undefined} />
      <Button type="button" variant="chunky-success" data-primary="" data-ready-start disabled={!checks.canStart} onClick={onStart}>
        {t(`${BASE}.start`)}
      </Button>
    </LessonAction>
  </div>
}
